import "server-only";
import { addDays, weekStartOf } from "../dates";
import { SAMPLE_TODAY } from "../sample-data";
import { getSession, type SessionState } from "../supabase/server";

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
export function kstToday(now = Date.now()): string {
  return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
}

export interface DataContext {
  session: SessionState;
  live: boolean;
  today: string;
  currentWeek: string;
  lastWeek: string;
}

export async function getDataContext(): Promise<DataContext> {
  const session = await getSession();
  const live = session.mode === "live";
  const today = live ? kstToday() : SAMPLE_TODAY;
  const currentWeek = weekStartOf(today);
  return { session, live, today, currentWeek, lastWeek: addDays(currentWeek, -7) };
}
