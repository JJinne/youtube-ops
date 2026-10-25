// =====================================================================
// 샘플 데이터 (실제 채널과 무관)
// - YouTube 연결 전 화면을 채우기 위한 가짜 데이터다. 모든 행은 source "sample" / is_sample true.
// - 고정 시드 난수를 써서 새로고침해도 같은 값이 나온다.
// - 기준일은 2026-10-25(일)이고, 지표는 전날 10-24까지 있다.
// =====================================================================

import { addDays, diffDays, range, weekStartOf } from "./dates";
import type {
  AiAnalysis,
  ChannelDailyMetric,
  Experiment,
  Goal,
  GoalMilestone,
  GoalNote,
  Insight,
  Lecture,
  ManualMetric,
  Priority,
  RetentionPoint,
  RevenueEntry,
  RevenuePlatform,
  Task,
  TimeEntry,
  Video,
  VideoDailyMetric,
  VideoProject,
  WeeklyReview,
} from "./types";

export const SAMPLE_TODAY = "2026-10-25";
export const SAMPLE_LAST_DATA_DATE = "2026-10-24";
const CHANNEL_START = "2026-06-21";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261025);
const between = (lo: number, hi: number) => lo + (hi - lo) * rand();

// ---------------------------------------------------------------------
// 영상
// ---------------------------------------------------------------------
const LONG_TITLES = [
  "주방 상부장 수납, 3단계로 끝내기",
  "10분 욕실 청소 루틴 (곰팡이 예방까지)",
  "냉장고 정리: 식재료 버리는 양 절반으로",
  "옷장 정리 전후, 계절 바꿈 한 번에",
  "살림 초보가 처음 산 청소도구 7가지",
  "베란다 창고 정리, 버린 것과 남긴 것",
  "아이 방 장난감 수납 시스템 만들기",
  "일주일 식단과 장보기 리스트 짜는 법",
  "현관 신발장 정리와 냄새 잡기",
  "세탁실 동선 바꾸고 달라진 점",
  "다이소 수납템 실사용 3개월 후기",
  "주말 대청소 체크리스트 공개",
  "살림 기록 노트 쓰는 법",
  "거실 물건 줄이기 30일 챌린지 결과",
];
const SHORT_TITLES = [
  "싱크대 배수구 10초 청소",
  "수건 호텔식으로 개는 법",
  "냉동실 지퍼백 세워 보관",
  "전자레인지 레몬 청소",
  "양말 짝 안 잃어버리는 법",
  "도마 냄새 없애기",
  "옷걸이 하나로 스카프 정리",
  "욕실 거울 물때 없이 닦기",
  "냉장고 문 칸 정리 1분",
  "베이킹소다 하수구 청소",
  "밀폐용기 뚜껑 세로 수납",
  "이불 접어서 부피 줄이기",
  "가스레인지 기름때 한 번에",
  "충전선 엉키지 않게 보관",
  "창틀 먼지 휴지심으로",
  "신발 냄새 커피 찌꺼기",
  "행주 삶지 않고 소독",
  "세탁기 고무패킹 곰팡이",
];

export const videos: Video[] = [];
LONG_TITLES.forEach((title, i) => {
  const published = addDays("2026-10-22", -8 * i - Math.floor(rand() * 2));
  videos.push({
    id: `v-long-${i + 1}`,
    youtube_video_id: null,
    title,
    published_at: `${published}T10:00:00+09:00`,
    duration_sec: Math.round(between(8, 16) * 60),
    content_type: "long",
    content_type_source: "duration",
    source: "sample",
    is_sample: true,
  });
});
SHORT_TITLES.forEach((title, i) => {
  const published = addDays("2026-10-24", -6 * i - Math.floor(rand() * 3));
  videos.push({
    id: `v-short-${i + 1}`,
    youtube_video_id: null,
    title,
    published_at: `${published}T19:00:00+09:00`,
    duration_sec: Math.round(between(28, 58)),
    content_type: "short",
    content_type_source: "duration",
    source: "sample",
    is_sample: true,
  });
});
// 제작 기록(프로젝트)과 연결된 영상은 업로드일을 고정해 주간 시간 비교가 맞게 한다
const FIXED_PUBLISH: Record<string, string> = {
  "v-long-1": "2026-10-22",
  "v-long-2": "2026-10-14",
  "v-short-1": "2026-10-24",
  "v-short-2": "2026-10-19",
  "v-short-3": "2026-10-13",
};
for (const v of videos) {
  const fixed = FIXED_PUBLISH[v.id];
  if (fixed) v.published_at = `${fixed}${v.published_at.slice(10)}`;
}
videos.sort((a, b) => b.published_at.localeCompare(a.published_at));

