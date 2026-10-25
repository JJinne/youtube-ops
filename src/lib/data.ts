// 데이터 접근 계층.
// 3단계: 샘플 데이터를 그대로 돌려준다.
// 4·5단계: 같은 함수 이름을 유지한 채 Supabase 조회로 바꾼다. 화면 코드는 바꾸지 않는다.

import * as sample from "./sample-data";
import type { DataMeta } from "./types";

export const meta: DataMeta = {
  source: "sample",
  connected: false,
  lastUpdatedAt: null,
};

/** 화면 기준일. 샘플은 고정, 실제 데이터는 오늘(한국 시간) */
export const today = sample.SAMPLE_TODAY;
/** 지표가 있는 마지막 날 */
export const lastDataDate = sample.SAMPLE_LAST_DATA_DATE;
/** YouTube가 아직 보정 중일 수 있는 최근 일수 */
export const PROVISIONAL_DAYS = 3;

export const db = {
  videos: sample.videos,
  videoDailyMetrics: sample.videoDailyMetrics,
  channelDailyMetrics: sample.channelDailyMetrics,
  retention: sample.retention,
  manualMetrics: sample.manualMetrics,
  lectures: sample.lectures,
  insights: sample.insights,
  projects: sample.projects,
  routineTemplates: sample.routineTemplates,
  tasks: sample.tasks,
  timeEntries: sample.timeEntries,
  weeklyReviews: sample.weeklyReviews,
  experiments: sample.experiments,
  goals: sample.goals,
  goalMilestones: sample.goalMilestones,
  goalNotes: sample.goalNotes,
  revenueEntries: sample.revenueEntries,
  aiAnalyses: sample.aiAnalyses,
  priorities: sample.priorities,
  subscribersBeforeStart: sample.SAMPLE_SUBSCRIBERS_BEFORE_START,
  currentWeek: sample.CURRENT_WEEK,
  lastWeek: sample.LAST_WEEK,
};
