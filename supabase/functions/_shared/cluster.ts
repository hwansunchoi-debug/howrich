import type { SupabaseClient } from "./supabaseClient.ts";
import { addUsage, askForJson, emptyUsage, type Usage } from "./anthropic.ts";

export interface ClusterResult {
  processed: number;
  assigned: number;
  created: number;
  skipped: number;
  newIssueTitles: string[];
  usage: Usage;
}

interface ArticleRow {
  id: string;
  title: string;
  publisher: string;
  published_at: string;
  summary: string | null;
}

interface IssueCandidate {
  id: string;
  title: string;
  description: string | null;
  recentTitles: string[];
}

interface AiClusterResponse {
  assignments?: Array<{ index: number; issue_id: string }>;
  new_issues?: Array<{
    title: string;
    emoji?: string;
    description?: string;
    indexes: number[];
  }>;
  skipped?: number[];
}

const SYSTEM_PROMPT = `당신은 한국 뉴스 편집자다.
새로 들어온 기사들을 읽고, 각 기사가 어떤 "이슈"에 속하는지 판단한다.

판단 기준:
- 단어가 겹치는지가 아니라, 같은 사건·같은 사안을 다루는지를 본다.
- 표현이 달라도 같은 사건이면 같은 이슈로 묶는다.
- 같은 단어가 들어가도 사건이 다르면 다른 이슈다.
- 기존 이슈 중 맞는 것이 있으면 반드시 기존 이슈에 넣는다. 비슷한 이슈를 새로 만들지 않는다.
- 맞는 기존 이슈가 없으면 새 이슈를 만든다. 같은 사건을 다루는 새 기사끼리는 하나의 새 이슈로 묶는다.
- skipped 는 아껴서 쓴다. 광고, 부고, 운세, 날씨 안내, 개별 종목 시황처럼
  사건이라고 보기 어려운 기사만 넣는다.
- 기사가 한 건뿐이어도 사건을 다루고 있다면 이슈로 만든다.
  나중에 같은 사건의 기사가 더 들어오면 그 이슈에 쌓인다.
- 판단이 애매하면 skipped 하지 말고 이슈로 만든다.

이슈 제목 규칙:
- 20자 이내의 명사형 문구. (예: "화물연대 총파업", "국회 예산안 처리 지연")
- 특정 기사 제목을 그대로 베끼지 않는다.
- 자극적인 표현이나 추측을 넣지 않는다.

이모지(emoji) 규칙:
- 이슈 성격을 한눈에 알 수 있는 이모지 한 개.
- 예) 재난·사고 🚨, 날씨·기후 🌧️, 정치 🏛️, 선거 🗳️, 재판·수사 ⚖️,
  경제·증시 📈, 부동산 🏠, 외교·국제 🌏, 노동·파업 ✊, 교육 🎓,
  보건·의료 🏥, 과학·기술 🔬, 스포츠 ⚽, 문화·연예 🎬, 사건·사고 🚓
- 목록에 없어도 더 잘 맞는 이모지가 있으면 그것을 쓴다.

설명(description) 규칙:
- 현재 상황을 설명하는 한 문장. 40자 내외.
- 기사에서 확인되는 사실만 쓴다.

반드시 아래 JSON 형식만 출력한다. 다른 텍스트는 쓰지 않는다.
{
  "assignments": [{ "index": 0, "issue_id": "기존 이슈 id" }],
  "new_issues": [{ "title": "새 이슈 제목", "emoji": "🏛️", "description": "한 줄 설명", "indexes": [1, 2] }],
  "skipped": [3]
}
모든 기사 index 는 assignments / new_issues / skipped 중 정확히 한 곳에만 넣는다.`;