// 영상별 품질 계수 (성과 편차). 실험·인사이트 기록과 맞아야 하는 영상은 고정
const FIXED_QUALITY: Record<string, number> = { "v-long-1": 1.35, "v-long-2": 1.5, "v-long-3": 1.3, "v-short-3": 1.2 };
const quality = new Map<string, number>(videos.map((v) => [v.id, FIXED_QUALITY[v.id] ?? between(0.55, 1.4)]));

// ---------------------------------------------------------------------
// 영상 일별 지표
// ---------------------------------------------------------------------
export const videoDailyMetrics: VideoDailyMetric[] = [];
for (const v of videos) {
  const q = quality.get(v.id)!;
  const pub = v.published_at.slice(0, 10);
  const isLong = v.content_type === "long";
  const avgPct = isLong ? Math.min(62, Math.max(24, 40 + 14 * (q - 1) + between(-4, 4))) : Math.min(105, Math.max(55, 78 + 16 * (q - 1) + between(-6, 6)));
  for (const date of range(pub, SAMPLE_LAST_DATA_DATE)) {
    const d = diffDays(date, pub);
    const curve = isLong ? 1300 * Math.exp(-d / 2.4) + 55 * Math.exp(-d / 45) : 2600 * Math.exp(-d / 1.4) + 70 * Math.exp(-d / 30);
    const firstDay = d === 0 ? (isLong ? 0.55 : 0.35) : 1;
    const views = Math.max(0, Math.round(q * curve * firstDay * between(0.85, 1.15)));
    const pctDay = avgPct * between(0.95, 1.05);
    videoDailyMetrics.push({
      video_id: v.id,
      date,
      days_since_publish: d,
      views,
      watch_time_minutes: Math.round((views * (v.duration_sec / 60) * pctDay) / 100),
      avg_view_percentage: Math.round(pctDay * 10) / 10,
      subscribers_gained: Math.round(views * (isLong ? 0.0045 : 0.0016) * q * between(0.7, 1.3)),
      source: "sample",
      is_sample: true,
    });
  }
}

// ---------------------------------------------------------------------
// 채널 일별 지표 (영상 합계 + 기존 영상 꼬리 조회)
// ---------------------------------------------------------------------
const byDate = new Map<string, { views: number; minutes: number; subs: number }>();
for (const m of videoDailyMetrics) {
  const cur = byDate.get(m.date) ?? { views: 0, minutes: 0, subs: 0 };
  cur.views += m.views ?? 0;
  cur.minutes += m.watch_time_minutes ?? 0;
  cur.subs += m.subscribers_gained ?? 0;
  byDate.set(m.date, cur);
}
export const channelDailyMetrics: ChannelDailyMetric[] = range(CHANNEL_START, SAMPLE_LAST_DATA_DATE).map((date) => {
  const base = byDate.get(date) ?? { views: 0, minutes: 0, subs: 0 };
  const tail = Math.round(between(180, 320));
  const views = base.views + tail;
  const minutes = base.minutes + Math.round(tail * 3.1);
  const gained = base.subs + Math.round(between(1, 5));
  return {
    date,
    views,
    watch_time_minutes: minutes,
    subscribers_gained: gained,
    subscribers_lost: Math.round(gained * between(0.15, 0.35)),
    avg_view_duration_sec: Math.round((minutes * 60) / Math.max(views, 1)),
    source: "sample",
    is_sample: true,
  };
});

export const SAMPLE_SUBSCRIBERS_BEFORE_START = 4820;

