// 화면에 보이는 모든 계산. 입력은 DB 행 모양 그대로라 4단계에서 데이터 출처만 바꾸면 된다.

import { addDays, diffDays, monthKey, range } from "./dates";
import type {
  ChannelDailyMetric,
  ContentType,
  Experiment,
  Goal,
  GoalMilestone,
  ManualMetric,
  RevenueEntry,
  RevenuePlatform,
  Task,
  TimeEntry,
  TimeStage,
  Video,
  VideoDailyMetric,
  VideoProject,
} from "./types";

const sum = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---------------------------------------------------------------------
// 채널 기간 요약
// ---------------------------------------------------------------------
export interface PeriodSummary {
  start: string;
  end: string;
  views: number;
  watchMinutes: number;
  subsGained: number;
  subsLost: number;
  netSubs: number;
}

export function channelPeriod(rows: ChannelDailyMetric[], end: string, days: number): PeriodSummary {
  const start = addDays(end, -(days - 1));
  const inRange = rows.filter((r) => r.date >= start && r.date <= end);
  const subsGained = sum(inRange.map((r) => r.subscribers_gained));
  const subsLost = sum(inRange.map((r) => r.subscribers_lost));
  return {
    start,
    end,
    views: sum(inRange.map((r) => r.views)),
    watchMinutes: sum(inRange.map((r) => r.watch_time_minutes)),
    subsGained,
    subsLost,
    netSubs: subsGained - subsLost,
  };
}

/** 같은 길이의 직전 기간과 비교 */
export function channelPeriodWithPrevious(rows: ChannelDailyMetric[], end: string, days: number) {
  const current = channelPeriod(rows, end, days);
  const previous = channelPeriod(rows, addDays(current.start, -1), days);
  const hasPrevious = rows.some((r) => r.date <= previous.end && r.date >= previous.start);
  return { current, previous: hasPrevious ? previous : null };
}

export function subscriberCount(rows: ChannelDailyMetric[], base: number, upTo: string): number {
  return base + sum(rows.filter((r) => r.date <= upTo).map((r) => (r.subscribers_gained ?? 0) - (r.subscribers_lost ?? 0)));
}

// ---------------------------------------------------------------------
// 영상: 업로드 후 N일 누적
// ---------------------------------------------------------------------
export interface VideoCumulative {
  video: Video;
  daysObserved: number;
  complete: boolean; // N일이 다 찼는지
  views: number;
  watchMinutes: number;
  avgViewPercentage: number | null; // 조회수 가중 평균
  subsGained: number;
}

export function videoCumulative(video: Video, daily: VideoDailyMetric[], days: number | "all"): VideoCumulative {
  const rows = daily.filter((m) => m.video_id === video.id && (days === "all" || m.days_since_publish < days));
  const observed = daily.filter((m) => m.video_id === video.id).length;
  const views = sum(rows.map((r) => r.views));
  const weighted = rows.reduce((s, r) => s + (r.avg_view_percentage ?? 0) * (r.views ?? 0), 0);
  return {
    video,
    daysObserved: observed,
    complete: days === "all" ? true : observed >= days,
    views,
    watchMinutes: sum(rows.map((r) => r.watch_time_minutes)),
    avgViewPercentage: views > 0 ? weighted / views : null,
    subsGained: sum(rows.map((r) => r.subscribers_gained)),
  };
}

/** 최근 성과 좋은 영상: 최근 30일 업로드 중 업로드 후 7일 조회수 상위. 7일이 안 찬 영상은 뒤로 보낸다. */
export function topVideos(videos: Video[], daily: VideoDailyMetric[], type: ContentType, today: string, limit = 3) {
  return videos
    .filter((v) => v.content_type === type && diffDays(today, v.published_at.slice(0, 10)) <= 30)
    .map((v) => videoCumulative(v, daily, 7))
    .sort((a, b) => Number(b.complete) - Number(a.complete) || b.views - a.views)
    .slice(0, limit);
}

export function manualValue(rows: ManualMetric[], videoId: string, key: string): ManualMetric | null {
  return rows.find((r) => r.video_id === videoId && r.metric_key === key) ?? null;
}

export function dailySeries(rows: ChannelDailyMetric[], start: string, end: string) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return range(start, end).map((date) => {
    const r = byDate.get(date);
    return {
      date,
      views: r?.views ?? null,
      watchHours: r?.watch_time_minutes != null ? Math.round((r.watch_time_minutes / 60) * 10) / 10 : null,
      netSubs: r ? (r.subscribers_gained ?? 0) - (r.subscribers_lost ?? 0) : null,
    };
  });
}

