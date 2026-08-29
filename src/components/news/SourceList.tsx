import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchNewsSources } from "@/services/newsService";

/** 지금 기사를 받아오는 언론사 목록. 기본은 접혀 있다. */
export function SourceList() {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["news", "sources"],
    queryFn: fetchNewsSources,
    staleTime: 5 * 60_000,
  });

  if (!data || data.length === 0) return null;

  const working = data.filter((source) => source.status !== "error");
  const failing = data.filter((source) => source.status === "error");

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <span aria-hidden>📡</span>
        <span>
          <span className="font-medium text-foreground/80">
            언론사 {working.length}곳
          </span>
          에서 기사를 받아옵니다
        </span>
        <ChevronDown
          className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="flex flex-wrap gap-1.5">
            {working.map((source) => (
              <span
                key={source.name}
                className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border"
              >
                {source.name}
              </span>
            ))}
          </div>

          {failing.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              연결이 끊긴 곳: {failing.map((source) => source.name).join(", ")}
            </p>
          )}

          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            여기 없는 언론사의 단독 보도는 잡히지 않습니다. 이슈의 &ldquo;최초
            보도&rdquo;도 이 언론사들 중에서 가장 먼저 나온 기사를 말합니다.
          </p>
        </div>
      )}
    </div>
  );
}
