import { supabase } from "@/integrations/supabase/client";
import { hourBucketKey } from "@/lib/newsTime";
import type {
  IssueDetail,
  NewsArticle,
  NewsIssue,
  TimelineEvent,
  TimelineSection,
} from "@/types/news";

const ISSUE_COLUMNS =
  "id, title, description, issue_score, article_count, recent_article_count, last_hour_count, prev_hour_count, trend, last_article_at, created_at, updated_at";

const ACTIVE_WINDOW_HOURS = 48;

/** 지금 이슈가 되고 있는 순서대로 이슈 목록을 가져온다. */
export async function fetchTopIssues(limit = 20): Promise<NewsIssue[]> {
  const since = new Date(
    Date.now() - ACTIVE_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("issues")
    .select(ISSUE_COLUMNS)
    .gt("article_count", 0)
    .gte("last_article_at", since)
    .order("issue_score", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as NewsIssue[];
}

/**
 * 팔로우한 이슈를 id 로 가져온다.
 * 순위에서 밀리거나 48시간이 지난 이슈도 계속 추적할 수 있어야 하므로
 * fetchTopIssues 와 달리 시간 조건을 걸지 않는다.
 */
export async function fetchIssuesByIds(ids: string[]): Promise<NewsIssue[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("issues")
    .select(ISSUE_COLUMNS)
    .in("id", ids)
    .order("issue_score", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as NewsIssue[];
}

/** 이슈 상세: 현재 상황 요약 + 시간대별 타임라인 + 시간대별 기사 */
export async function fetchIssueDetail(issueId: string): Promise<IssueDetail> {
  const { data: issueRow, error: issueError } = await supabase
    .from("issues")
    .select(ISSUE_COLUMNS)
    .eq("id", issueId)
    .maybeSingle();

  if (issueError) throw new Error(issueError.message);
  if (!issueRow) throw new Error("이슈를 찾을 수 없습니다.");

  const [{ data: eventRows, error: eventError }, { data: articleRows, error: articleError }] =
    await Promise.all([
      supabase
        .from("timeline_events")
        .select("id, issue_id, start_time, end_time, summary, article_count")
        .eq("issue_id", issueId)
        .order("start_time", { ascending: false }),
      supabase
        .from("articles")
        .select(
          "id, title, publisher, published_at, url, summary, issue_articles!inner(issue_id)",
        )
        .eq("issue_articles.issue_id", issueId)
        .order("published_at", { ascending: false })
        .limit(300),
    ]);

  if (eventError) throw new Error(eventError.message);
  if (articleError) throw new Error(articleError.message);

  const events = (eventRows ?? []) as TimelineEvent[];
  // 조인용으로 함께 내려온 issue_articles 키는 떼어낸다.
  const articles: NewsArticle[] = (articleRows ?? []).map(
    ({ id, title, publisher, published_at, url, summary }) => ({
      id,
      title,
      publisher,
      published_at,
      url,
      summary,
    }),
  );

  return {
    issue: issueRow as NewsIssue,
    sections: buildSections(events, articles),
    publisherCount: new Set(articles.map((article) => article.publisher)).size,
  };
}

/**
 * 시간대(1시간) 단위로 기사와 AI 요약을 합친다.
 * 아직 요약이 만들어지지 않은 시간대도 기사와 함께 그대로 보여준다.
 */
function buildSections(
  events: TimelineEvent[],
  articles: NewsArticle[],
): TimelineSection[] {
  const summaryByHour = new Map<string, string>();
  for (const event of events) {
    summaryByHour.set(hourBucketKey(event.start_time), event.summary);
  }

  const grouped = new Map<string, NewsArticle[]>();
  for (const article of articles) {
    const key = hourBucketKey(article.published_at);
    const list = grouped.get(key) ?? [];
    list.push(article);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([startTime, list]) => ({
      startTime,
      endTime: new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(),
      summary: summaryByHour.get(startTime) ?? null,
      articles: list.sort((a, b) => b.published_at.localeCompare(a.published_at)),
    }));
}
