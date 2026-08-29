import type { SupabaseClient } from "./supabaseClient.ts";
import { fetchFeed } from "./rss.ts";

export interface SourceResult {
  name: string;
  feed_url: string;
  status: "ok" | "error";
  items?: number;
  error?: string;
}

export interface CollectResult {
  sources: SourceResult[];
  fetched: number;
  inserted: number;
}

interface NewsSourceRow {
  id: string;
  name: string;
  feed_url: string;
}

const MAX_AGE_HOURS = 48;

/**
 * 등록된 RSS/API 소스에서 새 기사를 가져와 articles 에 저장한다.
 * url 이 unique 이므로 이미 저장된 기사는 자동으로 무시된다.
 */
export async function collectArticles(
  supabase: SupabaseClient,
): Promise<CollectResult> {
  const { data: sources, error } = await supabase
    .from("news_sources")
    .select("id, name, feed_url")
    .eq("enabled", true)
    .eq("source_type", "rss");

  if (error) throw new Error(`news_sources 조회 실패: ${error.message}`);

  const rows: Array<{
    title: string;
    publisher: string;
    published_at: string;
    url: string;
    summary: string | null;
    source_id: string;
  }> = [];
  const seenUrls = new Set<string>();
  const results: SourceResult[] = [];

  const now = Date.now();
  const oldestAllowed = now - MAX_AGE_HOURS * 60 * 60 * 1000;
  const newestAllowed = now + 60 * 60 * 1000; // 시계 오차 감안

  await Promise.all(
    (sources ?? []).map(async (source: NewsSourceRow) => {
      try {
        const items = await fetchFeed(source.feed_url);
        let usable = 0;

        for (const item of items) {
          // 발행 시간이 없는 피드는 수집 시각을 발행 시각으로 삼는다.
          const publishedAt = item.publishedAt ?? new Date();
          const time = publishedAt.getTime();
          if (time < oldestAllowed || time > newestAllowed) continue;
          if (seenUrls.has(item.url)) continue;
          seenUrls.add(item.url);
          usable++;

          rows.push({
            title: item.title,
            publisher: source.name,
            published_at: publishedAt.toISOString(),
            url: item.url,
            summary: item.summary,
            source_id: source.id,
          });
        }

        results.push({
          name: source.name,
          feed_url: source.feed_url,
          status: "ok",
          items: usable,
        });

        await supabase
          .from("news_sources")
          .update({
            last_fetched_at: new Date().toISOString(),
            last_status: "ok",
            last_error: null,
          })
          .eq("id", source.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          name: source.name,
          feed_url: source.feed_url,
          status: "error",
          error: message,
        });

        await supabase
          .from("news_sources")
          .update({
            last_fetched_at: new Date().toISOString(),
            last_status: "error",
            last_error: message.slice(0, 500),
          })
          .eq("id", source.id);
      }
    }),
  );

  let inserted = 0;
  if (rows.length > 0) {
    // url 충돌(이미 수집된 기사)은 무시하고, 실제로 새로 들어간 행만 돌려받는다.
    const { data, error: insertError } = await supabase
      .from("articles")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
      .select("id");

    if (insertError) throw new Error(`articles 저장 실패: ${insertError.message}`);
    inserted = data?.length ?? 0;
  }

  return {
    sources: results.sort((a, b) => a.name.localeCompare(b.name)),
    fetched: rows.length,
    inserted,
  };
}
