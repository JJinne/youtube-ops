// DB 스키마(supabase/migrations/20261025000000_init_schema.sql)와 같은 모양의 타입.
// 4단계에서 Supabase 타입 생성기로 교체할 수 있도록 컬럼 이름을 그대로 맞춘다.

export type DataSource = "api" | "csv" | "manual" | "sample";
export type ContentType = "short" | "long";
export type Stage = "idea" | "plan" | "script" | "shoot" | "edit" | "upload";
export type TimeStage = Stage | "routine" | "other";

export interface Video {
  id: string;
  youtube_video_id: string | null;
  title: string;
  published_at: string; // ISO
  duration_sec: number;
  content_type: ContentType;
  content_type_source: "api" | "duration" | "manual";
  source: DataSource;
  is_sample: boolean;
}

export interface ChannelDailyMetric {
  date: string; // YYYY-MM-DD
  views: number | null;
  watch_time_minutes: number | null;
  subscribers_gained: number | null;
  subscribers_lost: number | null;
  avg_view_duration_sec: number | null;
  source: DataSource;
  is_sample: boolean;
}

export interface VideoDailyMetric {
  video_id: string;
  date: string;
  days_since_publish: number;
  views: number | null;
  watch_time_minutes: number | null;
  avg_view_percentage: number | null;
  subscribers_gained: number | null;
  source: DataSource;
  is_sample: boolean;
}

export interface RetentionPoint {
  video_id: string;
  elapsed_ratio: number;
  audience_watch_ratio: number;
  relative_retention_performance: number;
}

export interface ManualMetric {
  video_id: string | null;
  metric_key: string;
  value: number;
  period_start: string;
  period_end: string;
  source: "csv" | "manual";
}

export interface MetricDefinition {
  metric_key: string;
  label_ko: string;
  description: string;
  unit: "count" | "minutes" | "seconds" | "percent" | "ratio" | "krw";
  api_available: boolean;
  api_name: string | null;
}

export interface Lecture {
  id: string;
  title: string;
  taken_on: string;
  topic: string;
  summary: string;
  tags: string[];
}

export interface Insight {
  id: string;
  lecture_id: string | null;
  content: string;
  action_idea: string;
  tags: string[];
  impact_note: string | null;
  status: "new" | "applied" | "archived";
  created_at: string;
  linked_video_ids: string[]; // insight_videos 연결
  linked_project_ids?: string[];
}

export interface VideoProject {
  id: string;
  title: string;
  content_type: ContentType;
  goal_id: string | null;
  stage: Stage;
  target_upload_date: string | null;
  video_id: string | null;
  week_start: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  routine_template_id: string | null;
  title: string;
  stage: Stage | null;
  due_date: string;
  completed_at: string | null;
  week_start: string;
  estimated_minutes: number | null;
  carried_from_task_id: string | null;
}

export interface TimeEntry {
  id: string;
  task_id: string | null;
  project_id: string | null;
  stage: TimeStage;
  source: "timer" | "manual";
  minutes: number;
  entry_date: string;
  week_start: string;
}

export interface WeeklyReview {
  week_start: string;
  went_well: string;
  to_improve: string;
  next_focus: string;
}

export type Verdict = "planned" | "running" | "success" | "fail" | "pending";

export interface Experiment {
  id: string;
  hypothesis: string;
  insight_id: string | null;
  video_id: string | null;
  goal_id: string | null;
  action_detail: string;
  metric_key: string;
  compare_days_since_publish: number;
  baseline_video_ids: string[]; // 기준 영상(같은 유형 이전 영상)
  verdict: Verdict;
  verdict_reason: string | null;
}

export interface AiObservation {
  kind: "observation" | "hypothesis" | "suggestion";
  text: string;
}

export interface AiAnalysis {
  id: string;
  scope: "channel" | "video" | "experiment" | "weekly";
  target_id: string | null;
  period_start: string;
  period_end: string;
  output: {
    items: AiObservation[];
    evidence_metrics: string[];
    confidence: "low" | "medium" | "high";
  };
  model: string;
  created_at: string;
}

export interface Priority {
  id: string;
  title: string;
  origin: "user" | "ai";
  ai_analysis_id: string | null;
  rank: 1 | 2 | 3;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  success_criteria: string;
  target_date: string;
  status: "active" | "achieved" | "paused" | "dropped";
  metric_key: string | null;
  target_value: number | null;
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  title: string;
  due_date: string;
  completed_at: string | null;
  sort_order: number;
}

export interface GoalNote {
  id: string;
  goal_id: string;
  body: string;
  created_at: string;
}

export type RevenuePlatform = "coupang_partners" | "naver_brand_connect" | "ohou_curator";

export interface RevenueEntry {
  id: string;
  platform: RevenuePlatform;
  entry_date: string;
  amount_krw: number;
  status: "expected" | "confirmed" | "paid";
  video_id: string | null;
  tracking_code: string | null;
  source: "csv" | "manual";
}

export interface SyncLog {
  job_type: "initial_backfill" | "daily" | "manual_refresh" | "retention";
  started_at: string;
  status: "running" | "success" | "partial" | "failed";
  rows_written: number;
  error_message: string | null;
}

/** 모든 조회 결과에 붙는 출처 정보. 화면 상단 배지와 카드 배지가 이것을 읽는다. */
export interface DataMeta {
  source: DataSource;
  connected: boolean;
  lastUpdatedAt: string | null;
}