// ---------------------------------------------------------------------
// 시청 지속 곡선 (일반 영상만)
// ---------------------------------------------------------------------
export const retention: RetentionPoint[] = [];
for (const v of videos.filter((x) => x.content_type === "long")) {
  const q = quality.get(v.id)!;
  for (let i = 0; i <= 20; i++) {
    const r = i / 20;
    const hook = 0.3 * (1 - Math.exp(-r / 0.06)) * (1.25 - 0.25 * q);
    const slow = 0.38 * r * (1.2 - 0.2 * q);
    const end = r > 0.9 ? (r - 0.9) * 1.2 : 0;
    retention.push({
      video_id: v.id,
      elapsed_ratio: r,
      audience_watch_ratio: Math.max(0.05, Math.round((1 - hook - slow - end) * 1000) / 1000),
      relative_retention_performance: Math.min(0.95, Math.max(0.08, Math.round((0.5 + 0.18 * (q - 1) + (r < 0.1 ? -0.05 : 0.02) + between(-0.03, 0.03)) * 100) / 100)),
    });
  }
}

// ---------------------------------------------------------------------
// CSV로 들어왔다고 가정한 노출수 · 노출 클릭률 (최근 28일, 일반 영상)
// ---------------------------------------------------------------------
const CSV_START = "2026-09-27";
export const manualMetrics: ManualMetric[] = [];
for (const v of videos.filter((x) => x.content_type === "long")) {
  const q = quality.get(v.id)!;
  const views = videoDailyMetrics
    .filter((m) => m.video_id === v.id && m.date >= CSV_START)
    .reduce((s, m) => s + (m.views ?? 0), 0);
  if (views === 0) continue;
  const ctr = Math.round(Math.min(9.5, Math.max(1.8, 4.2 + 2.6 * (q - 1) + between(-0.6, 0.6))) * 10) / 10;
  manualMetrics.push(
    { video_id: v.id, metric_key: "impressions_ctr", value: ctr, period_start: CSV_START, period_end: SAMPLE_LAST_DATA_DATE, source: "csv" },
    { video_id: v.id, metric_key: "impressions", value: Math.round((views * 0.62) / (ctr / 100)), period_start: CSV_START, period_end: SAMPLE_LAST_DATA_DATE, source: "csv" },
  );
}

// ---------------------------------------------------------------------
// 강의 · 인사이트
// ---------------------------------------------------------------------
export const lectures: Lecture[] = [
  { id: "lec-1", title: "썸네일과 제목으로 클릭률 올리기", taken_on: "2026-10-21", topic: "유튜브 기획", summary: "썸네일은 '결과'를 먼저 보여 주고, 제목은 썸네일이 말하지 않은 것을 보탠다. 글자는 3~5단어, 한 화면에 시선이 머무는 지점은 하나.", tags: ["썸네일", "클릭률", "제목"] },
  { id: "lec-2", title: "첫 30초 이탈을 줄이는 오프닝 구조", taken_on: "2026-10-14", topic: "유튜브 편집", summary: "오프닝에서 영상의 결과물을 먼저 보여 주고 과정을 약속한다. 인사와 채널 소개는 결과 뒤로 미룬다.", tags: ["시청 지속", "편집", "오프닝"] },
  { id: "lec-3", title: "비즈니스PT 3주차: 고객 문제 정의", taken_on: "2026-10-08", topic: "비즈니스PT", summary: "고객이 돈을 내는 이유는 기능이 아니라 해결되는 불편이다. 콘텐츠도 시청자가 겪는 구체적인 불편 한 가지에서 출발한다.", tags: ["비즈니스PT", "타깃", "기획"] },
  { id: "lec-4", title: "비즈니스PT 4주차: 협업 제안서 쓰기", taken_on: "2026-10-15", topic: "비즈니스PT", summary: "제안서는 상대가 얻는 것부터 쓴다. 내 채널 지표는 상대 시청자와 겹치는 부분만 골라 근거로 쓴다.", tags: ["비즈니스PT", "협업", "제안서"] },
  { id: "lec-5", title: "쇼츠에서 일반 영상으로 시청자 넘기기", taken_on: "2026-09-30", topic: "유튜브 성장", summary: "쇼츠 끝에 일반 영상과 이어지는 질문을 남기고, 고정 댓글과 관련 영상 링크로 연결한다.", tags: ["쇼츠", "구독", "연결"] },
];

