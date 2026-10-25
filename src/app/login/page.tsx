import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!isSupabaseConfigured()) redirect("/");
  const { error } = await searchParams;
  const message =
    error === "not-allowed"
      ? "이 이메일은 로그인이 허용되지 않았습니다. 앱 설정(ALLOWED_EMAILS)에 등록한 이메일로 로그인하세요."
      : error === "link"
        ? "로그인 링크가 만료됐거나 이미 사용됐습니다. 새 링크를 받아 주세요."
        : null;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">로그인</h1>
        <p className="text-[13px] text-muted">이메일로 받은 링크를 누르면 로그인됩니다. 비밀번호는 없습니다.</p>
      </div>
      {message && (
        <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-[13px] text-bad">
          {message}
        </p>
      )}
      <LoginForm supabaseUrl={SUPABASE_URL} supabaseKey={SUPABASE_PUBLIC_KEY} />
    </div>
  );
}
