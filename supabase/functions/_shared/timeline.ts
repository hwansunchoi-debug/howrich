import type { SupabaseClient } from "./supabaseClient.ts";
import { addUsage, askForJson, emptyUsage, type Usage } from "./anthropic.ts";
import { hourBucket, kstLabel } from "./time.ts";

export interface TimelineResult {
  issuesChecked: number;
  issuesUpdated: number;
  eventsWritten: number;
  errors: string[];
  usage: Usage;
}

interface IssueRow {
  id: string;
  title: string;
  description: string | null;
  last_article_at: string | null;
  timeline_built_at: string | null;
}

interface TimelineEventRow {
  start_time: string;
  summary: string;
  article_count: number;
}

interface AiTimelineResponse {
  issue_description?: string;
  buckets?: Array<{ start_time: string; summary: string }>;
}

const SYSTEM_PROMPT = `당신은 한국 뉴스 이슈의 진행 상황을 시간대별로 정리하는 편집자다.

각 시간대(1시간 단위)에 올라온 기사들을 읽고, 그 시간대에 새롭게 확인된
핵심 변화를 한 문장으로 요약한다.

규칙:
- 기사 제목을 이어붙이지 않는다. 그 시간대에 실제로 무엇이 새로 벌어졌는지 쓴다.
- 이전 시간대 요약과 비교해서 달라진 점을 쓴다. 이미 나온 내용을 반복하지 않는다.
- 기사에서 확인되는 사실만 쓴다. 추측하거나 배경 설명을 지어내지 않는다.

길이와 형태 (중요):
- 30자 이내. 신문 헤드라인처럼 짧게 쓴다.
- 완전한 문장으로 쓰지 않는다. "…했다", "…이다" 같은 서술어로 끝내지 않는다.
- 명사나 명사구로 끝낸다. 조사와 군더더기는 뺀다.
- 좋은 예
    "무안 망운면으로 이전 후보지 확정"
    "사망 552명·실종 1500명 집계"
    "정부, 해외 구조팀 지원 거절"
    "구속영장 4건 모두 기각"
    "갤럽 조사 부정평가 우세"
- 나쁜 예 (너무 길고 서술적이다)
    "광주 군공항 이전 후보지로 무안군 망운면 일대가 확정됐다."
    "네팔 정부가 해외 구조팀 지원을 거절하고 자체 대응에 나섰다."
- 그 시간대 기사들이 앞 시간대와 같은 내용의 반복 보도라면 "후속 보도" 라고만 쓴다.

issue_description 은 이 이슈의 "현재 상황"을 한 문장(40자 내외)으로 정리한 것이다.
가장 최근 상황 기준으로 쓴다.

매우 중요: 요약할_시간대 에 들어 있는 start_time 은 **하나도 빠짐없이** buckets 에
넣어야 한다. 기사가 한 건뿐이거나 앞 시간대와 내용이 겹쳐도 건너뛰지 않는다.
그런 경우에도 그 시간대에 무엇이 보도됐는지 한 문장으로 쓴다.

반드시 아래 JSON 형식만 출력한다.
{
  "issue_description": "현재 상황 한 줄 요약",
  "buckets": [{ "start_time": "요청에 있던 값 그대로", "summary": "한 줄 요약" }]
}`;

