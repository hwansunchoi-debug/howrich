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
    return jsonResponse({ ok: true, ...result });
  } catch (error) {
    console.error("news-collect 실패:", error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
