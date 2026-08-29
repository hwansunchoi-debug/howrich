export type IssueTrend = "surging" | "rising" | "steady" | "cooling";

export interface NewsIssue {
  id: string;
  title: string;
  description: string | null;
  issue_score: number;
  article_count: number;
  recent_article_count: number;
  last_hour_count: number;
  prev_hour_count: number;
  trend: IssueTrend;
  last_article_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  publisher: string;
  published_at: string;
  url: string;
  summary: string | null;
}

export interface TimelineEvent {
  id: string;
  issue_id: string;
  start_time: string;
  end_time: string;
  summary: string;
  article_count: number;
}

/** 타임라인 한 칸: 시간대 요약 + 그 시간대에 묶인 기사들 */
export interface TimelineSection {
  startTime: string;
  endTime: string;
  summary: string | null;
  articles: NewsArticle[];
}

export interface IssueDetail {
  issue: NewsIssue;
  sections: TimelineSection[];
  publisherCount: number;
}