export const insights: Insight[] = [
  { id: "ins-1", lecture_id: "lec-1", content: "썸네일에 정리 '후' 사진을 크게 쓰고 '전' 사진은 작게", action_idea: "다음 일반 영상 2편에 전후 비교 썸네일 적용", tags: ["썸네일", "클릭률"], impact_note: null, status: "applied", created_at: "2026-10-21", linked_video_ids: ["v-long-1"] },
  { id: "ins-2", lecture_id: "lec-1", content: "제목에 숫자와 소요 시간을 넣으면 기대치가 분명해진다", action_idea: "제목 템플릿: [결과] + [시간/단계 수]", tags: ["제목"], impact_note: null, status: "new", created_at: "2026-10-22", linked_video_ids: [] },
  { id: "ins-3", lecture_id: "lec-2", content: "오프닝 5초 안에 완성된 모습을 보여 준다", action_idea: "편집 체크리스트에 '결과 컷 먼저' 추가", tags: ["시청 지속", "오프닝"], impact_note: "적용한 2편의 초반 10% 구간 시청 지속 비율이 이전 3편 중간값보다 높았음 (샘플)", status: "applied", created_at: "2026-10-14", linked_video_ids: ["v-long-2", "v-long-3"] },
  { id: "ins-4", lecture_id: "lec-2", content: "채널 인사는 결과 컷 뒤 10초 이내로 줄인다", action_idea: "인트로 템플릿 다시 만들기", tags: ["오프닝"], impact_note: null, status: "new", created_at: "2026-10-15", linked_video_ids: [] },
  { id: "ins-5", lecture_id: "lec-3", content: "'정리'가 아니라 '찾는 시간 줄이기'라는 불편으로 말한다", action_idea: "다음 기획 3개를 불편 문장으로 다시 쓰기", tags: ["기획", "타깃"], impact_note: null, status: "new", created_at: "2026-10-08", linked_video_ids: [] },
  { id: "ins-6", lecture_id: "lec-4", content: "협업 제안서 첫 장은 상대 채널 시청자가 얻는 것", action_idea: "출연 제안서 초안에 반영", tags: ["협업", "제안서"], impact_note: null, status: "applied", created_at: "2026-10-16", linked_video_ids: [] },
  { id: "ins-7", lecture_id: "lec-4", content: "내 지표 중 상대 시청자와 겹치는 것만 근거로 쓴다", action_idea: "30~40대 비율, 살림 주제 평균 시청 비율 정리", tags: ["협업"], impact_note: null, status: "new", created_at: "2026-10-16", linked_video_ids: [] },
  { id: "ins-8", lecture_id: "lec-5", content: "쇼츠 마지막 컷에 일반 영상과 이어지는 질문 남기기", action_idea: "쇼츠 3편에 적용 후 구독 증가 비교", tags: ["쇼츠", "구독"], impact_note: null, status: "applied", created_at: "2026-09-30", linked_video_ids: ["v-short-2", "v-short-3"] },
  { id: "ins-9", lecture_id: "lec-5", content: "고정 댓글에 관련 일반 영상 링크", action_idea: "업로드 체크리스트에 추가", tags: ["쇼츠", "연결"], impact_note: null, status: "new", created_at: "2026-10-01", linked_video_ids: [] },
];

// ---------------------------------------------------------------------
// 제작 · 루틴 · 시간 기록 (3주: 10.11, 10.18, 이번 주 10.25)
// ---------------------------------------------------------------------
export const CURRENT_WEEK = weekStartOf(SAMPLE_TODAY); // 2026-10-25
export const LAST_WEEK = addDays(CURRENT_WEEK, -7);
const TWO_WEEKS_AGO = addDays(CURRENT_WEEK, -14);

