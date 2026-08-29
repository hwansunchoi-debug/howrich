// =====================================================================
// ⚠️ 이 파일은 자동으로 만들어집니다. 직접 고치지 마세요.
// =====================================================================
// 원본: supabase/functions/news-pipeline/ + supabase/functions/_shared/
// 다시 만들기: npm run build:function
//
// Supabase CLI 없이 배포하는 방법:
//   Supabase 대시보드 > Edge Functions > Deploy a new function
//   이름을 news-pipeline 으로 하고, 이 파일 내용을 통째로 붙여넣는다.
// =====================================================================

// supabase/functions/_shared/http.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
function handlePreflight(req) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}
async function readOptions(req) {
  try {
    const text = await req.text();
    if (!text.trim()) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// supabase/functions/_shared/supabaseClient.ts
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY \uD658\uACBD\uBCC0\uC218\uAC00 \uC124\uC815\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// supabase/functions/_shared/rss.ts
var ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};
function decodeEntities(input) {
  return input.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16))).replace(/&([a-zA-Z]+);/g, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}
function clean(input, maxLength = 400) {
  if (!input) return null;
  const text = decodeEntities(input).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}\u2026` : text;
}
function tagValue(block, ...tags) {
  for (const tag of tags) {
    const match = block.match(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i")
    );
    if (match) {
      const raw = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      if (raw) return raw;
    }
  }
  return null;
}
function linkValue(block) {
  const direct = tagValue(block, "link");
  if (direct && /^https?:\/\//i.test(direct)) return direct;
  const alternate = block.match(
    /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i
  ) ?? block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return alternate ? decodeEntities(alternate[1]) : null;
}
function parseDate(block) {
  const raw = tagValue(block, "pubDate", "published", "updated", "dc:date", "date");
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function parseFeed(xml) {
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)
  ].map((match) => match[1]);
  const items = [];
  for (const block of blocks) {
    const title = clean(tagValue(block, "title"), 300);
    const url = linkValue(block) ?? tagValue(block, "guid");
    const publishedAt = parseDate(block);
    if (!title || !url || !/^https?:\/\//i.test(url) || !publishedAt) continue;
    items.push({
      title,
      url: url.trim(),
      summary: clean(
        tagValue(block, "description", "summary", "content:encoded", "content")
      ),
      publishedAt
    });
  }
  return items;
}
async function fetchFeed(url, timeoutMs = 15e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "korea-news-issue-bot/1.0 (+RSS reader)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "";
    const charset = contentType.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
    let xml;
    if (charset && charset !== "utf-8" && charset !== "utf8") {
      try {
        xml = new TextDecoder(charset).decode(buffer);
      } catch {
        xml = new TextDecoder("utf-8").decode(buffer);
      }
    } else {
      xml = new TextDecoder("utf-8").decode(buffer);
      if (/encoding=["'](euc-kr|ks_c_5601-1987)["']/i.test(xml.slice(0, 200))) {
        try {
          xml = new TextDecoder("euc-kr").decode(buffer);
        } catch {
        }
      }
    }
    return parseFeed(xml);
  } finally {
    clearTimeout(timer);
  }
}

// supabase/functions/_shared/collect.ts
var MAX_AGE_HOURS = 48;
async function collectArticles(supabase) {
  const { data: sources, error } = await supabase.from("news_sources").select("id, name, feed_url").eq("enabled", true).eq("source_type", "rss");
  if (error) throw new Error(`news_sources \uC870\uD68C \uC2E4\uD328: ${error.message}`);
  const rows = [];
  const seenUrls = /* @__PURE__ */ new Set();
  const results = [];
  const now = Date.now();
  const oldestAllowed = now - MAX_AGE_HOURS * 60 * 60 * 1e3;
  const newestAllowed = now + 60 * 60 * 1e3;
  await Promise.all(
    (sources ?? []).map(async (source) => {
      try {
        const items = await fetchFeed(source.feed_url);
        let usable = 0;
        for (const item of items) {
          const time = item.publishedAt.getTime();
          if (time < oldestAllowed || time > newestAllowed) continue;
          if (seenUrls.has(item.url)) continue;
          seenUrls.add(item.url);
          usable++;
          rows.push({
            title: item.title,
            publisher: source.name,
            published_at: item.publishedAt.toISOString(),
            url: item.url,
            summary: item.summary,
            source_id: source.id
          });
        }
        results.push({
          name: source.name,
          feed_url: source.feed_url,
          status: "ok",
          items: usable
        });
        await supabase.from("news_sources").update({
          last_fetched_at: (/* @__PURE__ */ new Date()).toISOString(),
          last_status: "ok",
          last_error: null
        }).eq("id", source.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          name: source.name,
          feed_url: source.feed_url,
          status: "error",
          error: message
        });
        await supabase.from("news_sources").update({
          last_fetched_at: (/* @__PURE__ */ new Date()).toISOString(),
          last_status: "error",
          last_error: message.slice(0, 500)
        }).eq("id", source.id);
      }
    })
  );
  let inserted = 0;
  if (rows.length > 0) {
    const { data, error: insertError } = await supabase.from("articles").upsert(rows, { onConflict: "url", ignoreDuplicates: true }).select("id");
    if (insertError) throw new Error(`articles \uC800\uC7A5 \uC2E4\uD328: ${insertError.message}`);
    inserted = data?.length ?? 0;
  }
  return {
    sources: results.sort((a, b) => a.name.localeCompare(b.name)),
    fetched: rows.length,
    inserted
  };
}

// supabase/functions/_shared/anthropic.ts
import Anthropic from "npm:@anthropic-ai/sdk@0.122.0";
var DEFAULT_MODEL = "claude-opus-5";
var DEFAULT_EFFORT = "low";
function effort() {
  const value = (Deno.env.get("NEWS_AI_EFFORT") ?? DEFAULT_EFFORT).toLowerCase();
  const allowed = ["low", "medium", "high", "xhigh", "max"];
  return allowed.includes(value) ? value : DEFAULT_EFFORT;
}
function model() {
  return Deno.env.get("NEWS_AI_MODEL") ?? DEFAULT_MODEL;
}
function hasAnthropicKey() {
  return Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
}
function client() {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY \uAC00 \uC124\uC815\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. supabase secrets set ANTHROPIC_API_KEY=... \uB85C \uB4F1\uB85D\uD574 \uC8FC\uC138\uC694."
    );
  }
  return new Anthropic({ apiKey });
}
function extractJson(text) {
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();
  if (!body.startsWith("{") && !body.startsWith("[")) {
    const objStart = body.indexOf("{");
    const arrStart = body.indexOf("[");
    const start = objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
    if (start === -1) throw new Error(`JSON \uC751\uB2F5\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${text.slice(0, 200)}`);
    const endChar = body[start] === "{" ? "}" : "]";
    const end = body.lastIndexOf(endChar);
    body = body.slice(start, end + 1);
  }
  return JSON.parse(body);
}
async function askForJson({
  system,
  user,
  maxTokens = 8e3
}) {
  const anthropic = client();
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: model(),
        max_tokens: maxTokens,
        output_config: { effort: effort() },
        system,
        messages: [{ role: "user", content: user }]
      });
      if (response.stop_reason === "refusal") {
        throw new Error("\uBAA8\uB378\uC774 \uC751\uB2F5\uC744 \uAC70\uBD80\uD588\uC2B5\uB2C8\uB2E4.");
      }
      const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
      return extractJson(text);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof Anthropic.RateLimitError || error instanceof Anthropic.APIError && error.status !== void 0 && error.status >= 500 || error instanceof Anthropic.APIConnectionError;
      if (!retryable || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 2e3));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// supabase/functions/_shared/cluster.ts
var SYSTEM_PROMPT = `\uB2F9\uC2E0\uC740 \uD55C\uAD6D \uB274\uC2A4 \uD3B8\uC9D1\uC790\uB2E4.
\uC0C8\uB85C \uB4E4\uC5B4\uC628 \uAE30\uC0AC\uB4E4\uC744 \uC77D\uACE0, \uAC01 \uAE30\uC0AC\uAC00 \uC5B4\uB5A4 "\uC774\uC288"\uC5D0 \uC18D\uD558\uB294\uC9C0 \uD310\uB2E8\uD55C\uB2E4.