/** 유형별 일별 합계 (쇼츠/일반 분리 보기용) */
export function dailySeriesByType(daily: VideoDailyMetric[], videos: Video[], type: ContentType, start: string, end: string) {
  const ids = new Set(videos.filter((v) => v.content_type === type).map((v) => v.id));
  const map = new Map<string, { views: number; minutes: number; subs: number }>();
  for (const m of daily) {
    if (!ids.has(m.video_id) || m.date < start || m.date > end) continue;
    const cur = map.get(m.date) ?? { views: 0, minutes: 0, subs: 0 };
    cur.views += m.views ?? 0;
    cur.minutes += m.watch_time_minutes ?? 0;
    cur.subs += m.subscribers_gained ?? 0;
    map.set(m.date, cur);
  }
  return range(start, end).map((date) => {
    const r = map.get(date);
    return { date, views: r?.views ?? 0, watchHours: r ? Math.round((r.minutes / 60) * 10) / 10 : 0, netSubs: r?.subs ?? 0 };
  });
}

// ---------------------------------------------------------------------
// 실험: 기준 영상 중간값 vs 실험 영상 (같은 경과일)
// ---------------------------------------------------------------------
export interface ExperimentComparison {
  metricKey: string;
  baseline: number | null;
  value: number | null;
  diff: number | null;
  unit: "percent" | "count";
  ready: boolean;
  daysObserved: number;
  /** 실제로 비교에 쓴 경과일. 목표 일수가 안 찼으면 관측된 일수로 양쪽을 맞춘다 */
  comparedDays: number;
  note: string | null;
}

export function compareExperiment(ex: Experiment, metricKey: string, videos: Video[], daily: VideoDailyMetric[], manual: ManualMetric[]): ExperimentComparison {
  const target = videos.find((v) => v.id === ex.video_id);
  const base = ex.baseline_video_ids.map((id) => videos.find((v) => v.id === id)).filter((v): v is Video => !!v);
  const unit = metricKey === "impressions_ctr" || metricKey === "avg_view_percentage" ? "percent" : "count";
  if (!target) return { metricKey, baseline: null, value: null, diff: null, unit, ready: false, daysObserved: 0, comparedDays: 0, note: "적용 영상이 아직 없습니다." };

  const daysObserved = daily.filter((m) => m.video_id === target.id).length;
  const ready = daysObserved >= ex.compare_days_since_publish;
  // 실험 영상이 아직 N일을 못 채웠으면, 기준 영상도 같은 경과일까지만 잘라 비교한다
  const days = ready ? ex.compare_days_since_publish : Math.max(1, daysObserved);
  const pick = (v: Video): number | null => {
    if (metricKey === "impressions_ctr") return manualValue(manual, v.id, "impressions_ctr")?.value ?? null;
    const c = videoCumulative(v, daily, days);
    if (metricKey === "avg_view_percentage") return c.avgViewPercentage;
    if (metricKey === "subscribers_gained") return c.subsGained;
    return c.views;
  };
  const baseline = median(base.map(pick).filter((x): x is number => x !== null));
  const value = pick(target);
  return {
    metricKey,
    baseline,
    value,
    diff: baseline !== null && value !== null ? value - baseline : null,
    unit,
    ready,
    daysObserved,
    comparedDays: days,
    note: metricKey === "impressions_ctr" ? "노출 클릭률은 CSV의 최근 28일 값이라 경과일을 맞출 수 없습니다." : null,
  };
}

// ---------------------------------------------------------------------
// 주간 루틴 · 시간
// ---------------------------------------------------------------------
export const STAGE_ORDER: TimeStage[] = ["plan", "script", "shoot", "edit", "upload", "routine", "other"];

export function completionRate(tasks: Task[], weekStart: string) {
  const ws = tasks.filter((t) => t.week_start === weekStart);
  const done = ws.filter((t) => t.completed_at).length;
  return { done, total: ws.length, rate: ws.length ? (done / ws.length) * 100 : null };
}