export const projects: VideoProject[] = [
  { id: "p-1", title: "현관 정리 비포 애프터", content_type: "long", goal_id: "g-1", stage: "edit", target_upload_date: "2026-10-29", video_id: null, week_start: CURRENT_WEEK },
  { id: "p-2", title: "행주 보관 30초 팁", content_type: "short", goal_id: null, stage: "script", target_upload_date: "2026-10-31", video_id: null, week_start: CURRENT_WEEK },
  { id: "p-3", title: "출연 제안용 대표 영상: 살림 동선 투어", content_type: "long", goal_id: "g-1", stage: "plan", target_upload_date: "2026-11-05", video_id: null, week_start: CURRENT_WEEK },
  { id: "p-4", title: "겨울 이불 보관법", content_type: "short", goal_id: null, stage: "idea", target_upload_date: null, video_id: null, week_start: CURRENT_WEEK },
  { id: "p-5", title: "수납 바구니 고르는 기준", content_type: "long", goal_id: null, stage: "idea", target_upload_date: null, video_id: null, week_start: CURRENT_WEEK },
  // 지난주 완료
  { id: "p-6", title: LONG_TITLES[0], content_type: "long", goal_id: null, stage: "upload", target_upload_date: "2026-10-22", video_id: "v-long-1", week_start: LAST_WEEK },
  { id: "p-7", title: SHORT_TITLES[0], content_type: "short", goal_id: null, stage: "upload", target_upload_date: "2026-10-24", video_id: "v-short-1", week_start: LAST_WEEK },
  { id: "p-8", title: SHORT_TITLES[1], content_type: "short", goal_id: null, stage: "upload", target_upload_date: "2026-10-19", video_id: "v-short-2", week_start: LAST_WEEK },
  // 2주 전 완료
  { id: "p-9", title: LONG_TITLES[1], content_type: "long", goal_id: null, stage: "upload", target_upload_date: "2026-10-14", video_id: "v-long-2", week_start: TWO_WEEKS_AGO },
  { id: "p-10", title: SHORT_TITLES[2], content_type: "short", goal_id: null, stage: "upload", target_upload_date: "2026-10-13", video_id: "v-short-3", week_start: TWO_WEEKS_AGO },
];

export const routineTemplates = [
  { id: "rt-1", title: "주간 기획 회의(혼자)", weekday: 0, stage: "plan" as const },
  { id: "rt-2", title: "강의 내용 정리", weekday: 1, stage: null },
  { id: "rt-3", title: "댓글 확인·답글", weekday: 3, stage: null },
  { id: "rt-4", title: "주간 회고", weekday: 6, stage: null },
];

let taskSeq = 0;
function task(p: Partial<Task> & { title: string; due_date: string }): Task {
  taskSeq += 1;
  return {
    id: `t-${taskSeq}`,
    project_id: null,
    routine_template_id: null,
    stage: null,
    completed_at: null,
    week_start: weekStartOf(p.due_date),
    estimated_minutes: null,
    carried_from_task_id: null,
    ...p,
  };
}

export const tasks: Task[] = [
  // 이번 주 (오늘은 일요일)
  task({ title: "주간 기획 회의(혼자)", routine_template_id: "rt-1", stage: "plan", due_date: "2026-10-25", completed_at: "2026-10-25T10:40:00+09:00", estimated_minutes: 60 }),
  task({ title: "현관 정리 컷 편집 마무리", project_id: "p-1", stage: "edit", due_date: "2026-10-25", estimated_minutes: 180, carried_from_task_id: "t-18" }),
  task({ title: "강의 내용 정리", routine_template_id: "rt-2", due_date: "2026-10-26", estimated_minutes: 40 }),
  task({ title: "행주 보관 쇼츠 대본", project_id: "p-2", stage: "script", due_date: "2026-10-26", estimated_minutes: 30 }),
  task({ title: "현관 정리 썸네일 2안", project_id: "p-1", stage: "edit", due_date: "2026-10-27", estimated_minutes: 60 }),
  task({ title: "행주 보관 쇼츠 촬영", project_id: "p-2", stage: "shoot", due_date: "2026-10-27", estimated_minutes: 40 }),
  task({ title: "댓글 확인·답글", routine_template_id: "rt-3", due_date: "2026-10-28", estimated_minutes: 30 }),
  task({ title: "살림 동선 투어 기획안", project_id: "p-3", stage: "plan", due_date: "2026-10-28", estimated_minutes: 90 }),
  task({ title: "현관 정리 업로드·설명란", project_id: "p-1", stage: "upload", due_date: "2026-10-29", estimated_minutes: 40 }),
  task({ title: "행주 보관 쇼츠 편집", project_id: "p-2", stage: "edit", due_date: "2026-10-30", estimated_minutes: 60 }),
  task({ title: "행주 보관 쇼츠 업로드", project_id: "p-2", stage: "upload", due_date: "2026-10-31", estimated_minutes: 15 }),
  task({ title: "주간 회고", routine_template_id: "rt-4", due_date: "2026-10-31", estimated_minutes: 30 }),
  // 지난주 (요약용)
  task({ title: "주방 상부장 대본", project_id: "p-6", stage: "script", due_date: "2026-10-19", completed_at: "2026-10-19T22:00:00+09:00", estimated_minutes: 90 }),
  task({ title: "주방 상부장 촬영", project_id: "p-6", stage: "shoot", due_date: "2026-10-20", completed_at: "2026-10-20T16:00:00+09:00", estimated_minutes: 120 }),
  task({ title: "주방 상부장 편집", project_id: "p-6", stage: "edit", due_date: "2026-10-21", completed_at: "2026-10-22T01:00:00+09:00", estimated_minutes: 240 }),
  task({ title: "주방 상부장 업로드", project_id: "p-6", stage: "upload", due_date: "2026-10-22", completed_at: "2026-10-22T10:00:00+09:00", estimated_minutes: 30 }),
  task({ title: "현관 정리 촬영", project_id: "p-1", stage: "shoot", due_date: "2026-10-23", completed_at: "2026-10-23T15:00:00+09:00", estimated_minutes: 120 }),
  task({ title: "현관 정리 컷 편집", project_id: "p-1", stage: "edit", due_date: "2026-10-24", estimated_minutes: 180 }),
];