\uD310\uB2E8 \uAE30\uC900:
- \uB2E8\uC5B4\uAC00 \uACB9\uCE58\uB294\uC9C0\uAC00 \uC544\uB2C8\uB77C, \uAC19\uC740 \uC0AC\uAC74\xB7\uAC19\uC740 \uC0AC\uC548\uC744 \uB2E4\uB8E8\uB294\uC9C0\uB97C \uBCF8\uB2E4.
- \uD45C\uD604\uC774 \uB2EC\uB77C\uB3C4 \uAC19\uC740 \uC0AC\uAC74\uC774\uBA74 \uAC19\uC740 \uC774\uC288\uB85C \uBB36\uB294\uB2E4.
- \uAC19\uC740 \uB2E8\uC5B4\uAC00 \uB4E4\uC5B4\uAC00\uB3C4 \uC0AC\uAC74\uC774 \uB2E4\uB974\uBA74 \uB2E4\uB978 \uC774\uC288\uB2E4.
- \uAE30\uC874 \uC774\uC288 \uC911 \uB9DE\uB294 \uAC83\uC774 \uC788\uC73C\uBA74 \uBC18\uB4DC\uC2DC \uAE30\uC874 \uC774\uC288\uC5D0 \uB123\uB294\uB2E4. \uBE44\uC2B7\uD55C \uC774\uC288\uB97C \uC0C8\uB85C \uB9CC\uB4E4\uC9C0 \uC54A\uB294\uB2E4.
- \uB9DE\uB294 \uAE30\uC874 \uC774\uC288\uAC00 \uC5C6\uC73C\uBA74 \uC0C8 \uC774\uC288\uB97C \uB9CC\uB4E0\uB2E4. \uAC19\uC740 \uC0AC\uAC74\uC744 \uB2E4\uB8E8\uB294 \uC0C8 \uAE30\uC0AC\uB07C\uB9AC\uB294 \uD558\uB098\uC758 \uC0C8 \uC774\uC288\uB85C \uBB36\uB294\uB2E4.
- \uB2E8\uC21C \uAD11\uACE0, \uBD80\uACE0, \uB0A0\uC528 \uC548\uB0B4, \uC6B4\uC138, \uC2A4\uD3EC\uCE20 \uACBD\uAE30 \uACB0\uACFC, \uC8FC\uAC00 \uC2DC\uD669 \uBC18\uBCF5 \uAE30\uC0AC\uCC98\uB7FC
  "\uC9C0\uAE08 \uB300\uD55C\uBBFC\uAD6D\uC758 \uC774\uC288"\uB77C\uACE0 \uBCF4\uAE30 \uC5B4\uB824\uC6B4 \uAE30\uC0AC\uB294 skipped \uC5D0 \uB123\uB294\uB2E4.

