// RSS/API 소스에서 새 기사를 수집한다.
import { handlePreflight, jsonResponse } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabaseClient.ts";
import { collectArticles } from "../_shared/collect.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const supabase = createServiceClient();
    const result = await collectArticles(supabase);

    // 점수 계산은 SQL 이라 요금이 들지 않는다.
    // 15분마다 다시 계산해 최신성 기준 순위가 자주 갱신되도록 한다.
    const { error } = await supabase.rpc("refresh_issue_scores");
    if (error) throw new Error(`점수 계산 실패: ${error.message}`);

    return jsonResponse({ ok: true, ...result, scoreRefreshed: true });
  } catch (error) {
    console.error("news-collect 실패:", error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