/** 아직 이슈에 배정되지 않은 기사를 AI로 분류한다. */
export async function clusterArticles(
  supabase: SupabaseClient,
  options: { maxArticles?: number } = {},
): Promise<ClusterResult> {
  const maxArticles = options.maxArticles ?? 120;

  const { data: pending, error: pendingError } = await supabase
    .from("unclustered_articles")
    .select("id, title, publisher, published_at, summary")
    .order("published_at", { ascending: true })
    .limit(maxArticles);

  if (pendingError) {
    throw new Error(`미분류 기사 조회 실패: ${pendingError.message}`);
  }

  const articles = (pending ?? []) as ArticleRow[];
  const empty: ClusterResult = {
    processed: 0,
    assigned: 0,
    created: 0,
    skipped: 0,
    newIssueTitles: [],
    usage: emptyUsage(),
  };
  if (articles.length === 0) return empty;

  const candidates = await loadIssueCandidates(supabase);

  const payload = {
    현재시각: new Date().toISOString(),
    기존_이슈: candidates.map((issue) => ({
      issue_id: issue.id,
      title: issue.title,
      description: issue.description,
      최근_기사_제목: issue.recentTitles,
    })),
    새_기사: articles.map((article, index) => ({
      index,
      title: article.title,
      publisher: article.publisher,
      published_at: article.published_at,
      summary: article.summary?.slice(0, 200) ?? null,
    })),
  };

  const { value: ai, usage } = await askForJson<AiClusterResponse>({
    system: SYSTEM_PROMPT,
    user: JSON.stringify(payload, null, 2),
    maxTokens: 8000,
  });

  const candidateIds = new Set(candidates.map((issue) => issue.id));
  const usedIndexes = new Set<number>();
  const links: Array<{ issue_id: string; article_id: string }> = [];
  const newIssueTitles: string[] = [];
  let created = 0;
  let skipped = 0;

  const takeIndex = (value: unknown): ArticleRow | null => {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 0 || index >= articles.length) return null;
    if (usedIndexes.has(index)) return null;
    usedIndexes.add(index);
    return articles[index];
  };

  // 1) 기존 이슈에 배정
  for (const assignment of ai.assignments ?? []) {
    if (!assignment || !candidateIds.has(assignment.issue_id)) continue;
    const article = takeIndex(assignment.index);
    if (!article) continue;
    links.push({ issue_id: assignment.issue_id, article_id: article.id });
  }

  // 2) 새 이슈 생성
  for (const group of ai.new_issues ?? []) {
    const title = (group?.title ?? "").trim();
    const indexes = Array.isArray(group?.indexes) ? group.indexes : [];
    if (!title || indexes.length === 0) continue;

    const members = indexes
      .map((index) => takeIndex(index))
      .filter((article): article is ArticleRow => article !== null);
    if (members.length === 0) continue;

    const { data: inserted, error: insertError } = await supabase
      .from("issues")
      .insert({
        title: title.slice(0, 80),
        emoji: pickEmoji(group.emoji),
        description: (group.description ?? "").trim().slice(0, 200) || null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // 이 이슈만 건너뛰고 나머지는 계속 처리한다.
      console.error("이슈 생성 실패:", insertError?.message);
      continue;
    }

    created++;
    newIssueTitles.push(title);
    for (const article of members) {
      links.push({ issue_id: inserted.id as string, article_id: article.id });
    }
  }

  // 3) 이슈로 다루지 않는 기사
  for (const index of ai.skipped ?? []) {
    if (takeIndex(index)) skipped++;
  }

  if (links.length > 0) {
    const { error: linkError } = await supabase
      .from("issue_articles")
      .upsert(links, { onConflict: "article_id", ignoreDuplicates: true });
    if (linkError) throw new Error(`이슈-기사 연결 실패: ${linkError.message}`);
  }

  // 모델이 언급하지 않은 기사도 이번 배치에서 처리된 것으로 표시해
  // 같은 기사를 계속 다시 분석하지 않도록 한다.
  const processedIds = articles.map((article) => article.id);
  const { error: markError } = await supabase
    .from("articles")
    .update({ clustered_at: new Date().toISOString() })
    .in("id", processedIds);
  if (markError) throw new Error(`분류 표시 실패: ${markError.message}`);

  return {
    processed: articles.length,
    assigned: links.length,
    created,
    skipped: skipped + (articles.length - usedIndexes.size),
    newIssueTitles,
    usage,
  };
}

/**
 * 모델이 돌려준 이모지를 검증한다.
 * 글자가 섞여 오거나 여러 개가 오는 경우가 있어 첫 글자만 쓰고,
 * 이모지가 아니면 저장하지 않는다.
 */
function pickEmoji(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const first = [...value.trim()][0];
  if (!first) return null;
  // 기본 라틴 문자/숫자면 이모지가 아니다.
  return /[\p{Extended_Pictographic}]/u.test(first) ? first : null;
}

/** 최근에 살아있는 이슈들을 후보로 가져온다. (최근 기사 제목 3개 포함) */
async function loadIssueCandidates(
  supabase: SupabaseClient,
): Promise<IssueCandidate[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: issues, error } = await supabase
    .from("issues")
    .select("id, title, description")
    .or(`last_article_at.gte.${since},created_at.gte.${since}`)
    .order("issue_score", { ascending: false })
    .limit(30);

  if (error) throw new Error(`이슈 후보 조회 실패: ${error.message}`);
  const rows = issues ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((issue: { id: string }) => issue.id);
  const { data: recent, error: recentError } = await supabase
    .from("articles")
    .select("title, published_at, issue_articles!inner(issue_id)")
    .in("issue_articles.issue_id", ids)
    .order("published_at", { ascending: false })
    .limit(200);

  if (recentError) {
    throw new Error(`이슈 대표 기사 조회 실패: ${recentError.message}`);
  }

  const byIssue = new Map<string, string[]>();
  for (const row of recent ?? []) {
    const link = (row as { issue_articles: { issue_id: string } | Array<{ issue_id: string }> })
      .issue_articles;
    const issueId = Array.isArray(link) ? link[0]?.issue_id : link?.issue_id;
    if (!issueId) continue;
    const list = byIssue.get(issueId) ?? [];
    if (list.length < 3) {
      list.push((row as { title: string }).title);
      byIssue.set(issueId, list);
    }
  }

  return rows.map((issue: { id: string; title: string; description: string | null }) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    recentTitles: byIssue.get(issue.id) ?? [],
  }));
}