\uC774\uC288 \uC81C\uBAA9 \uADDC\uCE59:
- 20\uC790 \uC774\uB0B4\uC758 \uBA85\uC0AC\uD615 \uBB38\uAD6C. (\uC608: "\uD654\uBB3C\uC5F0\uB300 \uCD1D\uD30C\uC5C5", "\uAD6D\uD68C \uC608\uC0B0\uC548 \uCC98\uB9AC \uC9C0\uC5F0")
- \uD2B9\uC815 \uAE30\uC0AC \uC81C\uBAA9\uC744 \uADF8\uB300\uB85C \uBCA0\uB07C\uC9C0 \uC54A\uB294\uB2E4.
- \uC790\uADF9\uC801\uC778 \uD45C\uD604\uC774\uB098 \uCD94\uCE21\uC744 \uB123\uC9C0 \uC54A\uB294\uB2E4.

\uC124\uBA85(description) \uADDC\uCE59:
- \uD604\uC7AC \uC0C1\uD669\uC744 \uC124\uBA85\uD558\uB294 \uD55C \uBB38\uC7A5. 40\uC790 \uB0B4\uC678.
- \uAE30\uC0AC\uC5D0\uC11C \uD655\uC778\uB418\uB294 \uC0AC\uC2E4\uB9CC \uC4F4\uB2E4.

