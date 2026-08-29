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
  "id, title, emoji, description, issue_score, article_count, recent_article_count, last_hour_count, prev_hour_count, trend, last_article_at, created_at, updated_at";

/** 지금 이슈가 되고 있는 순서대로 이슈 목록을 가져온다. */
export async function fetchTopIssues(limit = 20): Promise<NewsIssue[]> {
  // 항상 20개를 채워 보여준다. 오래된 이슈는 최신성 점수가 떨어져
  // 자연스럽게 뒤로 밀리므로 시간 조건을 따로 걸지 않는다.
  const { data, error } = await supabase
    .from("issues")
    .select(ISSUE_COLUMNS)
    .gt("article_count", 0)
    .order("issue_score", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as NewsIssue[];
}

export interface PipelineStatus {
  /** 아직 AI 분석을 거치지 않은 기사 수 */
  pendingArticles: number;
  /** 마지막으로 타임라인을 만든 시각 */
  lastAnalyzedAt: string | null;
}

/** 화면에 "분석 대기 중" 상태를 보여주기 위한 값들 */
export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const [pending, latest] = await Promise.all([
    supabase
      .from("unclustered_articles")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("issues")
      .select("timeline_built_at")
      .not("timeline_built_at", "is", null)
      .order("timeline_built_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (pending.error) throw new Error(pending.error.message);
  if (latest.error) throw new Error(latest.error.message);

  return {
    pendingArticles: pending.count ?? 0,
    lastAnalyzedAt: (latest.data?.timeline_built_at as string | null) ?? null,
  };
}

export interface NewsSource {
  name: string;
  status: "ok" | "error" | "pending";
}

/** 지금 기사를 받아오고 있는 언론사 목록 */
export async function fetchNewsSources(): Promise<NewsSource[]> {
  const { data, error } = await supabase
    .from("news_sources")
    .select("name, last_status, enabled")
    .eq("enabled", true)
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const status = row.last_status as string | null;
    return {
      name: row.name as string,
      status: status === "ok" ? "ok" : status === "error" ? "error" : "pending",
    };
  });
}

export interface AiUsage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  costUsd: number;
}

export interface RunResult {
  ok: boolean;
  errors?: string[];
  steps?: {
    collect?: { fetched?: number; inserted?: number };
    cluster?: { processed?: number; assigned?: number; created?: number; skipped?: number };
    timeline?: { issuesUpdated?: number; eventsWritten?: number };
  };
  usage?: AiUsage;
  elapsedMs?: number;
}

export interface UsageSummary {
  monthInputTokens: number;
  monthOutputTokens: number;
  monthCostUsd: number;
  dayInputTokens: number;
  dayOutputTokens: number;
  dayCostUsd: number;
  lastRunAt: string | null;
}

/** 오늘과 이번 달 AI 사용량 */
export async function fetchUsageSummary(): Promise<UsageSummary | null> {
  const { data, error } = await supabase
    .from("ai_usage_summary")
    .select("*")
    .maybeSingle();

  // 아직 기록 테이블이 없는 경우에도 화면은 정상 동작해야 한다.
  if (error || !data) return null;

  const row = data as Record<string, number | string | null>;
  return {
    monthInputTokens: Number(row.month_input_tokens ?? 0),
    monthOutputTokens: Number(row.month_output_tokens ?? 0),
    monthCostUsd: Number(row.month_cost_usd ?? 0),
    dayInputTokens: Number(row.day_input_tokens ?? 0),
    dayOutputTokens: Number(row.day_output_tokens ?? 0),
    dayCostUsd: Number(row.day_cost_usd ?? 0),
    lastRunAt: (row.last_run_at as string | null) ?? null,
  };
}

/**
 * AI 분석을 지금 실행한다. 요금이 발생하므로 관리자 열쇠가 필요하다.
 * 열쇠는 서버(Edge Function)에서 확인한다.
 */
export async function runPipeline(adminKey: string): Promise<RunResult> {
  const { data, error } = await supabase.functions.invoke<RunResult>("news-pipeline", {
    headers: { "x-admin-key": adminKey },
    body: { maxArticles: 200, maxIssues: 15 },
  });

  if (error) {
    // 403 이면 열쇠가 틀린 경우다.
    const message = error.message.includes("403") || error.message.includes("non-2xx")
      ? "실행에 실패했습니다. 관리자 열쇠가 맞는지 확인해 주세요."
      : error.message;
    throw new Error(message);
  }
  if (!data) throw new Error("응답이 비어 있습니다.");
  return data;
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

  const [
    { data: eventRows, error: eventError },
    { data: articleRows, error: articleError },
    { data: firstRow, error: firstError },
  ] = await Promise.all([
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
      // 기사가 300건을 넘어도 최초 보도는 반드시 보이도록 따로 가져온다.
      supabase
        .from("articles")
        .select(
          "id, title, publisher, published_at, url, summary, issue_articles!inner(issue_id)",
        )
        .eq("issue_articles.issue_id", issueId)
        .order("published_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  if (eventError) throw new Error(eventError.message);
  if (articleError) throw new Error(articleError.message);
  if (firstError) throw new Error(firstError.message);

  const events = (eventRows ?? []) as TimelineEvent[];
  // 조인용으로 함께 내려온 issue_articles 키는 떼어낸다.
  const toArticle = ({
    id,
    title,
    publisher,
    published_at,
    url,
    summary,
  }: NewsArticle): NewsArticle => ({ id, title, publisher, published_at, url, summary });

  const articles: NewsArticle[] = (articleRows ?? []).map(toArticle);
  const firstArticle = firstRow ? toArticle(firstRow as NewsArticle) : null;

  // 최신 300건에 들어 있지 않으면 목록에 더한다.
  if (firstArticle && !articles.some((article) => article.id === firstArticle.id)) {
    articles.push(firstArticle);
  }

  return {
    issue: issueRow as NewsIssue,
    sections: buildSections(events, articles),
    publisherCount: new Set(articles.map((article) => article.publisher)).size,
    firstArticle,
  };
}

/**
 * 시간대(1시간) 단위로 기사와 AI 요약을 합친다.
 *
 * 요약(timeline_events)은 기사와 별개로 계속 보관되므로, 기사 목록을
 * 일부만 불러온 오래된 이슈에서도 시간대가 끊기지 않도록 양쪽을 합친다.
 * 아직 요약이 만들어지지 않은 시간대도 기사와 함께 그대로 보여준다.
 */
function buildSections(
  events: TimelineEvent[],
  articles: NewsArticle[],
): TimelineSection[] {
  const grouped = new Map<string, NewsArticle[]>();
  for (const article of articles) {
    const key = hourBucketKey(article.published_at);
    const list = grouped.get(key) ?? [];
    list.push(article);
    grouped.set(key, list);
  }

  const summaryByHour = new Map<string, TimelineEvent>();
  for (const event of events) {
    summaryByHour.set(hourBucketKey(event.start_time), event);
  }

  const keys = new Set([...grouped.keys(), ...summaryByHour.keys()]);

  return [...keys]
    .sort((a, b) => b.localeCompare(a))
    .map((startTime) => {
      const list = (grouped.get(startTime) ?? []).sort((a, b) =>
        b.published_at.localeCompare(a.published_at),
      );
      const event = summaryByHour.get(startTime);
      return {
        startTime,
        endTime: new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(),
        summary: event?.summary ?? null,
        articles: list,
        articleCount: list.length || event?.article_count || 0,
      };
    });
}
