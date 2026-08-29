import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  followed: boolean;
  onToggle: () => void;
  className?: string;
  withLabel?: boolean;
}

/** 관심 이슈로 담아두기. 순위가 밀려도 메인 화면 위쪽에서 계속 볼 수 있다. */
export function FollowButton({
  followed,
  onToggle,
  className,
  withLabel = false,
}: FollowButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={followed}
      aria-label={followed ? "팔로우 해제" : "이 이슈 팔로우"}
      title={followed ? "팔로우 해제" : "이 이슈 팔로우"}
      onClick={(event) => {
        // 카드 전체가 링크이므로 이동을 막는다.
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
        followed
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
        className,
      )}
    >
      <Star className={cn("h-3.5 w-3.5", followed && "fill-current")} />
      {withLabel && (followed ? "팔로우 중" : "팔로우")}
    </button>
  );
}