let teSeq = 0;
function te(entry_date: string, stage: TimeEntry["stage"], minutes: number, project_id: string | null = null): TimeEntry {
  teSeq += 1;
  return { id: `te-${teSeq}`, task_id: null, project_id, stage, source: teSeq % 3 === 0 ? "manual" : "timer", minutes, entry_date, week_start: weekStartOf(entry_date) };
}

export const timeEntries: TimeEntry[] = [
  // 2주 전 (10.11–10.17): 일반 1편(p-9), 쇼츠 1편(p-10)
  te("2026-10-11", "routine", 60),
  te("2026-10-11", "plan", 75, "p-9"),
  te("2026-10-12", "script", 140, "p-9"),
  te("2026-10-12", "routine", 45),
  te("2026-10-13", "shoot", 150, "p-9"),
  te("2026-10-13", "script", 30, "p-10"),
  te("2026-10-13", "shoot", 40, "p-10"),
  te("2026-10-14", "edit", 290, "p-9"),
  te("2026-10-14", "upload", 35, "p-9"),
  te("2026-10-15", "edit", 55, "p-10"),
  te("2026-10-15", "upload", 15, "p-10"),
  te("2026-10-15", "routine", 30),
  te("2026-10-17", "routine", 40),
  // 지난주 (10.18–10.24): 일반 1편(p-6), 쇼츠 2편(p-7, p-8), 다음 영상 촬영 일부(p-1)
  te("2026-10-18", "routine", 55),
  te("2026-10-18", "plan", 60, "p-6"),
  te("2026-10-18", "script", 20, "p-8"),
  te("2026-10-18", "shoot", 30, "p-8"),
  te("2026-10-19", "script", 105, "p-6"),
  te("2026-10-19", "edit", 40, "p-8"),
  te("2026-10-19", "upload", 10, "p-8"),
  te("2026-10-19", "routine", 40),
  te("2026-10-20", "shoot", 165, "p-6"),
  te("2026-10-21", "edit", 230, "p-6"),
  te("2026-10-22", "upload", 25, "p-6"),
  te("2026-10-22", "routine", 30),
  te("2026-10-23", "shoot", 130, "p-1"),
  te("2026-10-23", "script", 25, "p-7"),
  te("2026-10-23", "shoot", 35, "p-7"),
  te("2026-10-24", "edit", 50, "p-7"),
  te("2026-10-24", "upload", 10, "p-7"),
  te("2026-10-24", "edit", 95, "p-1"),
  te("2026-10-24", "routine", 35),
  // 이번 주 (10.25, 오늘)
  te("2026-10-25", "routine", 50),
  te("2026-10-25", "edit", 70, "p-1"),
];

export const weeklyReviews: WeeklyReview[] = [
  { week_start: LAST_WEEK, went_well: "대본을 전날 끝내서 촬영이 빨랐다.", to_improve: "편집을 밤늦게 몰아서 했다. 컷 편집과 자막을 나눠서 하기.", next_focus: "현관 정리 영상 수요일 전 편집 완료" },
];