\uBC18\uB4DC\uC2DC \uC544\uB798 JSON \uD615\uC2DD\uB9CC \uCD9C\uB825\uD55C\uB2E4. \uB2E4\uB978 \uD14D\uC2A4\uD2B8\uB294 \uC4F0\uC9C0 \uC54A\uB294\uB2E4.
{
  "assignments": [{ "index": 0, "issue_id": "\uAE30\uC874 \uC774\uC288 id" }],
  "new_issues": [{ "title": "\uC0C8 \uC774\uC288 \uC81C\uBAA9", "description": "\uD55C \uC904 \uC124\uBA85", "indexes": [1, 2] }],
  "skipped": [3]
}
\uBAA8\uB4E0 \uAE30\uC0AC index \uB294 assignments / new_issues / skipped \uC911 \uC815\uD655\uD788 \uD55C \uACF3\uC5D0\uB9CC \uB123\uB294\uB2E4.`;
async function clusterArticles(supabase, options = {}) {
  const maxArticles = options.maxArticles ?? 40;
  const { data: pending, error: pendingError } = await supabase.from("unclustered_articles").select("id, title, publisher, published_at, summary").order("published_at", { ascending: true }).limit(maxArticles);
  if (pendingError) {
    throw new Error(`\uBBF8\uBD84\uB958 \uAE30\uC0AC \uC870\uD68C \uC2E4\uD328: ${pendingError.message}`);
  }
  const articles = pending ?? [];
  const empty = {
    processed: 0,
    assigned: 0,
    created: 0,
    skipped: 0,
    newIssueTitles: []
  };
  if (articles.length === 0) return empty;
  const candidates = await loadIssueCandidates(supabase);
  const payload = {
    \uD604\uC7AC\uC2DC\uAC01: (/* @__PURE__ */ new Date()).toISOString(),
    \uAE30\uC874_\uC774\uC288: candidates.map((issue) => ({
      issue_id: issue.id,
      title: issue.title,
      description: issue.description,
      \uCD5C\uADFC_\uAE30\uC0AC_\uC81C\uBAA9: issue.recentTitles
    })),
    \uC0C8_\uAE30\uC0AC: articles.map((article, index) => ({
      index,
      title: article.title,
      publisher: article.publisher,
      published_at: article.published_at,
      summary: article.summary?.slice(0, 200) ?? null
    }))
  };
  const ai = await askForJson({
    system: SYSTEM_PROMPT,
    user: JSON.stringify(payload, null, 2),
    maxTokens: 8e3
  });
  const candidateIds = new Set(candidates.map((issue) => issue.id));
  const usedIndexes = /* @__PURE__ */ new Set();
  const links = [];
  const newIssueTitles = [];
  let created = 0;
  let skipped = 0;
  const takeIndex = (value) => {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 0 || index >= articles.length) return null;
    if (usedIndexes.has(index)) return null;
    usedIndexes.add(index);
    return articles[index];
  };
  for (const assignment of ai.assignments ?? []) {
    if (!assignment || !candidateIds.has(assignment.issue_id)) continue;
    const article = takeIndex(assignment.index);
    if (!article) continue;
    links.push({ issue_id: assignment.issue_id, article_id: article.id });
  }
  for (const group of ai.new_issues ?? []) {
    const title = (group?.title ?? "").trim();
    const indexes = Array.isArray(group?.indexes) ? group.indexes : [];
    if (!title || indexes.length === 0) continue;
    const members = indexes.map((index) => takeIndex(index)).filter((article) => article !== null);
    if (members.length === 0) continue;
    const { data: inserted, error: insertError } = await supabase.from("issues").insert({
      title: title.slice(0, 80),
      description: (group.description ?? "").trim().slice(0, 200) || null
    }).select("id").single();
    if (insertError || !inserted) {
      console.error("\uC774\uC288 \uC0DD\uC131 \uC2E4\uD328:", insertError?.message);
      continue;
    }
    created++;
    newIssueTitles.push(title);
    for (const article of members) {
      links.push({ issue_id: inserted.id, article_id: article.id });
    }
  }
  for (const index of ai.skipped ?? []) {
    if (takeIndex(index)) skipped++;
  }
  if (links.length > 0) {
    const { error: linkError } = await supabase.from("issue_articles").upsert(links, { onConflict: "article_id", ignoreDuplicates: true });
    if (linkError) throw new Error(`\uC774\uC288-\uAE30\uC0AC \uC5F0\uACB0 \uC2E4\uD328: ${linkError.message}`);
  }
  const processedIds = articles.map((article) => article.id);
  const { error: markError } = await supabase.from("articles").update({ clustered_at: (/* @__PURE__ */ new Date()).toISOString() }).in("id", processedIds);
  if (markError) throw new Error(`\uBD84\uB958 \uD45C\uC2DC \uC2E4\uD328: ${markError.message}`);
  return {
    processed: articles.length,
    assigned: links.length,
    created,
    skipped: skipped + (articles.length - usedIndexes.size),
    newIssueTitles
  };
}
async function loadIssueCandidates(supabase) {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1e3).toISOString();
  const { data: issues, error } = await supabase.from("issues").select("id, title, description").or(`last_article_at.gte.${since},created_at.gte.${since}`).order("issue_score", { ascending: false }).limit(30);
  if (error) throw new Error(`\uC774\uC288 \uD6C4\uBCF4 \uC870\uD68C \uC2E4\uD328: ${error.message}`);
  const rows = issues ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((issue) => issue.id);
  const { data: recent, error: recentError } = await supabase.from("articles").select("title, published_at, issue_articles!inner(issue_id)").in("issue_articles.issue_id", ids).order("published_at", { ascending: false }).limit(200);
  if (recentError) {
    throw new Error(`\uC774\uC288 \uB300\uD45C \uAE30\uC0AC \uC870\uD68C \uC2E4\uD328: ${recentError.message}`);
  }
  const byIssue = /* @__PURE__ */ new Map();
  for (const row of recent ?? []) {
    const link = row.issue_articles;
    const issueId = Array.isArray(link) ? link[0]?.issue_id : link?.issue_id;
    if (!issueId) continue;
    const list = byIssue.get(issueId) ?? [];
    if (list.length < 3) {
      list.push(row.title);
      byIssue.set(issueId, list);
    }
  }
  return rows.map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    recentTitles: byIssue.get(issue.id) ?? []
  }));
}

// supabase/functions/_shared/time.ts
var KST_OFFSET_MS = 9 * 60 * 60 * 1e3;
function hourBucket(date) {
  const bucket = new Date(date.getTime());
  bucket.setUTCMinutes(0, 0, 0);
  return bucket;
}
function kstLabel(date) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hour24 = kst.getUTCHours();
  const meridiem = hour24 < 12 ? "\uC624\uC804" : "\uC624\uD6C4";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${month}\uC6D4 ${day}\uC77C ${meridiem} ${hour12}\uC2DC`;
}

