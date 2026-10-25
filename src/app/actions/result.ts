export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export function fail(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return { ok: false, error: msg || "알 수 없는 오류" };
}