// ---------------------------------------------------------------------
// 실험
// ---------------------------------------------------------------------
export const experiments: Experiment[] = [
  { id: "ex-1", hypothesis: "썸네일에 정리 후 사진을 크게 쓰면 노출 클릭률이 오른다", insight_id: "ins-1", video_id: "v-long-1", goal_id: null, action_detail: "전후 비교 썸네일, '후' 사진 비중 70%", metric_key: "impressions_ctr", compare_days_since_publish: 7, baseline_video_ids: ["v-long-4", "v-long-5", "v-long-6"], verdict: "running", verdict_reason: null },
  { id: "ex-2", hypothesis: "오프닝에 결과 컷을 먼저 넣으면 평균 시청 비율이 오른다", insight_id: "ins-3", video_id: "v-long-2", goal_id: null, action_detail: "결과 컷 5초 → 인사 → 과정", metric_key: "avg_view_percentage", compare_days_since_publish: 7, baseline_video_ids: ["v-long-5", "v-long-6", "v-long-7"], verdict: "success", verdict_reason: "기준 3편 중간값보다 평균 시청 비율이 높았고, 초반 10% 구간 이탈이 줄었다. (샘플 판정)" },
  { id: "ex-3", hypothesis: "쇼츠 끝에 질문을 남기면 구독 전환이 늘어난다", insight_id: "ins-8", video_id: "v-short-3", goal_id: null, action_detail: "마지막 2초에 '전체 정리 루틴은 본편에서' 문구", metric_key: "subscribers_gained", compare_days_since_publish: 7, baseline_video_ids: ["v-short-6", "v-short-7", "v-short-8"], verdict: "pending", verdict_reason: "구독 증가는 기준보다 많았지만 쇼츠 1편이라 우연일 수 있다. 2편 더 적용 후 다시 비교. (샘플 판정)" },
  { id: "ex-4", hypothesis: "협업 제안용 대표 영상은 동선 투어 형식이 반응이 좋다", insight_id: "ins-6", video_id: null, goal_id: "g-1", action_detail: "출연 제안서에 첨부할 대표 영상 제작", metric_key: "views", compare_days_since_publish: 28, baseline_video_ids: [], verdict: "planned", verdict_reason: null },
];

// ---------------------------------------------------------------------
// 목표
// ---------------------------------------------------------------------
export const goals: Goal[] = [
  { id: "g-1", title: "대형 살림 유튜브 채널에 출연하기", description: "다른 대형 살림 채널에 게스트로 나가 채널을 알린다.", success_criteria: "구독자 10만 이상 살림 채널 1곳에 게스트로 출연", target_date: "2027-03-31", status: "active", metric_key: null, target_value: null },
  { id: "g-2", title: "구독자 1만 명", description: "출연 제안 때 내밀 수 있는 규모 만들기", success_criteria: "총 구독자 10,000명", target_date: "2027-06-30", status: "active", metric_key: "subscriber_count", target_value: 10000 },
  { id: "g-3", title: "월 제휴 수익 50만 원", description: "세 플랫폼 확정 수익 합계", success_criteria: "한 달 확정 수익 ₩500,000", target_date: "2027-03-31", status: "active", metric_key: "monthly_revenue_krw", target_value: 500000 },
];

export const goalMilestones: GoalMilestone[] = [
  { id: "gm-1", goal_id: "g-1", title: "출연 희망 채널 5곳 목록 작성", due_date: "2026-10-20", completed_at: "2026-10-19T21:00:00+09:00", sort_order: 1 },
  { id: "gm-2", goal_id: "g-1", title: "협업 제안서 작성", due_date: "2026-11-01", completed_at: "2026-10-24T23:00:00+09:00", sort_order: 2 },
  { id: "gm-3", goal_id: "g-1", title: "대표 영상(살림 동선 투어) 업로드", due_date: "2026-11-08", completed_at: null, sort_order: 3 },
  { id: "gm-4", goal_id: "g-1", title: "제안 메일 발송 (5곳)", due_date: "2026-11-15", completed_at: null, sort_order: 4 },
  { id: "gm-5", goal_id: "g-1", title: "미팅", due_date: "2027-01-31", completed_at: null, sort_order: 5 },
  { id: "gm-6", goal_id: "g-1", title: "촬영", due_date: "2027-03-31", completed_at: null, sort_order: 6 },
];

