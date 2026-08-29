import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Clock, FileText, Flag, Newspaper } from "lucide-react";
import { ArticleList, IssueTimeline } from "@/components/news/IssueTimeline";
import { TrendBadge } from "@/components/news/TrendBadge";
import { FollowButton } from "@/components/news/FollowButton";
import { Skeleton } from "@/components/ui/skeleton";
import { useFollowedIssues } from "@/hooks/useFollowedIssues";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchIssueDetail } from "@/services/newsService";
import { formatHour, formatRelative } from "@/lib/newsTime";
import { issueEmoji, issueHeat } from "@/lib/issueEmoji";

export default function NewsIssueDetail() {
  const { issueId } = useParams<{ issueId: string }>();
  const { toggleFollow, isFollowed } = useFollowedIssues();
  const isMobile = useIsMobile();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["news", "issue", issueId],
    queryFn: () => fetchIssueDetail(issueId as string),
    enabled: Boolean(issueId),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // 넓은 화면에서는 가장 최근 시간대를 기본으로 열어 둔다.
  useEffect(() => {
    if (!data || data.sections.length === 0) return;
    setSelectedKey((current) =>
      current && data.sections.some((section) => section.startTime === current)
        ? current
        : isMobile
        ? null
        : data.sections[0].startTime,
    );
  }, [data, isMobile]);

  const selected =
    data?.sections.find((section) => section.startTime === selectedKey) ?? null;

  const heat = data ? issueHeat(data.issue.issue_score) : null;
  const publishers = data
    ? [...new Set(data.sections.flatMap((s) => s.articles.map((a) => a.publisher)))]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
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

      <main className="mx-auto max-w-5xl px-4 py-5">
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

        {data && heat && (
          <>
            {/* 이슈 머리말 */}
            <section className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background text-2xl shadow-sm ring-1 ring-border sm:h-14 sm:w-14 sm:text-3xl"
                  aria-hidden
                >
                  {issueEmoji(data.issue)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h1 className="min-w-0 flex-1 text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
                      {data.issue.title}
                    </h1>
                    <TrendBadge trend={data.issue.trend} className="mt-1.5" />
                  </div>

                  {data.issue.description && (
                    <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                      {data.issue.description}
                    </p>
                  )}

                  <div className="mt-3">
                    <FollowButton
                      followed={isFollowed(data.issue.id)}
                      onToggle={() => toggleFollow(data.issue.id)}
                      withLabel
                    />
                  </div>
                </div>
              </div>

              {/* 이슈 온도 */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {heat.emoji} 이슈 온도 · {heat.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {data.issue.issue_score.toFixed(1)}점
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all"
                    style={{ width: `${heat.percent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  최근 1시간 {data.issue.last_hour_count}건, 직전 1시간{" "}
                  {data.issue.prev_hour_count}건. 기사 수와 증가 속도, 최신성을 합해
                  계산합니다.{" "}
                  <Link to="/score" className="underline hover:text-foreground">
                    자세히
                  </Link>
                </p>
              </div>

              {/* 요약 지표 */}
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    icon: <FileText className="h-3.5 w-3.5" />,
                    label: "전체 기사",
                    value: `${data.issue.article_count}건`,
                  },
                  {
                    icon: <Newspaper className="h-3.5 w-3.5" />,
                    label: "언론사",
                    value: `${data.publisherCount}곳`,
                  },
                  {
                    icon: <Clock className="h-3.5 w-3.5" />,
                    label: "마지막 소식",
                    value: formatRelative(data.issue.last_article_at),
                  },
                  {
                    icon: <Flag className="h-3.5 w-3.5" />,
                    label: "최초 보도",
                    value: data.firstArticle
                      ? formatRelative(data.firstArticle.published_at)
                      : "-",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-background/70 p-3 text-center ring-1 ring-border"
                  >
                    <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      {stat.icon}
                      {stat.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {publishers.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {publishers.map((publisher) => (
                    <span
                      key={publisher}
                      className="rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border"
                    >
                      {publisher}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* 타임라인 + 기사 */}
            <section className="mt-7">
              <h2 className="mb-1 text-sm font-semibold text-foreground">
                🕒 기사 타임라인
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                {isMobile
                  ? "시간대를 누르면 그 시간대 기사가 펼쳐집니다."
                  : "왼쪽 시간대를 누르면 오른쪽에 원문 기사들이 나타납니다."}
              </p>

              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
                <div className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
                  <IssueTimeline
                    sections={data.sections}
                    firstArticleId={data.firstArticle?.id ?? null}
                    selectedKey={selectedKey}
                    onSelect={(key) =>
                      setSelectedKey((current) =>
                        isMobile && current === key ? null : key,
                      )
                    }
                    variant={isMobile ? "inline" : "split"}
                  />
                </div>

                {/* 넓은 화면에서만 오른쪽 칸을 쓴다 */}
                <div className="hidden lg:block">
                  <div className="sticky top-20 rounded-xl border border-border bg-card p-4">
                    {selected ? (
                      <>
                        <p className="text-sm font-semibold text-foreground">
                          {formatHour(selected.startTime)} · 기사{" "}
                          {selected.articleCount}건
                        </p>
                        {selected.summary && (
                          <p className="mt-1.5 rounded-lg bg-muted/60 p-3 text-sm leading-relaxed text-foreground/90">
                            {selected.summary}
                          </p>
                        )}
                        <div className="mt-3 max-h-[calc(100vh-20rem)] overflow-y-auto">
                          {selected.articles.length > 0 ? (
                            <ArticleList
                              articles={selected.articles}
                              firstArticleId={data.firstArticle?.id ?? null}
                            />
                          ) : (
                            <p className="py-6 text-center text-sm text-muted-foreground">
                              이 시간대의 기사 목록은 보관 기간이 지나 정리되었습니다.
                              <br />
                              요약은 그대로 남아 있습니다.
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        왼쪽에서 시간대를 선택하세요.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
