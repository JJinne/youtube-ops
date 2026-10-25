// Supabase 설정. 환경 변수가 없으면 앱은 샘플 모드로 동작한다.
// 공개 키는 Supabase의 새 이름(publishable key)과 예전 이름(anon key)을 모두 받는다.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith("https://") && SUPABASE_PUBLIC_KEY.length > 20;
}

/** 로그인을 허용할 이메일 (쉼표로 여러 개). 비어 있으면 아무도 허용하지 않는다. 서버에서만 읽는다. */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.toLowerCase());
}
