import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { TrendBadge } from "./TrendBadge";
import { formatRelative } from "@/lib/newsTime";
import type { NewsIssue } from "@/types/news";

interface IssueCardProps {
  issue: NewsIssue;
  rank: number;
}

export function IssueCard({ issue, rank }: IssueCardProps) {
  return (
    <Link
      to={`/news/issue/${issue.id}`}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 active:bg-muted/60 sm:gap-4 sm:p-5"
    >
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

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground sm:text-lg">
            {issue.title}
          </h2>
          <TrendBadge trend={issue.trend} className="mt-0.5" />
        </div>

        {issue.description && (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {issue.description}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">
            기사 {issue.recent_article_count}건
          </span>
          <span aria-hidden>·</span>
          <span>{formatRelative(issue.last_article_at)} 업데이트</span>
        </div>
      </div>

      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
