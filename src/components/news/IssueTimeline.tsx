import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, formatDay, formatHour, kstDateKey } from "@/lib/newsTime";
import type { NewsArticle, TimelineSection } from "@/types/news";

interface IssueTimelineProps {
  sections: TimelineSection[];
  /** 이 이슈를 가장 먼저 보도한 기사 id */
  firstArticleId?: string | null;
  /** 지금 선택된 시간대 (없으면 아무것도 선택되지 않은 상태) */
  selectedKey: string | null;
  onSelect: (startTime: string) => void;
  /** split: 기사가 오른쪽 칸에 뜬다 / inline: 눌린 시간대 아래로 펼쳐진다 */
  variant: "split" | "inline";
}

/** 시간대별 요약을 최신순으로 보여준다. */
export function IssueTimeline({
  sections,
  firstArticleId,
  selectedKey,
  onSelect,
  variant,
}: IssueTimelineProps) {
  if (sections.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        아직 정리된 타임라인이 없습니다.
      </p>
    );
  }

  return (
    <ol className="relative space-y-1">
      {sections.map((section, index) => {
        const isSelected = selectedKey === section.startTime;
        const isLast = index === sections.length - 1;
        const showDate =
          index === 0 ||
          kstDateKey(section.startTime) !== kstDateKey(sections[index - 1].startTime);
        const hasFirst =
          Boolean(firstArticleId) &&
          section.articles.some((article) => article.id === firstArticleId);

        return (
          <li key={section.startTime}>
            {showDate && (
              <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground first:mt-0">
                {formatDay(section.startTime)}
              </p>
            )}

            <div className="relative pl-7">
              {!isLast && (
                <span
                  className="absolute left-[9px] top-6 h-[calc(100%-0.5rem)] w-px bg-border"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "absolute left-1.5 top-4 h-2.5 w-2.5 rounded-full ring-4 ring-background transition-colors",
                  isSelected ? "bg-primary" : index === 0 ? "bg-primary/50" : "bg-border",
                )}
                aria-hidden
              />

              <button
                type="button"
                onClick={() => onSelect(section.startTime)}
                aria-expanded={variant === "inline" ? isSelected : undefined}
                aria-current={variant === "split" && isSelected ? "true" : undefined}
                className={cn(
                  "w-full rounded-lg px-2 py-3 text-left transition-colors",
                  isSelected ? "bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="w-14 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-foreground">
                    {formatHour(section.startTime)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-relaxed text-foreground/90">
                    {section.summary ?? (
                      <span className="text-muted-foreground">
                        요약 준비 중 · 기사 {section.articleCount}건
                      </span>
                    )}
                  </span>
                  {variant === "inline" && (
                    <ChevronDown
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isSelected && "rotate-180",
                      )}
                    />
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 pl-16 text-xs text-muted-foreground">
                  기사 {section.articleCount}건
                  {hasFirst && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                      🚩 최초 보도
                    </span>
                  )}
                </p>
              </button>

              {variant === "inline" && isSelected && (
                <div className="mb-2 ml-2 border-l-2 border-muted pl-3">
                  {section.articles.length > 0 ? (
                    <ArticleList
                      articles={section.articles}
                      firstArticleId={firstArticleId}
                    />
                  ) : (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      이 시간대의 기사 목록은 보관 기간이 지나 정리되었습니다.
                      요약은 그대로 남아 있습니다.
                    </p>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** 시간대에 묶인 기사 목록. 제목을 누르면 언론사 원문으로 이동한다. */
export function ArticleList({
  articles,
  firstArticleId,
}: {
  articles: NewsArticle[];
  firstArticleId?: string | null;
}) {
  return (
    <ul className="space-y-1">
      {articles.map((article) => (
        <li key={article.id}>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
          >
            <div className="min-w-0 flex-1">
              {article.id === firstArticleId && (
                <p className="mb-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  🚩 이 이슈의 최초 보도
                </p>
              )}
              <p className="text-sm leading-snug text-foreground">{article.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                  {article.publisher}
                </span>
                {formatClock(article.published_at)}
              </p>
            </div>
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          </a>
        </li>
      ))}
    </ul>
  );
}
