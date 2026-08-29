// RSS 2.0 / Atom 피드를 파싱한다.
// Edge 런타임에는 DOM 파서가 없어 정규식 기반으로 처리한다.

export interface FeedItem {
  title: string;
  url: string;
  summary: string | null;
  /** 피드에 발행 시간이 없으면 null. 수집 시각으로 대신한다. */
  publishedAt: Date | null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

function clean(input: string | null, maxLength = 400): string | null {
  if (!input) return null;
  const text = decodeEntities(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/** <tag>...</tag> 안의 값을 꺼낸다. CDATA 를 벗겨낸다. */
function tagValue(block: string, ...tags: string[]): string | null {
  for (const tag of tags) {
    const match = block.match(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"),
    );
    if (match) {
      const raw = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      if (raw) return raw;
    }
  }
  return null;
}

/** Atom 의 <link href="..."/> 형태를 처리한다. */
function linkValue(block: string): string | null {
  const direct = tagValue(block, "link");
  if (direct && /^https?:\/\//i.test(direct)) return direct;

  const alternate = block.match(
    /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i,
  ) ?? block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return alternate ? decodeEntities(alternate[1]) : null;
}

function parseDate(block: string): Date | null {
  const raw = tagValue(block, "pubDate", "published", "updated", "dc:date", "date");
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseFeed(xml: string): FeedItem[] {
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ].map((match) => match[1]);

  const items: FeedItem[] = [];

  for (const block of blocks) {
    const title = clean(tagValue(block, "title"), 300);
    const url = linkValue(block) ?? tagValue(block, "guid");
    const publishedAt = parseDate(block);

    // 발행 시간이 없는 피드(예: 한겨레)도 버리지 않는다.
    // 15분마다 수집하므로, 처음 보인 시각을 발행 시각으로 써도 오차가 크지 않다.
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;

    items.push({
      title,
      url: url.trim(),
      summary: clean(
        tagValue(block, "description", "summary", "content:encoded", "content"),
      ),
      publishedAt,
    });
  }

  return items;
}

/** 피드를 받아온다. 응답이 느리면 timeoutMs 후 중단한다. */
export async function fetchFeed(url: string, timeoutMs = 15000): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "korea-news-issue-bot/1.0 (+RSS reader)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "";
    const charset = contentType.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();

    // 국내 언론사 피드 중 EUC-KR 로 내려주는 곳이 있어 별도 디코딩한다.
    let xml: string;
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
          /* 실패하면 UTF-8 결과를 그대로 사용 */
        }
      }
    }

    return parseFeed(xml);
  } finally {
    clearTimeout(timer);
  }
}
