// 날짜는 모두 "YYYY-MM-DD" 문자열로 다루고, 계산은 UTC 기준으로 해 시간대 차이로 하루가 밀리지 않게 한다.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function toDate(ymd: string): Date {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  return toYmd(new Date(toDate(ymd).getTime() + days * DAY_MS));
}

export function diffDays(later: string, earlier: string): number {
  return Math.round((toDate(later).getTime() - toDate(earlier).getTime()) / DAY_MS);
}

export function weekday(ymd: string): number {
  return toDate(ymd).getUTCDay();
}

/** 일요일 시작 주. 주어진 날짜가 속한 주의 일요일을 돌려준다. */
export function weekStartOf(ymd: string): string {
  return addDays(ymd, -weekday(ymd));
}

export function weekdayKo(ymd: string): string {
  return WEEKDAYS[weekday(ymd)];
}

/** 10.25(일) */
export function shortDate(ymd: string, withWeekday = true): string {
  const [, m, d] = ymd.slice(0, 10).split("-");
  const base = `${Number(m)}.${Number(d)}`;
  return withWeekday ? `${base}(${weekdayKo(ymd)})` : base;
}

/** 2026.10.25 */
export function fullDate(ymd: string): string {
  return ymd.slice(0, 10).replaceAll("-", ".");
}

export function range(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

export const WEEKDAY_LABELS = WEEKDAYS;
