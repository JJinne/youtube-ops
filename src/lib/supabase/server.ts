import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isAllowedEmail, isSupabaseConfigured } from "./config";

/** 서버 컴포넌트 · 서버 액션 · 라우트 핸들러용 클라이언트. 로그인한 사용자의 권한(RLS)으로 동작한다. */
export async function createSupabaseServerClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          // 서버 컴포넌트 렌더링 중에는 쿠키를 쓸 수 없다. 세션 갱신은 proxy가 맡는다.
        }
      },
    },
  });
}

export type LiveSession = {
  mode: "live";
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  email: string;
};
export type SessionState = { mode: "sample" } | { mode: "signed-out" } | LiveSession;

/** 현재 요청의 데이터 모드를 정한다. 설정 없음 → 샘플, 설정 있음 + 로그인 → 실제 데이터 */
export async function getSession(): Promise<SessionState> {
  if (!isSupabaseConfigured()) return { mode: "sample" };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email : null;
  if (!claims?.sub || !isAllowedEmail(email)) return { mode: "signed-out" };
  return { mode: "live", supabase, userId: claims.sub, email: email! };
}

/** 서버 액션에서 사용. 로그인하지 않았으면 예외 */
export async function requireLive(): Promise<LiveSession> {
  const s = await getSession();
  if (s.mode !== "live") throw new Error(s.mode === "sample" ? "샘플 모드에서는 저장하지 않습니다." : "로그인이 필요합니다.");
  return s;
}