// supabase/functions/_shared/timeline.ts
var SYSTEM_PROMPT2 = `\uB2F9\uC2E0\uC740 \uD55C\uAD6D \uB274\uC2A4 \uC774\uC288\uC758 \uC9C4\uD589 \uC0C1\uD669\uC744 \uC2DC\uAC04\uB300\uBCC4\uB85C \uC815\uB9AC\uD558\uB294 \uD3B8\uC9D1\uC790\uB2E4.

\uAC01 \uC2DC\uAC04\uB300(1\uC2DC\uAC04 \uB2E8\uC704)\uC5D0 \uC62C\uB77C\uC628 \uAE30\uC0AC\uB4E4\uC744 \uC77D\uACE0, \uADF8 \uC2DC\uAC04\uB300\uC5D0 \uC0C8\uB86D\uAC8C \uD655\uC778\uB41C
\uD575\uC2EC \uBCC0\uD654\uB97C \uD55C \uBB38\uC7A5\uC73C\uB85C \uC694\uC57D\uD55C\uB2E4.

\uADDC\uCE59:
- \uAE30\uC0AC \uC81C\uBAA9\uC744 \uC774\uC5B4\uBD99\uC774\uC9C0 \uC54A\uB294\uB2E4. \uADF8 \uC2DC\uAC04\uB300\uC5D0 \uC2E4\uC81C\uB85C \uBB34\uC5C7\uC774 \uC0C8\uB85C \uBC8C\uC5B4\uC84C\uB294\uC9C0 \uC4F4\uB2E4.
- \uC774\uC804 \uC2DC\uAC04\uB300 \uC694\uC57D\uACFC \uBE44\uAD50\uD574\uC11C \uB2EC\uB77C\uC9C4 \uC810\uC744 \uC4F4\uB2E4. \uC774\uBBF8 \uB098\uC628 \uB0B4\uC6A9\uC744 \uBC18\uBCF5\uD558\uC9C0 \uC54A\uB294\uB2E4.
- \uAE30\uC0AC\uC5D0\uC11C \uD655\uC778\uB418\uB294 \uC0AC\uC2E4\uB9CC \uC4F4\uB2E4. \uCD94\uCE21\uD558\uAC70\uB098 \uBC30\uACBD \uC124\uBA85\uC744 \uC9C0\uC5B4\uB0B4\uC9C0 \uC54A\uB294\uB2E4.
- \uD55C \uBB38\uC7A5, 60\uC790 \uC774\uB0B4. \uB2F4\uBC31\uD55C \uC11C\uC220\uCCB4\uB85C \uB05D\uB0B8\uB2E4. (\uC608: "\u2026\uBC1C\uD45C\uD588\uB2E4", "\u2026\uD655\uB300\uB410\uB2E4")
- \uADF8 \uC2DC\uAC04\uB300 \uAE30\uC0AC\uB4E4\uC774 \uC55E \uC2DC\uAC04\uB300\uC640 \uAC19\uC740 \uB0B4\uC6A9\uC758 \uBC18\uBCF5 \uBCF4\uB3C4\uB77C\uBA74
  "\uAC19\uC740 \uB0B4\uC6A9\uC758 \uD6C4\uC18D \uBCF4\uB3C4\uAC00 \uC774\uC5B4\uC84C\uB2E4" \uCC98\uB7FC \uC0AC\uC2E4\uB300\uB85C \uC9E7\uAC8C \uC4F4\uB2E4.

issue_description \uC740 \uC774 \uC774\uC288\uC758 "\uD604\uC7AC \uC0C1\uD669"\uC744 \uD55C \uBB38\uC7A5(40\uC790 \uB0B4\uC678)\uC73C\uB85C \uC815\uB9AC\uD55C \uAC83\uC774\uB2E4.
\uAC00\uC7A5 \uCD5C\uADFC \uC0C1\uD669 \uAE30\uC900\uC73C\uB85C \uC4F4\uB2E4.

\uBC18\uB4DC\uC2DC \uC544\uB798 JSON \uD615\uC2DD\uB9CC \uCD9C\uB825\uD55C\uB2E4.
{
  "issue_description": "\uD604\uC7AC \uC0C1\uD669 \uD55C \uC904 \uC694\uC57D",
  "buckets": [{ "start_time": "\uC694\uCCAD\uC5D0 \uC788\uB358 \uAC12 \uADF8\uB300\uB85C", "summary": "\uD55C \uC904 \uC694\uC57D" }]
}`;
async function buildTimelines(supabase, options = {}) {
  const maxIssues = options.maxIssues ?? 6;
  const result = {
    issuesChecked: 0,
    issuesUpdated: 0,
    eventsWritten: 0,
    errors: []
  };
  const { data: issues, error } = await supabase.from("issues").select("id, title, description, last_article_at, timeline_built_at").not("last_article_at", "is", null).order("issue_score", { ascending: false }).limit(20);
  if (error) throw new Error(`\uC774\uC288 \uC870\uD68C \uC2E4\uD328: ${error.message}`);
  const targets = (issues ?? []).filter(
    (issue) => !issue.timeline_built_at || (issue.last_article_at ?? "") > issue.timeline_built_at
  ).slice(0, maxIssues);
  result.issuesChecked = targets.length;
  for (const issue of targets) {
    try {
      const written = await buildTimelineForIssue(supabase, issue);
      if (written > 0) result.issuesUpdated++;
      result.eventsWritten += written;
    } catch (err) {
      result.errors.push(
        `${issue.title}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return result;
}
async function buildTimelineForIssue(supabase, issue) {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1e3).toISOString();
  const { data: rows, error } = await supabase.from("articles").select("title, publisher, published_at, issue_articles!inner(issue_id)").eq("issue_articles.issue_id", issue.id).gte("published_at", since).order("published_at", { ascending: true }).limit(150);
  if (error) throw new Error(`\uAE30\uC0AC \uC870\uD68C \uC2E4\uD328: ${error.message}`);
  const articles = rows ?? [];
  if (articles.length === 0) {
    await supabase.from("issues").update({ timeline_built_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", issue.id);
    return 0;
  }
  const buckets = /* @__PURE__ */ new Map();
  for (const article of articles) {
    const key = hourBucket(new Date(article.published_at)).toISOString();
    const list = buckets.get(key) ?? [];
    list.push(article);
    buckets.set(key, list);
  }
  const { data: existingRows, error: existingError } = await supabase.from("timeline_events").select("start_time, summary, article_count").eq("issue_id", issue.id).order("start_time", { ascending: true });
  if (existingError) throw new Error(`\uD0C0\uC784\uB77C\uC778 \uC870\uD68C \uC2E4\uD328: ${existingError.message}`);
  const existing = /* @__PURE__ */ new Map();
  for (const row of existingRows ?? []) {
    existing.set(new Date(row.start_time).toISOString(), row);
  }
  const rebuildFrom = Date.now() - 26 * 60 * 60 * 1e3;
  const pending = [...buckets.entries()].filter(([key, list]) => {
    if (new Date(key).getTime() < rebuildFrom) return false;
    const current = existing.get(key);
    return !current || current.article_count !== list.length;
  }).sort((a, b) => a[0].localeCompare(b[0]));
  if (pending.length === 0) {
    await supabase.from("issues").update({ timeline_built_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", issue.id);
    return 0;
  }
  const previous = [...existing.entries()].filter(([key]) => !pending.some(([pendingKey]) => pendingKey === key)).sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([key, row]) => ({
    \uC2DC\uAC04\uB300: kstLabel(new Date(key)),
    \uC694\uC57D: row.summary
  }));
  const payload = {
    \uC774\uC288_\uC81C\uBAA9: issue.title,
    \uC774\uC804_\uC2DC\uAC04\uB300_\uC694\uC57D: previous,
    \uC694\uC57D\uD560_\uC2DC\uAC04\uB300: pending.map(([key, list]) => ({
      start_time: key,
      \uC2DC\uAC04\uB300: kstLabel(new Date(key)),
      \uAE30\uC0AC: list.map((article) => ({
        title: article.title,
        publisher: article.publisher
      }))
    }))
  };
  const ai = await askForJson({
    system: SYSTEM_PROMPT2,
    user: JSON.stringify(payload, null, 2),
    maxTokens: 4e3
  });
  const pendingMap = new Map(pending);
  const events = (ai.buckets ?? []).map((bucket) => {
    const key = normalizeKey(bucket?.start_time, pendingMap);
    const summary = (bucket?.summary ?? "").trim();
    if (!key || !summary) return null;
    const list = pendingMap.get(key);
    const start = new Date(key);
    return {
      issue_id: issue.id,
      start_time: start.toISOString(),
      end_time: new Date(start.getTime() + 60 * 60 * 1e3).toISOString(),
      summary: summary.slice(0, 300),
      article_count: list.length,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }).filter((event) => event !== null);
  if (events.length > 0) {
    const { error: upsertError } = await supabase.from("timeline_events").upsert(events, { onConflict: "issue_id,start_time" });
    if (upsertError) throw new Error(`\uD0C0\uC784\uB77C\uC778 \uC800\uC7A5 \uC2E4\uD328: ${upsertError.message}`);
  }
  const description = (ai.issue_description ?? "").trim();
  await supabase.from("issues").update({
    timeline_built_at: (/* @__PURE__ */ new Date()).toISOString(),
    ...description ? { description: description.slice(0, 200) } : {}
  }).eq("id", issue.id);
  return events.length;
}
function normalizeKey(value, pendingMap) {
  if (typeof value !== "string") return null;
  if (pendingMap.has(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const key = hourBucket(parsed).toISOString();
  return pendingMap.has(key) ? key : null;
}

// supabase/functions/news-pipeline/index.ts
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const startedAt = Date.now();
  const steps = {};
  const errors = [];
  try {
    const options = await readOptions(req);
    const supabase = createServiceClient();
    try {
      steps.collect = await collectArticles(supabase);
    } catch (error) {
      errors.push(`collect: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (hasAnthropicKey()) {
      try {
        steps.cluster = await clusterArticles(supabase, {
          maxArticles: Number(options.maxArticles) || void 0
        });
      } catch (error) {
        errors.push(`cluster: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      errors.push("cluster: ANTHROPIC_API_KEY \uAC00 \uC5C6\uC5B4 \uAC74\uB108\uB701\uB2C8\uB2E4.");
    }
    const { error: scoreError } = await supabase.rpc("refresh_issue_scores");
    if (scoreError) errors.push(`score: ${scoreError.message}`);
    else steps.score = "ok";
    if (hasAnthropicKey()) {
      try {
        steps.timeline = await buildTimelines(supabase, {
          maxIssues: Number(options.maxIssues) || void 0
        });
      } catch (error) {
        errors.push(`timeline: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if ((/* @__PURE__ */ new Date()).getUTCMinutes() < 5) {
      const { error: pruneError } = await supabase.rpc("prune_old_news", {
        retain_days: 7
      });
      if (pruneError) errors.push(`prune: ${pruneError.message}`);
      else steps.prune = "ok";
    }
    return jsonResponse({
      ok: errors.length === 0,
      elapsedMs: Date.now() - startedAt,
      steps,
      errors
    });
  } catch (error) {
    console.error("news-pipeline \uC2E4\uD328:", error);
    return jsonResponse(
      {
        ok: false,
        elapsedMs: Date.now() - startedAt,
        steps,
        errors: [...errors, error instanceof Error ? error.message : String(error)]
      },
      500
    );
  }
});
