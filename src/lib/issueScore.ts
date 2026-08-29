import type { NewsIssue } from "@/types/news";

/**
 * 데이터베이스의 refresh_issue_scores() 와 같은 방식으로 점수를 나눠 계산한다.
 * 화면에서 "왜 이 순위인지" 보여주기 위한 것이라, 공식이 바뀌면 함께 고쳐야 한다.
 *
 *   기사량   = 12 × ln(1 + 최근 24시간 기사 수)
 *   증가속도 = clamp(-10, 30, 20 × ((최근1시간+1) / (직전1시간+1) − 1))
 *              × min(1, 최근1시간 / 3)
 *   최신성   = 30 × exp(−마지막 기사 이후 경과 시간(시간) / 6)
 */
export interface ScoreBreakdown {
  volume: number;
  velocity: number;
  freshness: number;
  total: number;
  hoursSinceLast: number | null;
}

export function scoreBreakdown(issue: NewsIssue): ScoreBreakdown {
  if (!issue.last_article_at) {
    return { volume: 0, velocity: 0, freshness: 0, total: 0, hoursSinceLast: null };
  }

  const hoursSinceLast = Math.max(
    0,
    (Date.now() - new Date(issue.last_article_at).getTime()) / 3_600_000,
  );

  const volume = 12 * Math.log(1 + issue.recent_article_count);

  const ratio =
    (issue.last_hour_count + 1) / (issue.prev_hour_count + 1) - 1;
  const confidence = Math.min(1, issue.last_hour_count / 3);
  const velocity = Math.max(-10, Math.min(30, 20 * ratio)) * confidence;

  const freshness = 30 * Math.exp(-hoursSinceLast / 6);

  return {
    volume,
    velocity,
    freshness,
    total: volume + velocity + freshness,
    hoursSinceLast,
  };
}

/** 누적 막대에 쓰는 색. 밝은 화면과 어두운 화면 모두에서 검증했다. */
export const SCORE_COLORS = {
  volume: "#3B82F6",
  velocity: "#D97706",
  freshness: "#0D9488",
} as const;

export const SCORE_PARTS = [
  {
    key: "volume" as const,
    label: "기사량",
    color: SCORE_COLORS.volume,
    short: "얼마나 많이 보도됐나",
    detail:
      "최근 24시간 동안 이 이슈로 묶인 기사 수입니다. 기사가 늘수록 점수가 오르지만, 10건에서 20건으로 늘 때보다 1건에서 10건으로 늘 때 더 크게 오릅니다.",
  },
  {
    key: "velocity" as const,
    label: "증가속도",
    color: SCORE_COLORS.velocity,
    short: "지금 갑자기 늘고 있나",
    detail:
      "최근 1시간 기사 수를 직전 1시간과 비교합니다. 지금이 오후 7시라면 6~7시와 5~6시를 견줍니다. 기사가 1~2건뿐인데 비율만 커 보이는 경우를 막으려고, 최근 1시간 기사가 3건이 될 때까지는 줄여서 반영합니다.",
  },
  {
    key: "freshness" as const,
    label: "최신성",
    color: SCORE_COLORS.freshness,
    short: "마지막 소식이 언제인가",
    detail:
      "마지막 기사 이후 시간이 지날수록 점수가 빠르게 떨어집니다. 6시간이 지나면 약 37%, 12시간이 지나면 약 14%만 남습니다. 기사가 아무리 많아도 소식이 끊기면 뒤로 밀립니다.",
  },
];