/** 이슈별 시간대 요약(타임라인)을 생성/갱신한다. */
export async function buildTimelines(
  supabase: SupabaseClient,
  options: { maxIssues?: number } = {},
): Promise<TimelineResult> {
  const maxIssues = options.maxIssues ?? 12;
  const result: TimelineResult = {
    issuesChecked: 0,
    issuesUpdated: 0,
    eventsWritten: 0,
    errors: [],
    usage: emptyUsage(),
  };

  const { data: issues, error } = await supabase
    .from("issues")
    .select("id, title, description, last_article_at, timeline_built_at")
    .not("last_article_at", "is", null)
    .order("issue_score", { ascending: false })
    .limit(30);

  if (error) throw new Error(`이슈 조회 실패: ${error.message}`);

  // 마지막 타임라인 생성 이후 새 기사가 들어온 이슈만 다시 만든다.
  const targets = ((issues ?? []) as IssueRow[])
    .filter((issue) =>
      !issue.timeline_built_at ||
      (issue.last_article_at ?? "") > issue.timeline_built_at
    )
    .slice(0, maxIssues);

  result.issuesChecked = targets.length;

  for (const issue of targets) {
    try {
      const { written, usage } = await buildTimelineForIssue(supabase, issue);
      if (written > 0) result.issuesUpdated++;
      result.eventsWritten += written;
      result.usage = addUsage(result.usage, usage);
    } catch (err) {
      result.errors.push(
        `${issue.title}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

async function buildTimelineForIssue(
  supabase: SupabaseClient,
  issue: IssueRow,
): Promise<{ written: number; usage: Usage }> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("articles")
    .select("title, publisher, published_at, issue_articles!inner(issue_id)")
    .eq("issue_articles.issue_id", issue.id)
    .gte("published_at", since)
    .order("published_at", { ascending: true })
    .limit(150);

  if (error) throw new Error(`기사 조회 실패: ${error.message}`);

  const articles = (rows ?? []) as Array<{
    title: string;
    publisher: string;
    published_at: string;
  }>;

  if (articles.length === 0) {
    await supabase
      .from("issues")
      .update({ timeline_built_at: new Date().toISOString() })
      .eq("id", issue.id);
    return { written: 0, usage: emptyUsage() };
  }

  // 1시간 단위로 묶는다.
  const buckets = new Map<string, typeof articles>();
  for (const article of articles) {
    const key = hourBucket(new Date(article.published_at)).toISOString();
    const list = buckets.get(key) ?? [];
    list.push(article);
    buckets.set(key, list);
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("timeline_events")
    .select("start_time, summary, article_count")
    .eq("issue_id", issue.id)
    .order("start_time", { ascending: true });

  if (existingError) throw new Error(`타임라인 조회 실패: ${existingError.message}`);

  const existing = new Map<string, TimelineEventRow>();
  for (const row of (existingRows ?? []) as TimelineEventRow[]) {
    existing.set(new Date(row.start_time).toISOString(), row);
  }

  // 지난 26시간 안의 시간대만 새로 만들거나 다시 만든다.
  // 다만 이슈가 처음 보도된 시간대는 오래됐더라도 요약이 없으면 만들어 둔다.
  const rebuildFrom = Date.now() - 26 * 60 * 60 * 1000;
  const oldestKey = [...buckets.keys()].sort()[0];
  const pending = [...buckets.entries()]
    .filter(([key, list]) => {
      const current = existing.get(key);
      if (key === oldestKey && !current) return true;
      if (new Date(key).getTime() < rebuildFrom) return false;
      return !current || current.article_count !== list.length;
    })
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (pending.length === 0) {
    await supabase
      .from("issues")
      .update({ timeline_built_at: new Date().toISOString() })
      .eq("id", issue.id);
    return { written: 0, usage: emptyUsage() };
  }

  const previous = [...existing.entries()]
    .filter(([key]) => !pending.some(([pendingKey]) => pendingKey === key))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([key, row]) => ({
      시간대: kstLabel(new Date(key)),
      요약: row.summary,
    }));

  const payload = {
    이슈_제목: issue.title,
    이전_시간대_요약: previous,
    요약할_시간대: pending.map(([key, list]) => ({
      start_time: key,
      시간대: kstLabel(new Date(key)),
      기사: list.map((article) => ({
        title: article.title,
        publisher: article.publisher,
      })),
    })),
  };

  const { value: ai, usage: firstUsage } = await askForJson<AiTimelineResponse>({
    system: SYSTEM_PROMPT,
    user: JSON.stringify(payload, null, 2),
    maxTokens: 4000,
  });
  let usage = firstUsage;

  const pendingMap = new Map(pending);

  // 모델이 빠뜨린 시간대가 있으면 그 시간대만 다시 요청한다.
  const covered = new Set(
    (ai.buckets ?? [])
      .map((bucket) => normalizeKey(bucket?.start_time, pendingMap))
      .filter((key): key is string => key !== null),
  );
  const missing = pending.filter(([key]) => !covered.has(key));

  if (missing.length > 0) {
    try {
      const { value: retry, usage: retryUsage } = await askForJson<AiTimelineResponse>({
        system: SYSTEM_PROMPT,
        user: JSON.stringify(
          {
            ...payload,
            요약할_시간대: missing.map(([key, list]) => ({
              start_time: key,
              시간대: kstLabel(new Date(key)),
              기사: list.map((article) => ({
                title: article.title,
                publisher: article.publisher,
              })),
            })),
          },
          null,
          2,
        ),
        maxTokens: 2000,
      });
      ai.buckets = [...(ai.buckets ?? []), ...(retry.buckets ?? [])];
      usage = addUsage(usage, retryUsage);
    } catch (err) {
      console.error("빠진 시간대 재요청 실패:", err);
    }
  }
  const events = (ai.buckets ?? [])
    .map((bucket) => {
      const key = normalizeKey(bucket?.start_time, pendingMap);
      const summary = (bucket?.summary ?? "").trim();
      if (!key || !summary) return null;
      const list = pendingMap.get(key)!;
      const start = new Date(key);
      return {
        issue_id: issue.id,
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
        summary: summary.slice(0, 120),
        article_count: list.length,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((event): event is NonNullable<typeof event> => event !== null);

  if (events.length > 0) {
    const { error: upsertError } = await supabase
      .from("timeline_events")
      .upsert(events, { onConflict: "issue_id,start_time" });
    if (upsertError) throw new Error(`타임라인 저장 실패: ${upsertError.message}`);
  }

  const description = (ai.issue_description ?? "").trim();
  await supabase
    .from("issues")
    .update({
      timeline_built_at: new Date().toISOString(),
      ...(description ? { description: description.slice(0, 200) } : {}),
    })
    .eq("id", issue.id);

  return { written: events.length, usage };
}

/** 모델이 돌려준 start_time 을 요청에 있던 키와 맞춘다. */
function normalizeKey(
  value: unknown,
  pendingMap: Map<string, unknown>,
): string | null {
  if (typeof value !== "string") return null;
  if (pendingMap.has(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const key = hourBucket(parsed).toISOString();
  return pendingMap.has(key) ? key : null;
}
