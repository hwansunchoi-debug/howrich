import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatClock, formatDay, formatHour, kstDateKey } from "@/lib/newsTime";
import type { TimelineSection } from "@/types/news";

interface IssueTimelineProps {
  sections: TimelineSection[];
}

/**
 * 시간대별 요약을 위에서 아래로 보여준다.
 * 시간대를 누르면 그 시간대에 묶인 기사 목록이 펼쳐진다.
 */
export function IssueTimeline({ sections }: IssueTimelineProps) {
  const [openKeys, setOpenKeys] = useState<string[]>(() =>
    sections.length > 0 ? [sections[0].startTime] : [],
  );

  const toggle = (key: string) =>
    setOpenKeys((keys) =>
      keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key],
    );

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
        const isOpen = openKeys.includes(section.startTime);
        const isLast = index === sections.length - 1;
        const showDate =
          index === 0 ||
          kstDateKey(section.startTime) !== kstDateKey(sections[index - 1].startTime);

        return (
          <li key={section.startTime}>
            {showDate && (
              <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground first:mt-0">
                {formatDay(section.startTime)}
              </p>
            )}

            <div className="relative pl-7">
              {/* 세로선 + 점 */}
              {!isLast && (
                <span
                  className="absolute left-[9px] top-6 h-[calc(100%-0.5rem)] w-px bg-border"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "absolute left-1.5 top-4 h-2.5 w-2.5 rounded-full ring-4 ring-background",
                  index === 0 ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />

              <button
                type="button"
                onClick={() => toggle(section.startTime)}
                aria-expanded={isOpen}
                className="w-full rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start gap-2">
                  <span className="w-14 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-foreground">
                    {formatHour(section.startTime)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-relaxed text-foreground/90">
                    {section.summary ?? (
                      <span className="text-muted-foreground">
                        요약 준비 중 · 기사 {section.articles.length}건
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                </div>
                <p className="mt-1 pl-16 text-xs text-muted-foreground">
                  기사 {section.articles.length}건
                </p>
              </button>

              {isOpen && (
                <ul className="mb-2 ml-2 space-y-1 border-l-2 border-muted pl-3">
                  {section.articles.map((article) => (
                    <li key={article.id}>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-foreground">
                            {article.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {article.publisher}
                            <span className="mx-1" aria-hidden>·</span>
                            {formatClock(article.published_at)}
                          </p>
                        </div>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
