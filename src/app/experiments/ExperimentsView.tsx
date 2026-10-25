"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Chips } from "@/components/controls";
import { Badge, Card, CardHeader, Empty, PageHeader, btn, cx, fieldFull } from "@/components/ui";
import { fullDate } from "@/lib/dates";
import { num, pct } from "@/lib/format";
import { METRICS, VERDICT } from "@/lib/labels";
import type { ExperimentComparison } from "@/lib/metrics";
import type { ContentType, Experiment, Goal, Insight, Lecture, Verdict } from "@/lib/types";

interface Row {
  ex: Experiment;
  video: { id: string; title: string; content_type: ContentType; published_at: string } | null;
  baselineTitles: string[];
  insight: Insight | null;
  lecture: Lecture | null;
  goal: Goal | null;
  primary: ExperimentComparison;
  secondary: ExperimentComparison[];
}

type Filter = "all" | Verdict;

export function ExperimentsView({ rows }: { rows: Row[] }) {
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState(params.get("id") ?? rows[0]?.ex.id ?? null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(Object.fromEntries(rows.map((r) => [r.ex.id, r.ex.verdict])));

  const keys: Filter[] = ["all", "planned", "running", "success", "fail", "pending"];
  const list = rows.filter((r) => filter === "all" || verdicts[r.ex.id] === filter);
  const row = rows.find((r) => r.ex.id === selected) ?? null;

  return (
    <>
      <PageHeader
        title="실험·회고"
        sub="가설 → 적용 → 같은 경과일 기준으로 전후 비교 → 판정 → 다음 실험"
        right={
          <button type="button" className={btn.primary} disabled title="4단계에서 저장 연결">
            + 새 실험 (4단계)
          </button>
        }
      />
      <div className="mb-4">
        <Chips
          label="상태 필터"
          value={filter}
          onChange={setFilter}
          options={keys.map((k) => ({
            value: k,
            label: k === "all" ? "전체" : VERDICT[k].label,
            count: k === "all" ? rows.length : rows.filter((r) => verdicts[r.ex.id] === k).length,
          }))}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
        <section aria-label="실험 목록" className="flex flex-col gap-2">
          {list.length === 0 && <Empty>이 상태의 실험이 없습니다.</Empty>}
          {list.map((r) => {
            const on = r.ex.id === selected;
            const v = VERDICT[verdicts[r.ex.id]];
            return (
              <button
                key={r.ex.id}
                type="button"
                onClick={() => setSelected(r.ex.id)}
                aria-pressed={on}
                className={cx("flex flex-col gap-2 rounded-xl border bg-surface px-4 py-3.5 text-left", on ? "border-[1.5px] border-navy" : "border-line hover:border-field")}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className={cx("text-sm", on ? "font-bold" : "font-medium")}>{r.ex.hypothesis}</span>
                  <Badge tone={v.tone}>{v.label}</Badge>
                </span>
                <span className="text-xs text-muted">
                  측정: {METRICS[r.ex.metric_key]?.label_ko} · {r.video ? r.video.title : "적용 영상 미정"}
                </span>
              </button>
            );
          })}
        </section>

        <Card>
          {!row ? (
            <Empty>왼쪽에서 실험을 고르세요.</Empty>
          ) : (
            <Detail row={row} verdict={verdicts[row.ex.id]} onVerdict={(v) => setVerdicts((s) => ({ ...s, [row.ex.id]: v }))} />
          )}
        </Card>
      </div>
    </>
  );
}

function fmt(c: ExperimentComparison, v: number | null) {
  if (v === null) return "—";
  return c.unit === "percent" ? pct(v) : num(v);
}
function fmtDiff(c: ExperimentComparison) {
  if (c.diff === null) return "—";
  const sign = c.diff > 0 ? "+" : c.diff < 0 ? "−" : "";
  return c.unit === "percent" ? `${sign}${Math.abs(c.diff).toFixed(1)}%p` : `${sign}${num(Math.abs(c.diff))}`;
}

function Detail({ row, verdict, onVerdict }: { row: Row; verdict: Verdict; onVerdict: (v: Verdict) => void }) {
  const { ex, primary } = row;
  const v = VERDICT[verdict];
  const all = [primary, ...row.secondary];
  const typeLabel = row.video ? (row.video.content_type === "long" ? "일반 영상" : "쇼츠") : "";

  return (
    <>
      <div className="mb-4 flex flex-col gap-2">
        <Badge tone={v.tone} className="self-start">{v.label}</Badge>
        <h2 className="text-xl font-bold">{ex.hypothesis}</h2>
      </div>
      <dl className="mb-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">근거 인사이트</dt>
          <dd>{row.insight ? <Link href="/insights">{row.insight.content}</Link> : "—"}{row.lecture && <span className="block text-xs text-muted">{row.lecture.title}</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">적용 영상</dt>
          <dd>{row.video ? <Link href={`/analytics?video=${row.video.id}`}>{row.video.title}</Link> : "아직 없음"}{row.video && <span className="block text-xs text-muted">{typeLabel} · 업로드 {fullDate(row.video.published_at.slice(0, 10))}</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">실행 내용</dt>
          <dd>{ex.action_detail}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">연결 목표</dt>
          <dd>{row.goal ? <Link href="/goals">{row.goal.title}</Link> : "—"}</dd>
        </div>
      </dl>

      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">실행 전후 비교</h3>
        <span className="text-xs text-muted">
          {typeLabel ? `같은 유형(${typeLabel}) · ` : ""}업로드 후 {row.video && !primary.ready ? `${primary.comparedDays}일 기준(임시)` : `${ex.compare_days_since_publish}일 기준`} · 기준값은 이전 영상 {row.baselineTitles.length}편의 중간값
        </span>
      </div>
      {!row.video ? (
        <Empty>적용 영상을 올리면 비교가 시작됩니다.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-2 py-2.5 font-medium">지표</th>
                  <th className="px-2 py-2.5 text-right font-medium">기준(중간값)</th>
                  <th className="px-2 py-2.5 text-right font-medium">실험 영상</th>
                  <th className="px-2 py-2.5 text-right font-medium">차이</th>
                </tr>
              </thead>
              <tbody>
                {all.map((c, i) => (
                  <tr key={c.metricKey} className="border-b border-line-soft">
                    <td className={cx("px-2 py-2.5", i === 0 && "font-bold")}>
                      {METRICS[c.metricKey]?.label_ko} {i === 0 ? <Badge tone="accent">주 지표</Badge> : <span className="text-xs text-muted">(보조)</span>}
                      {c.metricKey === "impressions_ctr" && <> <Badge tone="csv">CSV</Badge></>}
                    </td>
                    <td className="tabular px-2 py-2.5 text-right">{fmt(c, c.baseline)}</td>
                    <td className="tabular px-2 py-2.5 text-right">{fmt(c, c.value)}</td>
                    <td className={cx("tabular px-2 py-2.5 text-right font-bold", c.diff === null ? "" : c.diff > 0 ? "text-good" : c.diff < 0 ? "text-warn" : "")}>{fmtDiff(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
            <li>
              데이터 상태: 업로드 후 {primary.daysObserved}일 경과
              {primary.ready
                ? " · 판정 가능"
                : ` · 기준 영상도 같은 ${primary.comparedDays}일까지만 잘라 임시 비교 중 · ${ex.compare_days_since_publish}일이 지나야 판정 가능`}
            </li>
            {all.find((c) => c.note) && <li>{all.find((c) => c.note)!.note}</li>}
            <li>기준 영상: {row.baselineTitles.join(", ")}</li>
          </ul>
        </>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-line-soft pt-4">
        <h3 className="text-sm font-bold">판정</h3>
        <div role="group" aria-label="판정 선택" className="flex flex-wrap gap-2">
          {(["success", "fail", "pending"] as Verdict[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={verdict === k}
              onClick={() => onVerdict(k)}
              className={cx(
                "min-h-10 rounded-lg border px-4 text-[13px] font-bold",
                verdict === k ? (k === "success" ? "border-good bg-good-bg text-good-fg" : k === "fail" ? "border-bad bg-bad-bg text-bad" : "border-sample-fg bg-sample-bg text-sample-fg") : "border-field bg-surface text-sub",
              )}
            >
              {VERDICT[k].label}
            </button>
          ))}
          <button type="button" className={btn.ai} disabled>
            AI 판정 보조 (6단계)
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-sub">
          판정 이유
          <textarea key={ex.id} rows={3} defaultValue={ex.verdict_reason ?? ""} placeholder="어떤 근거로 판정했는지" className={fieldFull + " py-2 font-normal"} />
        </label>
        {ex.verdict_reason?.includes("샘플") && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Badge tone="sample">샘플</Badge> 위 판정 이유는 샘플 데이터에 맞춘 예시 문장입니다.
          </p>
        )}
        <button type="button" className={btn.accent + " self-start"} disabled>
          → 이 결과로 다음 실험 만들기 (4단계)
        </button>
      </div>
    </>
  );
}
