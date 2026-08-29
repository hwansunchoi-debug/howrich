import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, RefreshCw, Star } from "lucide-react";
import { IssueCard } from "@/components/news/IssueCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IssuePreviewPanel,
  SectionArticlesPanel,
} from "@/components/news/IssuePreviewPanel";
import { useFollowedIssues } from "@/hooks/useFollowedIssues";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { fetchIssuesByIds, fetchTopIssues } from "@/services/newsService";
import { formatFullDateTime } from "@/lib/newsTime";

const REFRESH_INTERVAL_MS = 60_000;

export default function NewsHome() {
  const { followedIds, toggleFollow, isFollowed } = useFollowedIssues();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // 넓은 화면에서는 이슈와 시간대를 주소에 남겨, 뒤로 가기와 공유가 되게 한다.
  const selectedIssueId = isMobile ? null : searchParams.get("issue");
  const selectedSection = isMobile ? null : searchParams.get("t");

  const selectIssue = (issueId: string) => {
    setSearchParams(
      issueId === selectedIssueId ? {} : { issue: issueId },
      { replace: false },
    );
  };

  const selectSection = (startTime: string | null) => {
    if (!selectedIssueId) return;
    setSearchParams(
      startTime ? { issue: selectedIssueId, t: startTime } : { issue: selectedIssueId },
      { replace: true },
    );
  };

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

  // 화면이 데이터를 받아온 시각이 아니라, 서버가 순위를 계산한 시각을 보여준다.
  // 점수는 기사를 수집할 때마다(15분 간격) 한꺼번에 다시 계산된다.
  const rankedAt = issues.reduce<string | null>(
    (latest, issue) =>
      !latest || issue.updated_at > latest ? issue.updated_at : latest,
    null,
  );
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
            <p
              className="mt-0.5 text-xs tabular-nums text-muted-foreground"
              title="이슈 순위를 계산한 시각입니다. 기사를 수집할 때마다(15분 간격) 다시 계산합니다."
            >
              {rankedAt
                ? `${formatFullDateTime(rankedAt)} 순위 기준`
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

      <main
        className={cn(
          "mx-auto px-4 py-5 transition-[max-width] duration-300",
          selectedIssueId ? "max-w-[1400px]" : "max-w-2xl",
        )}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          여러 언론사의 기사를 모아 같은 사건끼리 묶고, 지금 가장 크게 번지고 있는
          순서로 보여줍니다.
        </p>

        <div className="flex gap-5">
          <div
            className={cn(
              "min-w-0 transition-[width] duration-300",
              selectedIssueId ? "w-[340px] shrink-0" : "w-full",
            )}
          >
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
                    onSelect={isMobile ? undefined : () => selectIssue(issue.id)}
                    selected={selectedIssueId === issue.id}
                    compact={Boolean(selectedIssueId)}
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
                    onSelect={isMobile ? undefined : () => selectIssue(issue.id)}
                    selected={selectedIssueId === issue.id}
                    compact={Boolean(selectedIssueId)}
                  />
                </li>
              ))}
            </ol>
          </section>
        )}

          </div>

          {selectedIssueId && (
            <div className="min-w-0 flex-1">
              <IssuePreviewPanel
                issueId={selectedIssueId}
                selectedSection={selectedSection}
                onSelectSection={selectSection}
                followed={isFollowed(selectedIssueId)}
                onToggleFollow={() => toggleFollow(selectedIssueId)}
              />
            </div>
          )}

          {selectedIssueId && selectedSection && (
            <div className="hidden w-[380px] shrink-0 xl:block">
              <SectionArticlesPanel
                issueId={selectedIssueId}
                startTime={selectedSection}
              />
            </div>
          )}
        </div>

        <div className="mt-8 space-y-2 text-center text-xs text-muted-foreground">
          <p>기사 제목을 누르면 해당 언론사 원문으로 이동합니다.</p>
          <p className="flex items-center justify-center gap-3">
            <Link to="/score" className="underline hover:text-foreground">
              이슈 점수 설명
            </Link>
            <span aria-hidden>·</span>
            <Link to="/run" className="underline hover:text-foreground">
              AI 분석 실행
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
