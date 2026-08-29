// 아직 이슈에 배정되지 않은 기사를 AI로 분류한 뒤 이슈 점수를 다시 계산한다.
import { handlePreflight, jsonResponse, readOptions } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabaseClient.ts";
import { clusterArticles } from "../_shared/cluster.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const options = await readOptions(req);
    const supabase = createServiceClient();

    const result = await clusterArticles(supabase, {
      maxArticles: Number(options.maxArticles) || undefined,
    });

    const { error } = await supabase.rpc("refresh_issue_scores");
    if (error) throw new Error(`점수 계산 실패: ${error.message}`);

    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    console.error("news-cluster 실패:", error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
