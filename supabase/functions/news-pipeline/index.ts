// 전체 파이프라인:
//   RSS 수집 -> Supabase 저장 -> AI 이슈 분류 -> 점수 갱신 -> 타임라인 생성
// pg_cron 에서 5분마다 이 함수를 호출한다.
import { handlePreflight, jsonResponse, readOptions } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabaseClient.ts";
import { collectArticles } from "../_shared/collect.ts";
import { clusterArticles } from "../_shared/cluster.ts";
import { buildTimelines } from "../_shared/timeline.ts";
import { hasAnthropicKey } from "../_shared/anthropic.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const startedAt = Date.now();
  const steps: Record<string, unknown> = {};
  const errors: string[] = [];

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
        steps.cluster = await clusterArticles(supabase, {
          maxArticles: Number(options.maxArticles) || undefined,
        });
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
        steps.timeline = await buildTimelines(supabase, {
          maxIssues: Number(options.maxIssues) || undefined,
        });
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
