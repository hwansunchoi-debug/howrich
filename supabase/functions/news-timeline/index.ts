// 이슈별 시간대 요약(타임라인)을 생성/갱신한다.
import { handlePreflight, jsonResponse, readOptions } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabaseClient.ts";
import { buildTimelines } from "../_shared/timeline.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const options = await readOptions(req);
    const supabase = createServiceClient();

    const result = await buildTimelines(supabase, {
      maxIssues: Number(options.maxIssues) || undefined,
    });

    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    console.error("news-timeline 실패:", error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
