import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Clock, FileText, Newspaper } from "lucide-react";
import { IssueTimeline } from "@/components/news/IssueTimeline";
import { TrendBadge } from "@/components/news/TrendBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchIssueDetail } from "@/services/newsService";
import { formatRelative } from "@/lib/newsTime";

export default function NewsIssueDetail() {
  const { issueId } = useParams<{ issueId: string }>();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["news", "issue", issueId],
    queryFn: () => fetchIssueDetail(issueId as string),
    enabled: Boolean(issueId),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link
            to="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
            aria-label="이슈 목록으로"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="truncate text-sm font-medium text-muted-foreground">
            지금 대한민국
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-6 h-40 w-full" />
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
              <Link to="/" className="mt-3 inline-block text-primary underline">
                이슈 목록으로 돌아가기
              </Link>
            </div>
          </div>
        )}

        {data && (
          <>
            <div className="flex items-start gap-2">
              <h1 className="min-w-0 flex-1 text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
                {data.issue.title}
              </h1>
              <TrendBadge trend={data.issue.trend} className="mt-1.5" />
            </div>

            {data.issue.description && (
              <p className="mt-3 rounded-xl bg-muted/60 p-4 text-sm leading-relaxed text-foreground/90">
                {data.issue.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                기사 {data.issue.article_count}건
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Newspaper className="h-3.5 w-3.5" />
                언론사 {data.publisherCount}곳
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatRelative(data.issue.last_article_at)} 업데이트
              </span>
            </div>

            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                기사 타임라인
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                시간대별 요약만 훑어봐도 흐름을 파악할 수 있습니다. 시간대를 누르면
                해당 기사 목록이 열립니다.
              </p>
              <IssueTimeline sections={data.sections} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
