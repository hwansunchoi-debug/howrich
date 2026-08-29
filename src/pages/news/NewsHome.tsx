import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, RefreshCw, Star } from "lucide-react";
import { IssueCard } from "@/components/news/IssueCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useFollowedIssues } from "@/hooks/useFollowedIssues";
import { fetchIssuesByIds, fetchTopIssues } from "@/services/newsService";
import { formatRelative } from "@/lib/newsTime";

const REFRESH_INTERVAL_MS = 60_000;

export default function NewsHome() {
  const { followedIds, toggleFollow, isFollowed } = useFollowedIssues();

  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } =
    useQuery({
      queryKey: ["news", "issues"],
      queryFn: () => fetchTopIssues(20),
      refetchInterval: REFRESH_INTERVAL_MS,
      staleTime: 30_000,
    });

  // 팔로우한 이슈는 순위에서 밀려도 따로 가져와 위쪽에 고정한다.
  const { data: followedIssues = [] } = useQuery({
    queryKey: ["news", "followed", followedIds],
    queryFn: () => fetchIssuesByIds(followedIds),
    enabled: followedIds.length > 0,
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: 30_000,
  });

  const issues = data ?? [];
  const followedSet = new Set(followedIds);
  const rest = issues.filter((issue) => !followedSet.has(issue.id));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <Link to="/" className="block">
              <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
                지금 대한민국
              </h1>
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {dataUpdatedAt
                ? `${formatRelative(new Date(dataUpdatedAt))} 기준`
                : "실시간 뉴스 이슈"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            aria-label="새로고침"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <p className="mb-4 text-sm text-muted-foreground">
          여러 언론사의 기사를 모아 같은 사건끼리 묶고, 지금 가장 크게 번지고 있는
          순서로 보여줍니다.
        </p>

        {followedIssues.length > 0 && (
          <section className="mb-7">
            <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Star className="h-4 w-4 fill-primary text-primary" />
              팔로우 중인 이슈
            </h2>
            <ul className="space-y-3">
              {followedIssues.map((issue) => (
                <li key={issue.id}>
                  <IssueCard
                    issue={issue}
                    followed
                    onToggleFollow={() => toggleFollow(issue.id)}
                  />
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs text-muted-foreground">
              순위에서 밀려도 여기에 계속 남습니다. 이 브라우저에만 저장됩니다.
            </p>
          </section>
        )}

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-border p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-foreground">이슈를 불러오지 못했습니다.</p>
              <p className="mt-1 text-muted-foreground">
                {error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요."}
              </p>
            </div>
          </div>
        )}

        {!isLoading && !isError && issues.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium text-foreground">
              아직 정리된 이슈가 없습니다.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              뉴스 수집 파이프라인(news-pipeline)이 한 번 실행되면
              <br />
              이곳에 현재 이슈가 나타납니다.
            </p>
          </div>
        )}

        {rest.length > 0 && (
          <section>
            {followedIssues.length > 0 && (
              <h2 className="mb-2.5 text-sm font-semibold text-foreground">
                지금 주요 이슈
              </h2>
            )}
            <ol className="space-y-3">
              {rest.map((issue) => (
                <li key={issue.id}>
                  <IssueCard
                    issue={issue}
                    rank={issues.indexOf(issue) + 1}
                    followed={isFollowed(issue.id)}
                    onToggleFollow={() => toggleFollow(issue.id)}
                  />
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          기사 제목을 누르면 해당 언론사 원문으로 이동합니다.
        </p>
      </main>
    </div>
  );
}
