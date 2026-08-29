// 뉴스 이슈 서비스 테이블 타입.
// supabase gen types typescript 로 다시 생성할 수 있다.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type IssueTrendValue = "surging" | "rising" | "steady" | "cooling";

export type Database = {
  public: {
    Tables: {
      news_sources: {
        Row: {
          id: string;
          name: string;
          feed_url: string;
          source_type: string;
          category: string | null;
          enabled: boolean;
          last_fetched_at: string | null;
          last_status: string | null;
          last_error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          feed_url: string;
          source_type?: string;
          category?: string | null;
          enabled?: boolean;
          last_fetched_at?: string | null;
          last_status?: string | null;
          last_error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          feed_url?: string;
          source_type?: string;
          category?: string | null;
          enabled?: boolean;
          last_fetched_at?: string | null;
          last_status?: string | null;
          last_error?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          title: string;
          publisher: string;
          published_at: string;
          url: string;
          summary: string | null;
          source_id: string | null;
          clustered_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          publisher: string;
          published_at: string;
          url: string;
          summary?: string | null;
          source_id?: string | null;
          clustered_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          publisher?: string;
          published_at?: string;
          url?: string;
          summary?: string | null;
          source_id?: string | null;
          clustered_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "articles_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "news_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      issues: {
        Row: {
          id: string;
          title: string;
          emoji: string | null;
          description: string | null;
          issue_score: number;
          article_count: number;
          recent_article_count: number;
          last_hour_count: number;
          prev_hour_count: number;
          trend: IssueTrendValue;
          last_article_at: string | null;
          timeline_built_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          emoji?: string | null;
          description?: string | null;
          issue_score?: number;
          article_count?: number;
          recent_article_count?: number;
          last_hour_count?: number;
          prev_hour_count?: number;
          trend?: IssueTrendValue;
          last_article_at?: string | null;
          timeline_built_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          emoji?: string | null;
          description?: string | null;
          issue_score?: number;
          article_count?: number;
          recent_article_count?: number;
          last_hour_count?: number;
          prev_hour_count?: number;
          trend?: IssueTrendValue;
          last_article_at?: string | null;
          timeline_built_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      issue_articles: {
        Row: {
          issue_id: string;
          article_id: string;
          created_at: string;
        };
        Insert: {
          issue_id: string;
          article_id: string;
          created_at?: string;
        };
        Update: {
          issue_id?: string;
          article_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "issue_articles_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "issue_articles_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: true;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      timeline_events: {
        Row: {
          id: string;
          issue_id: string;
          start_time: string;
          end_time: string;
          summary: string;
          article_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          issue_id: string;
          start_time: string;
          end_time: string;
          summary: string;
          article_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          issue_id?: string;
          start_time?: string;
          end_time?: string;
          summary?: string;
          article_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timeline_events_issue_id_fkey";
            columns: ["issue_id"];
            isOneToOne: false;
            referencedRelation: "issues";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      unclustered_articles: {
        Row: {
          id: string;
          title: string;
          publisher: string;
          published_at: string;
          url: string;
          summary: string | null;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      refresh_issue_scores: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      prune_old_news: {
        Args: { retain_days?: number };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
