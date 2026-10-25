import type { ReactNode } from "react";
import type { DataSource } from "@/lib/types";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function Card({ children, className, as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "article" | "div" | "aside" } & Record<string, unknown>) {
  return (
    <As className={cx("min-w-0 rounded-xl border border-line bg-surface p-5", className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, right, sub, level = 2 }: { title: ReactNode; right?: ReactNode; sub?: ReactNode; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div className="flex min-w-0 flex-col gap-0.5">
        <H className="text-base font-bold">{title}</H>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        {sub && <p className="text-[13px] text-muted">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2.5">{right}</div>}
    </header>
  );
}

type Tone = "neutral" | "accent" | "good" | "bad" | "warn" | "sample" | "ai" | "csv";
const TONES: Record<Tone, string> = {
  neutral: "bg-line-soft text-sub",
  accent: "bg-navy-tint text-navy",
  good: "bg-good-bg text-good-fg",
  bad: "bg-bad-bg text-bad",
  warn: "bg-sample-bg text-sample-fg",
  sample: "bg-sample-bg text-sample-fg",
  ai: "bg-ai-bg text-ai-fg",
  csv: "bg-line-soft text-sub",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", TONES[tone], className)}>{children}</span>;
}

const SOURCE_LABEL: Record<DataSource, { label: string; tone: Tone }> = {
  api: { label: "실제 API", tone: "good" },
  csv: { label: "CSV", tone: "csv" },
  manual: { label: "수동 입력", tone: "csv" },
  sample: { label: "샘플 데이터", tone: "sample" },
};

export function SourceBadge({ source, short = false }: { source: DataSource; short?: boolean }) {
  const s = SOURCE_LABEL[source];
  return <Badge tone={s.tone}>{short && source === "sample" ? "샘플" : s.label}</Badge>;
}

export function AiBadge({ children = "AI 추정" }: { children?: ReactNode }) {
  return <Badge tone="ai">{children}</Badge>;
}

/** 지표 정의 · 집계 기간 안내. 마우스 없이도 열 수 있게 details 사용 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group relative inline-block align-middle">
      <summary className="flex size-6 cursor-pointer list-none items-center justify-center rounded-full text-muted hover:text-navy [&::-webkit-details-marker]:hidden" aria-label={`${label} 정의 보기`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="absolute left-1/2 top-7 z-20 w-64 -translate-x-1/2 rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-sub shadow-lg">
        <strong className="mb-1 block text-ink">{label}</strong>
        {children}
      </div>
    </details>
  );
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone,
  note,
  badge,
  info,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: "good" | "bad" | "neutral";
  note?: ReactNode;
  badge?: ReactNode;
  info?: ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-line bg-surface px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-1 text-[12px] leading-snug text-muted sm:text-[13px]">
          <span className="min-w-0">{label}</span>
          {info}
        </span>
        {badge && <span className="hidden shrink-0 sm:inline-flex">{badge}</span>}
      </div>
      <span className="tabular text-[26px] font-bold tracking-tight">{value}</span>
      {delta !== undefined && (
        <span className={cx("tabular text-xs font-bold", deltaTone === "good" ? "text-good" : deltaTone === "bad" ? "text-warn" : "text-sub")}>{delta}</span>
      )}
      {note && <span className="text-xs text-muted">{note}</span>}
    </article>
  );
}

export function Progress({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("h-2 overflow-hidden rounded-full bg-line", className)} role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-navy" style={{ width: `${v}%` }} />
    </div>
  );
}

export const btn = {
  primary: "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-navy bg-navy px-4 text-[13px] font-bold text-white hover:bg-navy-deep disabled:opacity-50",
  secondary: "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-field bg-surface px-3.5 text-[13px] font-medium text-sub hover:border-navy hover:text-navy disabled:opacity-50",
  accent: "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-field bg-surface px-3.5 text-[13px] font-bold text-navy hover:border-navy disabled:opacity-50",
  danger: "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#e6c2bc] bg-surface px-3.5 text-[13px] font-bold text-bad hover:bg-bad-bg",
  ai: "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-field bg-surface px-3 text-xs font-bold text-ai-fg hover:border-ai-fg disabled:opacity-50",
};

export const field = "min-h-10 rounded-lg border border-field bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-navy";
export const fieldFull = field + " w-full";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-field bg-ground px-4 py-6 text-center text-[13px] text-muted">{children}</p>;
}

export function DataStatus({ source, lastUpdatedAt, provisionalNote }: { source: DataSource; lastUpdatedAt: string | null; provisionalNote?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SourceBadge source={source} />
      <span className="text-xs text-muted">마지막 갱신 {lastUpdatedAt ?? "—"}</span>
      {provisionalNote && <span className="text-xs text-muted">· 최근 3일은 보정 중</span>}
    </div>
  );
}

/** 증가가 좋은지 나쁜지에 따라 색을 고른다 */
export function deltaTone(delta: number | null, higherIsBetter: boolean): "good" | "bad" | "neutral" {
  if (delta === null || delta === 0) return "neutral";
  return delta > 0 === higherIsBetter ? "good" : "bad";
}
