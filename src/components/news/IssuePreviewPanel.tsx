import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, FileText, Newspaper } from "lucide-react";
import { ArticleList, IssueTimeline } from "./IssueTimeline";
import { TrendBadge } from "./TrendBadge";
import { FollowButton } from "./FollowButton";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchIssueDetail } from "@/services/newsService";
import { formatDateTime, formatHour } from "@/lib/newsTime";
import { issueEmoji, issueHeat } from "@/lib/issueEmoji";

interface IssuePreviewPanelProps {
  issueId: string;
  selectedSection: string | null;
  onSelectSection: (startTime: string | null) => void;
  followed: boolean;
  onToggleFollow: () => void;
}

/**
 * 메인 화면 가운데 칸.
 * 고른 이슈의 요약과 시간대별 타임라인을 보여준다.
 */
export function IssuePreviewPanel({
  issueId,
  selectedSection,
  onSelectSection,
  followed,
  onToggleFollow,
}: IssuePreviewPanelProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["news", "issue", issueId],
    queryFn: () => fetchIssueDetail(issueId),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // 이슈를 바꾸면 가장 최근 시간대를 열어 둔다.
  useEffect(() => {
    if (!data || data.sections.length === 0) return;
    const exists = data.sections.some(
      (section) => section.startTime === selectedSection,
    );
    if (!exists) onSelectSection(data.sections[0].startTime);
    // 이슈가 바뀔 때만 맞춘다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
        {error instanceof Error ? error.message : "이슈를 불러오지 못했습니다."}
      </div>
    );
  }

  const heat = issueHeat(data.issue.issue_score);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {issueEmoji(data.issue)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 text-lg font-bold leading-snug text-foreground">
              {data.issue.title}
            </h2>
            <TrendBadge trend={data.issue.trend} className="mt-1" />
          </div>
          {data.issue.description && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {data.issue.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <Link
          to={`/issue/${data.issue.id}/articles`}
          className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          전체 {data.issue.article_count}건
        </Link>
        <Link
          to={`/issue/${data.issue.id}/articles?by=publisher`}
          className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
        >
          <Newspaper className="h-3.5 w-3.5" />
          언론사 {data.publisherCount}곳
        </Link>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Clock className="h-3.5 w-3.5" />
          {formatDateTime(data.issue.last_article_at)}
        </span>
        <span className="inline-flex items-center gap-1">
          {heat.emoji} {heat.label} · {data.issue.issue_score.toFixed(1)}점
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <FollowButton followed={followed} onToggle={onToggleFollow} withLabel />
        <Link
          to={`/issue/${data.issue.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          이슈 페이지로
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <h3 className="mb-1 mt-5 text-xs font-semibold text-foreground">
        🕒 기사 타임라인
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        시간대를 누르면 오른쪽에 기사가 나옵니다.
      </p>
      <div className="max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
        <IssueTimeline
          sections={data.sections}
          firstArticleId={data.firstArticle?.id ?? null}
          selectedKey={selectedSection}
          onSelect={onSelectSection}
          variant="split"
        />
      </div>
    </div>
  );
}

interface SectionArticlesPanelProps {
  issueId: string;
  startTime: string;
}

/** 메인 화면 오른쪽 칸. 고른 시간대의 요약과 원문 기사들. */
export function SectionArticlesPanel({
  issueId,
  startTime,
}: SectionArticlesPanelProps) {
  const { data } = useQuery({
    queryKey: ["news", "issue", issueId],
    queryFn: () => fetchIssueDetail(issueId),
    staleTime: 30_000,
  });

  const section = data?.sections.find((item) => item.startTime === startTime);

  if (!section) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        시간대를 선택하세요.
      </div>
    );
  }

  return (
    <div className="sticky top-24 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">
        {formatHour(section.startTime)} · 기사 {section.articleCount}건
      </p>
      {section.summary && (
        <p className="mt-1.5 rounded-lg bg-muted/60 p-3 text-sm leading-relaxed text-foreground/90">
          {section.summary}
        </p>
      )}
      <div className="mt-3 max-h-[calc(100vh-20rem)] overflow-y-auto">
        {section.articles.length > 0 ? (
          <ArticleList
            articles={section.articles}
            firstArticleId={data?.firstArticle?.id ?? null}
          />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            이 시간대의 기사 목록은 보관 기간이 지나 정리되었습니다.
          </p>
        )}
      </div>
    </div>
  );
}
