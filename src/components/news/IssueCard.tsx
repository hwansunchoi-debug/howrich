import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendBadge } from "./TrendBadge";
import { FollowButton } from "./FollowButton";
import { formatDateTime } from "@/lib/newsTime";
import { issueEmoji } from "@/lib/issueEmoji";
import type { NewsIssue } from "@/types/news";

interface IssueCardProps {
  issue: NewsIssue;
  rank?: number;
  followed: boolean;
  onToggleFollow: () => void;
  /** 주면 이동 대신 이 함수를 부른다. (넓은 화면의 좌우 배치용) */
  onSelect?: () => void;
  selected?: boolean;
  /** 좁은 칸에 놓일 때 설명과 일부 지표를 줄인다. */
  compact?: boolean;
}

export function IssueCard({
  issue,
  rank,
  followed,
  onToggleFollow,
  onSelect,
  selected = false,
  compact = false,
}: IssueCardProps) {
  const className = cn(
    "group flex w-full items-start gap-3 rounded-xl border bg-card text-left transition-colors hover:border-primary/40 hover:bg-muted/40 active:bg-muted/60",
    compact ? "p-3" : "p-4 sm:gap-4 sm:p-5",
    selected ? "border-primary bg-primary/5" : "border-border",
  );

  const body = (
    <>
      {rank !== undefined && (
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${
            rank <= 3
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
          aria-hidden
        >
          {rank}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
            <h2
            className={cn(
              "min-w-0 flex-1 font-semibold leading-snug text-foreground",
              compact ? "text-sm" : "text-base sm:text-lg",
            )}
          >
            <span className="mr-1.5" aria-hidden>
              {issueEmoji(issue)}
            </span>
            {issue.title}
          </h2>
          <TrendBadge trend={issue.trend} className="mt-0.5" />
        </div>

        {issue.description && !compact && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {issue.description}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title="이 이슈로 묶인 전체 기사 수">
            <span aria-hidden>📰</span>
            전체{" "}
            <span className="font-medium tabular-nums text-foreground/80">
              {issue.article_count}건
            </span>
          </span>

          {!compact && (
            <span className="inline-flex items-center gap-1" title="최근 1시간 안에 들어온 기사 수">
              <span aria-hidden>⚡</span>
              최근 1시간{" "}
              <span className="font-medium tabular-nums text-foreground/80">
                {issue.last_hour_count}건
              </span>
            </span>
          )}

          <span className="inline-flex items-center gap-1" title="가장 최근 기사의 보도 시각">
            <span aria-hidden>🕒</span>
            <span className="tabular-nums">{formatDateTime(issue.last_article_at)}</span>
          </span>

          <span
            className="inline-flex items-center gap-1"
            title="최근 기사 수, 기사 증가 속도, 최신성으로 계산한 이슈 점수"
          >
            <span aria-hidden>🔥</span>
            점수{" "}
            <span className="font-medium tabular-nums text-foreground/80">
              {issue.issue_score.toFixed(1)}
            </span>
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <FollowButton followed={followed} onToggle={onToggleFollow} />
        <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={className}
      >
        {body}
      </button>
    );
  }

  return (
    <Link to={`/issue/${issue.id}`} className={className}>
      {body}
    </Link>
  );
}
