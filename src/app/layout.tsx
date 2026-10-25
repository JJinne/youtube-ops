import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { meta } from "@/lib/data";
import { getSession } from "@/lib/supabase/server";

// 로그인 상태에 따라 내용이 달라지므로 모든 화면을 요청마다 그린다
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "채널 운영실", template: "%s · 채널 운영실" },
  description: "유튜브 운영과 학습, 제작 루틴을 한곳에서 관리하는 개인용 대시보드",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f6f8",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const session = { mode: s.mode, email: s.mode === "live" ? s.email : null };
  return (
    <html lang="ko">
      <body>
        <AppShell meta={meta} session={session}>{children}</AppShell>
      </body>
    </html>
  );
}
