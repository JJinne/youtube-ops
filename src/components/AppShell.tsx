"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { DataMeta } from "@/lib/types";
import { Icon } from "./icons";
import { SourceBadge } from "./ui";

const NAV = [
  { href: "/", label: "홈", icon: Icon.home },
  { href: "/analytics", label: "유튜브 분석", icon: Icon.chart },
  { href: "/insights", label: "강의·인사이트", icon: Icon.bulb },
  { href: "/routine", label: "주간 제작 루틴", icon: Icon.calendar },
  { href: "/experiments", label: "실험·회고", icon: Icon.flask },
  { href: "/goals", label: "목표", icon: Icon.target },
  { href: "/revenue", label: "수익", icon: Icon.wallet },
  { href: "/settings", label: "설정", icon: Icon.gear },
];

const MOBILE_TABS = [NAV[0], { ...NAV[1], label: "분석" }, { ...NAV[3], label: "루틴" }, { ...NAV[2], label: "인사이트" }];

function isActive(pathname: string, href: string) {
  const p = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return href === "/" ? p === "/" : p.startsWith(href);
}

export interface ShellSession {
  mode: "sample" | "signed-out" | "live";
  email: string | null;
}

// 실제 모드에서 아직 샘플 데이터를 보여 주는 화면과 안내 문구
const STILL_SAMPLE: { prefix: string; text: string }[] = [
  { prefix: "/analytics", text: "유튜브 지표는 아직 샘플입니다. 5단계에서 YouTube를 연결하면 실제 값으로 바뀝니다." },
  { prefix: "/experiments", text: "실험·회고는 아직 샘플입니다. 4b단계에서 저장 기능을 연결합니다." },
  { prefix: "/goals", text: "목표는 아직 샘플입니다. 4b단계에서 저장 기능을 연결합니다." },
  { prefix: "/revenue", text: "수익은 아직 샘플입니다. 4b단계에서 입력·CSV 업로드를 연결합니다." },
  { prefix: "/", text: "제작 현황·주간 루틴·인사이트는 실제 기록입니다. \"샘플\" 표시가 있는 카드는 아직 연결 전입니다." },
];

export function AppShell({ meta, session, children }: { meta: DataMeta; session: ShellSession; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const moreActive = NAV.slice(4).some((n) => isActive(pathname, n.href));

  // 로그인 전에는 메뉴 없이 로그인 화면만
  if (session.mode === "signed-out") {
    return (
      <div className="min-h-dvh">
        <header className="flex items-center border-b border-line bg-surface px-4 py-3 lg:px-8">
          <Brand compact />
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-8">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:flex">
      {/* PC 사이드바 */}
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:gap-6 lg:border-r lg:border-line lg:bg-surface lg:px-3 lg:py-5 lg:sticky lg:top-0 lg:h-dvh">
        <Brand />
        <nav aria-label="주 메뉴" className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm no-underline ${
                  active ? "bg-navy-tint font-bold text-navy" : "font-medium text-sub hover:bg-ground"
                }`}
              >
                <n.icon width={18} height={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <ConnectionBox meta={meta} session={session} />
      </aside>

      {/* 모바일 상단 바 */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand compact />
        <SourceBadge source={meta.source} />
      </header>

      <div className="min-w-0 flex-1 pb-24 lg:pb-0">
        <ModeBanner session={session} pathname={pathname} />
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 lg:px-8 lg:py-7">{children}</main>
      </div>

      {/* 모바일 하단 탭 */}
      <nav aria-label="하단 메뉴" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),8px)] pt-1 lg:hidden">
        {MOBILE_TABS.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] no-underline ${active ? "font-bold text-navy" : "text-muted"}`}
            >
              <n.icon width={22} height={22} />
              {n.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          aria-controls="more-menu"
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] ${moreActive ? "font-bold text-navy" : "text-muted"}`}
        >
          <Icon.more width={22} height={22} />
          더보기
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="더보기 메뉴" id="more-menu">
          <button type="button" aria-label="닫기" className="absolute inset-0 bg-ink/30" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold">전체 메뉴</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="닫기" className="flex size-11 items-center justify-center rounded-lg text-sub">
                <Icon.close />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm no-underline ${
                    isActive(pathname, n.href) ? "border-navy bg-navy-tint font-bold text-navy" : "border-line text-sub"
                  }`}
                >
                  <n.icon width={18} height={18} />
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2 text-ink no-underline">
      <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-lg bg-navy text-[13px] font-bold text-white">
        운
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[15px] font-bold">채널 운영실</span>
        {!compact && <span className="text-xs text-muted">개인용</span>}
      </span>
    </Link>
  );
}

function ModeBanner({ session, pathname }: { session: ShellSession; pathname: string }) {
  const p = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (session.mode === "sample") {
    return (
      <div role="note" className="border-b border-[#f1dfb3] bg-sample-bg px-4 py-2 text-[13px] text-sample-fg lg:px-8">
        <strong className="font-bold">샘플 데이터 화면입니다.</strong> 실제 채널 수치가 아니며, 입력한 내용은 저장되지 않습니다. 저장하려면 Supabase를 연결하세요.{" "}
        <Link href="/settings" className="font-bold text-sample-fg underline">
          설정 안내
        </Link>
      </div>
    );
  }
  if (session.mode !== "live") return null;
  const hit = STILL_SAMPLE.find((s) => (s.prefix === "/" ? p === "/" : p.startsWith(s.prefix)));
  if (!hit) return null;
  return (
    <div role="note" className="border-b border-[#f1dfb3] bg-sample-bg px-4 py-2 text-[13px] text-sample-fg lg:px-8">
      {hit.text}
    </div>
  );
}

function ConnectionBox({ meta, session }: { meta: DataMeta; session: ShellSession }) {
  return (
    <div className="mt-auto flex flex-col gap-2 rounded-xl border border-line bg-ground p-3">
      <span className="text-xs text-muted">데이터 상태</span>
      {session.mode === "live" ? <span className="text-xs font-bold text-good-fg">기록 저장 중 (Supabase)</span> : <SourceBadge source={meta.source} />}
      <span className="text-xs text-sub">{meta.connected ? "YouTube 연결됨" : "YouTube 미연결 · 지표는 샘플"}</span>
      {session.mode === "live" ? (
        <form action="/auth/signout" method="post" className="flex flex-col gap-1">
          <span className="truncate text-[11px] text-muted" title={session.email ?? ""}>
            {session.email}
          </span>
          <button type="submit" className="self-start text-xs font-bold text-navy underline">
            로그아웃
          </button>
        </form>
      ) : (
        <Link href="/settings" className="text-xs font-bold">
          연결 설정으로 이동
        </Link>
      )}
    </div>
  );
}
