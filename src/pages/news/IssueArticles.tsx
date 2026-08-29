import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchIssueDetail } from "@/services/newsService";
import { formatDateTime } from "@/lib/newsTime";
import { issueEmoji } from "@/lib/issueEmoji";
import type { NewsArticle } from "@/types/news";

type GroupBy = "time" | "publisher";

/** 한 이슈에 묶인 기사 전체 목록. 시간순 또는 언론사별로 본다. */
export default function IssueArticles() {
  const { issueId } = useParams<{ issueId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groupBy, setGroupBy] = useState<GroupBy>(
    searchParams.get("by") === "publisher" ? "publisher" : "time",
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["news", "issue", issueId],
    queryFn: () => fetchIssueDetail(issueId as string),
    enabled: Boolean(issueId),
    staleTime: 30_000,
  });

  const articles = useMemo(
    () =>
      (data?.sections ?? [])
        .flatMap((section) => section.articles)
        .sort((a, b) => b.published_at.localeCompare(a.published_at)),
    [data],
  );

  const byPublisher = useMemo(() => {
    const map = new Map<string, NewsArticle[]>();
    for (const article of articles) {
      const list = map.get(article.publisher) ?? [];
      list.push(article);
      map.set(article.publisher, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [articles]);

  const changeGroup = (next: GroupBy) => {
    setGroupBy(next);
    setSearchParams(next === "publisher" ? { by: "publisher" } : {}, {
      replace: true,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link
            to={`/issue/${issueId}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
            aria-label="이슈로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="truncate text-sm font-medium text-muted-foreground">
            {data ? data.issue.title : "기사 목록"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-foreground">
              {error instanceof Error ? error.message : "불러오지 못했습니다."}
            </p>
          </div>
        )}

        {data && (
          <>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              <span aria-hidden>{issueEmoji(data.issue)}</span> {data.issue.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              기사 {articles.length}건 · 언론사 {byPublisher.length}곳
            </p>

            <div className="mt-4 inline-flex rounded-lg border border-border p-0.5">
              {(
                [
                  ["time", "시간순"],
                  ["publisher", "언론사별"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeGroup(value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    groupBy === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {groupBy === "time" ? (
              <ul className="mt-4 space-y-1">
                {articles.map((article) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    isFirst={article.id === data.firstArticle?.id}
                    showPublisher
                  />
                ))}
              </ul>
            ) : (
              <div className="mt-4 space-y-5">
                {byPublisher.map(([publisher, list]) => (
                  <section key={publisher}>
                    <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
                      📰 {publisher}
                      <span className="text-xs font-normal text-muted-foreground">
                        {list.length}건
                      </span>
                    </h2>
                    <ul className="space-y-1">
                      {list.map((article) => (
                        <ArticleRow
                          key={article.id}
                          article={article}
                          isFirst={article.id === data.firstArticle?.id}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {articles.length === 0 && (
              <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                불러올 기사가 없습니다.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ArticleRow({
  article,
  isFirst,
  showPublisher,
}: {
  article: NewsArticle;
  isFirst: boolean;
  showPublisher?: boolean;
}) {
  return (
    <li>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
      >
        <div className="min-w-0 flex-1">
          {isFirst && (
            <p className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              🚩 이 이슈의 최초 보도
            </p>
          )}
          <p className="text-sm leading-snug text-foreground">{article.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {showPublisher && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                {article.publisher}
              </span>
            )}
            <span className="tabular-nums">{formatDateTime(article.published_at)}</span>
          </p>
        </div>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
      </a>
    </li>
  );
}
