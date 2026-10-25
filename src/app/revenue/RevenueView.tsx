"use client";

import Link from "next/link";
import { useState } from "react";
import { PLATFORM_COLORS, RevenueStackChart } from "@/components/charts";
import { Chips } from "@/components/controls";
import { Badge, Card, CardHeader, Empty, InfoTip, PageHeader, StatCard, btn } from "@/components/ui";
import { fullDate } from "@/lib/dates";
import { krw, num } from "@/lib/format";
import type { revenueMonth } from "@/lib/metrics";
import type { RevenueEntry, RevenuePlatform } from "@/lib/types";

type Month = ReturnType<typeof revenueMonth>;
type Filter = "all" | RevenuePlatform | "unlinked" | "expected";

interface Props {
  month: string;
  current: Month;
  previous: Month;
  series: Record<string, number | string>[];
  platforms: { key: RevenuePlatform; label: string }[];
  entries: RevenueEntry[];
  videos: Record<string, string>;
}

const STATUS = { expected: { label: "예상", tone: "warn" }, confirmed: { label: "확정", tone: "accent" }, paid: { label: "지급 완료", tone: "good" } } as const;
const PAGE = 20;

export function RevenueView(p: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [importing, setImporting] = useState<RevenuePlatform | null>(null);
  const [preview, setPreview] = useState<{ name: string; rows: number; columns: string[] } | null>(null);

  const label = (k: RevenuePlatform) => p.platforms.find((x) => x.key === k)!.label;
  const filtered = p.entries.filter((e) =>
    filter === "all" ? true : filter === "unlinked" ? !e.video_id : filter === "expected" ? e.status === "expected" : e.platform === filter,
  );
  const unlinkedCount = p.entries.filter((e) => !e.video_id).length;
  const monthNo = Number(p.month.slice(5));

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    setPreview({ name: file.name, rows: Math.max(0, lines.length - 1), columns: (lines[0] ?? "").split(",").map((c) => c.replace(/^"|"$/g, "").trim()) });
  }

  return (
    <>
      <PageHeader
        title="수익"
        sub="쿠팡 파트너스 · 네이버 브랜드커넥트 · 오늘의집 큐레이터 통합 · 건별 기록"
        right={
          <>
            <button type="button" className={btn.secondary} onClick={() => setImporting(importing ? null : "coupang_partners")} aria-expanded={!!importing}>
              CSV 업로드
            </button>
            <button type="button" className={btn.primary} disabled>
              + 수익 입력 (4단계)
            </button>
          </>
        }
      />

      {importing && (
        <Card className="mb-4">
          <CardHeader title="플랫폼 CSV 업로드" sub="각 관리자 화면에서 내려받은 정산·수익 내역 파일 · 지금은 미리보기만 (저장은 4단계)" />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
              플랫폼
              <select value={importing} onChange={(e) => setImporting(e.target.value as RevenuePlatform)} className="min-h-10 rounded-lg border border-field bg-surface px-3 text-sm">
                {p.platforms.map((x) => (
                  <option key={x.key} value={x.key}>{x.label}</option>
                ))}
              </select>
            </label>
            <label className={btn.accent + " cursor-pointer"}>
              파일 고르기
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </div>
          {preview && (
            <p role="status" className="mt-3 text-[13px]">
              <strong>{preview.name}</strong> · {num(preview.rows)}행 · 열: {preview.columns.slice(0, 8).join(", ")}
              {preview.columns.length > 8 ? " …" : ""}
              <span className="block text-xs text-muted">
                주문·건 식별자 열이 있으면 같은 파일을 두 번 올려도 중복으로 쌓이지 않습니다. 추적 값 열({`yt_{영상ID}`})로 영상이 자동 연결됩니다.
              </span>
            </p>
          )}
        </Card>
      )}

      <section aria-label="이번 달 요약" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`${monthNo}월 합계 (확정)`}
          value={krw(p.current.confirmed)}
          delta={`전월 확정 ${krw(p.previous.confirmed)} · 이번 달은 진행 중`}
          deltaTone="neutral"
          note={`예상 ${krw(p.current.expected)} 별도 · 확정은 보통 다음 달에 반영`}
          badge={<Badge tone="sample">샘플</Badge>}
          info={<InfoTip label="확정 수익">상태가 "확정" 또는 "지급 완료"인 건의 합계. "예상"은 플랫폼에서 아직 확정되지 않은 금액이라 따로 표시합니다.</InfoTip>}
        />
        {p.current.byPlatform.map((x) => (
          <StatCard
            key={x.key}
            label={x.label}
            value={krw(x.confirmed)}
            note={`${x.count}건 · 예상 ${krw(x.expected)} · 마지막 입력 ${x.lastDate ? fullDate(x.lastDate).slice(5) : "—"}`}
            badge={<span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: PLATFORM_COLORS[x.key] }} />}
          />
        ))}
      </section>

      <Card className="mb-4">
        <CardHeader title="월별 확정 수익 · 최근 12개월" sub="확정·지급 완료 금액만 쌓아 표시 · 예상 금액은 표에서 확인" />
        <RevenueStackChart data={p.series} platforms={p.platforms} />
      </Card>

      <Card>
        <CardHeader title="수익 내역" sub={`${num(filtered.length)}건`} />
        <div className="mb-3">
          <Chips
            label="내역 필터"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setShown(PAGE);
            }}
            options={[
              { value: "all", label: "전체" },
              ...p.platforms.map((x) => ({ value: x.key as Filter, label: x.label })),
              { value: "unlinked", label: "영상 미연결", count: unlinkedCount },
              { value: "expected", label: "예상" },
            ]}
          />
        </div>
        {filtered.length === 0 ? (
          <Empty>해당하는 내역이 없습니다.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-2 py-2.5 font-medium">날짜</th>
                  <th className="px-2 py-2.5 font-medium">플랫폼</th>
                  <th className="px-2 py-2.5 font-medium">추적 값</th>
                  <th className="px-2 py-2.5 font-medium">연결 영상</th>
                  <th className="px-2 py-2.5 font-medium">상태</th>
                  <th className="px-2 py-2.5 text-right font-medium">금액</th>
                  <th className="px-2 py-2.5 font-medium">출처</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, shown).map((e) => (
                  <tr key={e.id} className="border-b border-line-soft">
                    <td className="tabular px-2 py-2.5">{fullDate(e.entry_date)}</td>
                    <td className="px-2 py-2.5">{label(e.platform)}</td>
                    <td className="px-2 py-2.5 font-mono text-xs text-sub">{e.tracking_code ?? "—"}</td>
                    <td className="max-w-[260px] truncate px-2 py-2.5">
                      {e.video_id ? <Link href={`/analytics?video=${e.video_id}`}>{p.videos[e.video_id]}</Link> : <span className="text-muted">미연결</span>}
                    </td>
                    <td className="px-2 py-2.5"><Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge></td>
                    <td className="tabular px-2 py-2.5 text-right font-bold">{krw(e.amount_krw)}</td>
                    <td className="px-2 py-2.5"><Badge tone="csv">{e.source === "csv" ? "CSV" : "수동"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {shown < filtered.length && (
          <button type="button" className={btn.secondary + " mt-3"} onClick={() => setShown((s) => s + PAGE)}>
            {Math.min(PAGE, filtered.length - shown)}건 더 보기
          </button>
        )}
        <div className="mt-4 rounded-lg bg-ground px-4 py-3">
          <p className="text-[13px] font-bold">추적 값 규칙</p>
          <p className="text-xs text-sub">
            제휴 링크를 만들 때 영상 ID를 추적 값으로 붙이면(예: {`yt_{영상ID}`}) CSV를 올릴 때 영상이 자동으로 연결됩니다. 추적 값이 없는 건은 "영상 미연결"에서 직접 연결합니다.
          </p>
        </div>
      </Card>
    </>
  );
}