/** 주가 진행 중이면 지난주도 같은 요일까지만 잘라서 비교한다 (공정한 비교). */
export function weekTimeComparison(entries: TimeEntry[], projects: VideoProject[], videos: Video[], weekStart: string, today: string) {
  const uploadDates = new Map<string, string>();
  for (const p of projects) {
    const v = p.video_id ? videos.find((x) => x.id === p.video_id) : undefined;
    if (v) uploadDates.set(p.id, v.published_at.slice(0, 10));
  }
  const elapsed = Math.min(6, Math.max(0, diffDays(today, weekStart))); // 0 = 일요일
  const inProgress = diffDays(today, weekStart) < 7;
  const prevStart = addDays(weekStart, -7);
  const curEnd = inProgress ? addDays(weekStart, elapsed) : addDays(weekStart, 6);
  const prevEnd = addDays(prevStart, inProgress ? elapsed : 6);
  const cur = entries.filter((e) => e.week_start === weekStart && e.entry_date <= curEnd);
  const prev = entries.filter((e) => e.week_start === prevStart && e.entry_date <= prevEnd);

  const byStage = STAGE_ORDER.map((stage) => {
    const now = sum(cur.filter((e) => e.stage === stage).map((e) => e.minutes));
    const before = sum(prev.filter((e) => e.stage === stage).map((e) => e.minutes));
    return { stage, now, before, delta: now - before };
  }).filter((s) => s.now > 0 || s.before > 0);

  // 1편당 평균 제작 시간 = 그 주에 업로드한 영상들의 (모든 주에 걸친) 총 제작 시간 ÷ 편수
  // 진행 중인 주는 오늘까지 업로드한 영상만 센다.
  const perVideo = (["long", "short"] as ContentType[]).map((type) => {
    const calc = (start: string, end: string) => {
      const uploaded = projects.filter(
        (p) => p.content_type === type && p.video_id && uploadDates.get(p.id) !== undefined && uploadDates.get(p.id)! >= start && uploadDates.get(p.id)! <= end,
      );
      const minutes = sum(uploaded.map((p) => sum(entries.filter((e) => e.project_id === p.id).map((e) => e.minutes))));
      return { minutes, count: uploaded.length, avg: uploaded.length ? minutes / uploaded.length : null };
    };
    const now = calc(weekStart, curEnd);
    const before = calc(prevStart, addDays(prevStart, 6));
    return { type, now, before, change: now.avg !== null && before.avg !== null ? ((now.avg - before.avg) / before.avg) * 100 : null };
  });

  return {
    inProgress,
    elapsedDays: elapsed + 1,
    range: { start: weekStart, end: curEnd },
    prevRange: { start: prevStart, end: prevEnd },
    total: { now: sum(cur.map((e) => e.minutes)), before: sum(prev.map((e) => e.minutes)) },
    byStage,
    perVideo,
  };
}

/** 예상 대비 실제: 완료된 작업 중 시간 기록이 있는 것만 */
export function estimateAccuracy(tasks: Task[], entries: TimeEntry[], projects: VideoProject[], weekStart: string) {
  // 샘플에서는 작업 단위 기록 대신 프로젝트·단계 단위로 맞춘다
  const done = tasks.filter((t) => t.week_start === weekStart && t.completed_at && t.estimated_minutes && t.project_id && t.stage);
  let est = 0;
  let actual = 0;
  for (const t of done) {
    const spent = sum(entries.filter((e) => e.project_id === t.project_id && e.stage === t.stage && e.week_start === weekStart).map((e) => e.minutes));
    if (spent === 0) continue;
    est += t.estimated_minutes!;
    actual += spent;
  }
  return est ? { estimated: est, actual, ratio: (actual / est) * 100 } : null;
}

// ---------------------------------------------------------------------
// 수익
// ---------------------------------------------------------------------
export const PLATFORMS: { key: RevenuePlatform; label: string }[] = [
  { key: "coupang_partners", label: "쿠팡 파트너스" },
  { key: "naver_brand_connect", label: "네이버 브랜드커넥트" },
  { key: "ohou_curator", label: "오늘의집 큐레이터" },
];

export function revenueMonth(entries: RevenueEntry[], month: string) {
  const rows = entries.filter((e) => monthKey(e.entry_date) === month);
  const confirmed = (r: RevenueEntry) => r.status !== "expected";
  return {
    confirmed: sum(rows.filter(confirmed).map((r) => r.amount_krw)),
    expected: sum(rows.filter((r) => !confirmed(r)).map((r) => r.amount_krw)),
    byPlatform: PLATFORMS.map((p) => {
      const pr = rows.filter((r) => r.platform === p.key);
      return {
        ...p,
        confirmed: sum(pr.filter(confirmed).map((r) => r.amount_krw)),
        expected: sum(pr.filter((r) => !confirmed(r)).map((r) => r.amount_krw)),
        count: pr.length,
        lastDate: pr.map((r) => r.entry_date).sort().at(-1) ?? null,
      };
    }),
  };
}

export function revenueMonthlySeries(entries: RevenueEntry[], months: string[]) {
  return months.map((month) => {
    const m = revenueMonth(entries, month);
    const row: Record<string, number | string> = { month };
    for (const p of m.byPlatform) row[p.key] = p.confirmed;
    return row;
  });
}

// ---------------------------------------------------------------------
// 목표
// ---------------------------------------------------------------------
export function goalProgress(goal: Goal, milestones: GoalMilestone[], metricValue: number | null) {
  if (goal.metric_key && goal.target_value) {
    const current = metricValue ?? 0;
    return { kind: "metric" as const, pct: Math.min(100, (current / goal.target_value) * 100), current, target: goal.target_value };
  }
  const ms = milestones.filter((m) => m.goal_id === goal.id);
  const done = ms.filter((m) => m.completed_at).length;
  return { kind: "milestone" as const, pct: ms.length ? (done / ms.length) * 100 : 0, done, total: ms.length };
}
