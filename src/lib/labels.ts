import type { MetricDefinition, Stage, TimeStage, Verdict } from "./types";

export const STAGES: { key: Stage; label: string }[] = [
  { key: "idea", label: "아이디어" },
  { key: "plan", label: "기획" },
  { key: "script", label: "대본" },
  { key: "shoot", label: "촬영" },
  { key: "edit", label: "편집" },
  { key: "upload", label: "업로드" },
];

export const TIME_STAGE_LABEL: Record<TimeStage, string> = {
  idea: "아이디어",
  plan: "기획",
  script: "대본",
  shoot: "촬영",
  edit: "편집",
  upload: "업로드",
  routine: "반복 작업",
  other: "기타",
};

export const VERDICT: Record<Verdict, { label: string; tone: "neutral" | "accent" | "good" | "bad" | "warn" }> = {
  planned: { label: "계획", tone: "neutral" },
  running: { label: "진행 중", tone: "accent" },
  success: { label: "성공", tone: "good" },
  fail: { label: "실패", tone: "bad" },
  pending: { label: "판단 보류", tone: "warn" },
};

// supabase 마이그레이션의 metric_definitions 시드와 같은 내용
export const METRICS: Record<string, MetricDefinition> = Object.fromEntries(
  (
    [
      ["views", "조회수", "선택 기간 동안 영상이 조회된 횟수", "count", true, "views"],
      ["engaged_views", "참여 조회수", "첫 프레임을 넘겨 시청했거나 직접 재생한 조회", "count", true, "engagedViews"],
      ["watch_time_minutes", "시청 시간", "선택 기간 동안 시청된 총 시간", "minutes", true, "estimatedMinutesWatched"],
      ["avg_view_duration_sec", "평균 시청 시간", "재생 1회당 평균 시청 시간", "seconds", true, "averageViewDuration"],
      ["avg_view_percentage", "평균 시청 비율", "재생 1회당 영상 길이 대비 평균 시청 비율", "percent", true, "averageViewPercentage"],
      ["subscribers_gained", "구독자 증가", "구독한 횟수. 영상 단위로 보면 해당 영상 시청 페이지에서 생긴 것만 포함", "count", true, "subscribersGained"],
      ["subscribers_lost", "구독자 감소", "구독 취소 횟수. 영상 단위로 보면 해당 영상 시청 페이지에서 생긴 것만 포함", "count", true, "subscribersLost"],
      ["audience_watch_ratio", "시청 지속 비율", "영상의 특정 지점을 본 비율(되감기 시 1을 넘을 수 있음)", "ratio", true, "audienceWatchRatio"],
      ["relative_retention", "상대 시청 지속", "비슷한 길이의 영상 대비 시청 유지 수준(0~1, 0.5가 중간)", "ratio", true, "relativeRetentionPerformance"],
      ["impressions", "노출수", "썸네일이 시청자에게 표시된 횟수. API 제공 여부 확인 전까지 CSV로 관리", "count", false, null],
      ["impressions_ctr", "노출 클릭률", "노출 중 시청으로 이어진 비율. API 제공 여부 확인 전까지 CSV로 관리", "percent", false, null],
      ["subscriber_count", "총 구독자 수", "특정 시점의 채널 구독자 수", "count", true, null],
      ["monthly_revenue_krw", "월 제휴 수익", "세 플랫폼 확정 수익 합계(원)", "krw", false, null],
    ] as const
  ).map(([metric_key, label_ko, description, unit, api_available, api_name]) => [
    metric_key,
    { metric_key, label_ko, description, unit, api_available, api_name },
  ]),
);
