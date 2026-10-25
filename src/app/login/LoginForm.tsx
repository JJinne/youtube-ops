"use client";

import { useState } from "react";
import { Card, btn, fieldFull } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ supabaseUrl, supabaseKey }: { supabaseUrl: string; supabaseKey: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" | "error"; message?: string }>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "sending" });
    let error: { message: string } | null = null;
    try {
      const supabase = createSupabaseBrowserClient(supabaseUrl, supabaseKey);
      const r = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true },
      });
      error = r.error;
    } catch (e) {
      error = { message: e instanceof Error ? e.message : String(e) };
    }
    if (error) {
      const msg = /rate|limit/i.test(error.message)
        ? "메일을 너무 자주 요청했습니다. 무료 메일 발송은 시간당 2통까지라 잠시 뒤 다시 시도해 주세요."
        : /not authorized|authorized/i.test(error.message)
          ? "이 주소로는 메일을 보낼 수 없습니다. Supabase 무료 기본 메일은 프로젝트 팀원 주소로만 보냅니다."
          : /fetch|network|Failed/i.test(error.message)
            ? "Supabase에 연결하지 못했습니다. 인터넷 연결과 Supabase 주소(NEXT_PUBLIC_SUPABASE_URL)를 확인하세요."
            : `메일을 보내지 못했습니다: ${error.message}`;
      setState({ kind: "error", message: msg });
      return;
    }
    setState({ kind: "sent" });
  }

  return (
    <Card>
      {state.kind === "sent" ? (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm font-bold">로그인 링크를 보냈습니다.</p>
          <p className="text-[13px] text-sub">
            <strong>{email}</strong> 메일함에서 링크를 누르세요. 이 브라우저에서 열어야 로그인됩니다. 메일이 안 보이면 스팸함을 확인하세요.
          </p>
          <button type="button" className={btn.secondary + " self-start"} onClick={() => setState({ kind: "idle" })}>
            다른 주소로 받기
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-[13px] font-bold text-sub">
            이메일
          </label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldFull + " min-h-11"} />
          {state.kind === "error" && (
            <p role="alert" className="text-[13px] text-bad">
              {state.message}
            </p>
          )}
          <button type="submit" className={btn.primary + " min-h-11"} disabled={state.kind === "sending"}>
            {state.kind === "sending" ? "보내는 중…" : "로그인 링크 받기"}
          </button>
        </form>
      )}
    </Card>
  );
}