export const goalNotes: GoalNote[] = [
  { id: "gn-1", goal_id: "g-1", body: "제안서 초안 완성. 첫 장을 '상대 시청자가 얻는 것'으로 바꿈 (비즈니스PT 4주차 반영).", created_at: "2026-10-24T23:10:00+09:00" },
  { id: "gn-2", goal_id: "g-1", body: "후보 5곳 정리. 그중 2곳은 게스트 출연 이력이 있음.", created_at: "2026-10-19T21:05:00+09:00" },
];

// ---------------------------------------------------------------------
// 제휴 수익 (건별, 최근 12개월)
// ---------------------------------------------------------------------
export const revenueEntries: RevenueEntry[] = [];
{
  const months = ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const plan: Record<RevenuePlatform, { n: [number, number]; amt: [number, number] }> = {
    coupang_partners: { n: [6, 14], amt: [900, 9000] },
    naver_brand_connect: { n: [1, 3], amt: [4000, 30000] },
    ohou_curator: { n: [2, 6], amt: [600, 6000] },
  };
  let seq = 0;
  months.forEach((month, mi) => {
    const growth = 0.55 + mi * 0.07;
    (Object.keys(plan) as RevenuePlatform[]).forEach((platform) => {
      const p = plan[platform];
      const count = Math.round(between(p.n[0], p.n[1]) * growth);
      for (let i = 0; i < count; i++) {
        seq += 1;
        const day = 1 + Math.floor(rand() * (month === "2026-10" ? 24 : 28));
        const entry_date = `${month}-${String(day).padStart(2, "0")}`;
        const recentVideos = videos.filter((v) => v.published_at.slice(0, 10) <= entry_date && diffDays(entry_date, v.published_at.slice(0, 10)) < 60);
        const tracked = recentVideos.length > 0 && rand() < (platform === "naver_brand_connect" ? 0.3 : 0.7);
        const video = tracked ? recentVideos[Math.floor(rand() * recentVideos.length)] : null;
        const status: RevenueEntry["status"] = month <= "2026-08" ? "paid" : month === "2026-09" ? "confirmed" : rand() < 0.35 ? "confirmed" : "expected";
        revenueEntries.push({
          id: `rev-${seq}`,
          platform,
          entry_date,
          amount_krw: Math.round(between(p.amt[0], p.amt[1]) / 10) * 10,
          status,
          video_id: video?.id ?? null,
          tracking_code: video ? `yt_${video.id}` : null,
          source: platform === "coupang_partners" ? "csv" : rand() < 0.5 ? "csv" : "manual",
        });
      }
    });
  });
  revenueEntries.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
}

// ---------------------------------------------------------------------
// AI 분석 (샘플) · 우선순위
// ---------------------------------------------------------------------
export const aiAnalyses: AiAnalysis[] = [
  {
    id: "ai-1",
    scope: "channel",
    target_id: null,
    period_start: "2026-09-27",
    period_end: "2026-10-24",
    output: {
      items: [
        { kind: "observation", text: "최근 28일 조회수의 절반 이상이 업로드 후 3일 안에 발생했다." },
        { kind: "hypothesis", text: "업로드 직후 노출이 성과를 좌우하므로, 썸네일·제목 실험의 효과가 크게 나타날 가능성이 있다." },
        { kind: "suggestion", text: "다음 일반 영상 2편은 같은 썸네일 규칙으로 올리고 7일 노출 클릭률을 비교한다." },
      ],
      evidence_metrics: ["views", "impressions_ctr"],
      confidence: "medium",
    },
    model: "sample",
    created_at: "2026-10-25T09:00:00+09:00",
  },
];

export const priorities: Priority[] = [
  { id: "pr-1", title: "현관 정리 영상 편집 끝내고 목요일 업로드", origin: "user", ai_analysis_id: null, rank: 1, done: false },
  { id: "pr-2", title: "출연 대표 영상(살림 동선 투어) 기획안 쓰기", origin: "user", ai_analysis_id: null, rank: 2, done: false },
  { id: "pr-3", title: "썸네일 규칙을 일반 영상 2편에 같게 적용", origin: "ai", ai_analysis_id: "ai-1", rank: 3, done: false },
];
