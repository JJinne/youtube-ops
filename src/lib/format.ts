const nf = new Intl.NumberFormat("ko-KR");

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return nf.format(Math.round(n));
}

export function signed(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const r = Math.round(n);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${nf.format(Math.abs(r))}`;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

/** 직전 대비 변화율. 기준이 0이거나 없으면 null */
export function changeRate(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function signedPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

export function krw(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `₩${nf.format(Math.round(n))}`;
}

/** 분 → "3시간 20분" */
export function duration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return "—";
  const m = Math.round(minutes);
  const h = Math.floor(Math.abs(m) / 60);
  const rest = Math.abs(m) % 60;
  const sign = m < 0 ? "−" : "";
  if (h === 0) return `${sign}${rest}분`;
  if (rest === 0) return `${sign}${h}시간`;
  return `${sign}${h}시간 ${rest}분`;
}

export function hours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  return `${nf.format(Math.round(minutes / 60))}시간`;
}

export function secondsToClock(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "—";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
