import { Flame, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IssueTrend } from "@/types/news";

interface TrendBadgeProps {
  trend: IssueTrend;
  className?: string;
}

/** 지금 빠르게 관심이 늘고 있는 이슈만 표시한다. (조용한 이슈는 배지를 달지 않는다) */
export function TrendBadge({ trend, className }: TrendBadgeProps) {
  if (trend !== "surging" && trend !== "rising") return null;

  const isSurging = trend === "surging";
  const Icon = isSurging ? Flame : TrendingUp;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isSurging
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {isSurging ? "급상승" : "상승"}
    </span>
  );
}
