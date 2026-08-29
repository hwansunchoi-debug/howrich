// 전체 파이프라인:
//   RSS 수집 -> Supabase 저장 -> AI 이슈 분류 -> 점수 갱신 -> 타임라인 생성
// pg_cron 에서 5분마다 이 함수를 호출한다.
import { handlePreflight, jsonResponse, readOptions } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabaseClient.ts";
import { collectArticles } from "../_shared/collect.ts";
import { clusterArticles } from "../_shared/cluster.ts";
import { buildTimelines } from "../_shared/timeline.ts";
import {
  addUsage,
  currentModel,
  emptyUsage,
  estimateCostUsd,
  hasAnthropicKey,
  type Usage,
} from "../_shared/anthropic.ts";

/**
 * 이 함수는 AI 호출로 요금이 발생하므로 아무나 부를 수 없어야 한다.
 * 둘 중 하나를 만족해야 실행한다.
 *   - service_role 키로 호출 (cron, GitHub Actions)
 *   - NEWS_ADMIN_KEY 와 일치하는 x-admin-key 헤더 (웹 화면의 실행 버튼)
 */
function isAllowed(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization") ?? "";
  if (serviceRoleKey && authorization === `Bearer ${serviceRoleKey}`) return true;

  const adminKey = Deno.env.get("NEWS_ADMIN_KEY");
  const provided = req.headers.get("x-admin-key") ?? "";
  return Boolean(adminKey) && provided === adminKey;
}

/** 이번 단계에서 쓴 토큰을 기록한다. 실패해도 파이프라인은 계속 진행한다. */
async function recordUsage(
  supabase: ReturnType<typeof createServiceClient>,
  step: "cluster" | "timeline",
  usage: Usage,
): Promise<void> {
  if (usage.calls === 0) return;
  const model = currentModel();
  const { error } = await supabase.from("ai_usage").insert({
    model,
    step,
    calls: usage.calls,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: Number(estimateCostUsd(model, usage).toFixed(6)),
  });
  if (error) console.error("사용량 기록 실패:", error.message);
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (!isAllowed(req)) {
    return jsonResponse(
      { ok: false, error: "실행 권한이 없습니다. 관리자 열쇠를 확인해 주세요." },
      403,
    );
  }

  const startedAt = Date.now();
  const steps: Record<string, unknown> = {};
  const errors: string[] = [];
  let usage: Usage = emptyUsage();

  try {
    const options = await readOptions(req);
    const supabase = createServiceClient();

    // 1. 수집
    try {
      steps.collect = await collectArticles(supabase);
    } catch (error) {
      errors.push(`collect: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 2. AI 이슈 분류
    if (hasAnthropicKey()) {
      try {
        const result = await clusterArticles(supabase, {
          maxArticles: Number(options.maxArticles) || undefined,
        });
        steps.cluster = result;
        usage = addUsage(usage, result.usage);
        await recordUsage(supabase, "cluster", result.usage);
      } catch (error) {
        errors.push(`cluster: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      errors.push("cluster: ANTHROPIC_API_KEY 가 없어 건너뜁니다.");
    }

    // 3. 이슈 점수 갱신 (기사가 없어도 최신성 점수는 계속 떨어져야 한다)
    const { error: scoreError } = await supabase.rpc("refresh_issue_scores");
    if (scoreError) errors.push(`score: ${scoreError.message}`);
    else steps.score = "ok";

    // 4. 타임라인 생성
    if (hasAnthropicKey()) {
      try {
        const result = await buildTimelines(supabase, {
          maxIssues: Number(options.maxIssues) || undefined,
        });
        steps.timeline = result;
        usage = addUsage(usage, result.usage);
        await recordUsage(supabase, "timeline", result.usage);
      } catch (error) {
        errors.push(`timeline: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 5. 오래된 데이터 정리 (하루 한 번, 한국 시간 새벽 3시 무렵)
    if (new Date().getUTCHours() === 18) {
      const { error: pruneError } = await supabase.rpc("prune_old_news", {
        retain_days: 7,
      });
      if (pruneError) errors.push(`prune: ${pruneError.message}`);
      else steps.prune = "ok";
    }

    return jsonResponse({
      ok: errors.length === 0,
      elapsedMs: Date.now() - startedAt,
      steps,
      errors,
      usage: {
        ...usage,
        model: currentModel(),
        costUsd: Number(estimateCostUsd(currentModel(), usage).toFixed(6)),
      },
    });
  } catch (error) {
    console.error("news-pipeline 실패:", error);
    return jsonResponse(
      {
        ok: false,
        elapsedMs: Date.now() - startedAt,
        steps,
        errors: [...errors, error instanceof Error ? error.message : String(error)],
      },
      500,
    );
  }
});
