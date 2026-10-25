"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Card, CardHeader, Empty, PageHeader, Progress, btn, cx, fieldFull } from "@/components/ui";
import { diffDays, fullDate } from "@/lib/dates";
import { krw, num } from "@/lib/format";
import { METRICS, STAGES, VERDICT } from "@/lib/labels";
import { goalProgress } from "@/lib/metrics";
import type { Goal, GoalMilestone, GoalNote, Stage, Verdict } from "@/lib/types";

interface Props {
  today: string;
  goals: Goal[];
  milestones: GoalMilestone[];
  notes: GoalNote[];
  metricValues: Record<string, number>;
  projects: { id: string; title: string; goal_id: string | null; stage: Stage }[];
  experiments: { id: string; hypothesis: string; goal_id: string | null; verdict: Verdict; insight_id: string | null }[];
  insights: { id: string; content: string }[];
}

const STATUS = { active: { label: "진행 중", tone: "accent" }, achieved: { label: "달성", tone: "good" }, paused: { label: "보류", tone: "warn" }, dropped: { label: "포기", tone: "neutral" } } as const;

export function GoalsView(p: Props) {
  const [selected, setSelected] = useState(p.goals[0]?.id ?? null);
  const [milestones, setMilestones] = useState(p.milestones);
  const [notes, setNotes] = useState(p.notes);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const metricOf = (g: Goal) => (g.metric_key ? (p.metricValues[g.metric_key] ?? null) : null);
  const goal = p.goals.find((g) => g.id === selected) ?? null;
  const active = p.goals.filter((g) => g.status === "active").length;

  return (
    <>
      <PageHeader
        title="목표"
        sub={`채널 운영으로 이루고 싶은 개인 목표 · 진행 중 ${active} · 달성 ${p.goals.filter((g) => g.status === "achieved").length}`}
        right={
          <button type="button" className={btn.primary} disabled>
            + 새 목표 (4단계)
          </button>
        }
      />

      <section aria-label="목표 목록" className="mb-4 grid gap-3 md:grid-cols-3">
        {p.goals.map((g) => {
          const prog = goalProgress(g, milestones, metricOf(g));
          const on = g.id === selected;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => setSelected(g.id)}
              className={cx("flex flex-col gap-2.5 rounded-xl border bg-surface p-4 text-left", on ? "border-[1.5px] border-navy" : "border-line hover:border-field")}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="text-[15px] font-bold">{g.title}</span>
                <span className="tabular shrink-0 text-[13px] font-bold text-navy">D-{diffDays(g.target_date, p.today)}</span>
              </span>
              <span className="text-xs text-muted">{prog.kind === "metric" ? `숫자 목표 · ${METRICS[g.metric_key!]?.label_ko} 연결` : `단계형 목표 · 마일스톤 ${prog.total}개`}</span>
              <Progress value={prog.pct} label={`${g.title} 진행률`} className="w-full" />
              <span className="tabular text-xs text-muted">
                {prog.kind === "metric"
                  ? `${g.metric_key === "monthly_revenue_krw" ? krw(prog.current) : num(prog.current)} / ${g.metric_key === "monthly_revenue_krw" ? krw(prog.target) : num(prog.target)} · ${Math.round(prog.pct)}%`
                  : `마일스톤 ${prog.done} / ${prog.total} 완료 · ${Math.round(prog.pct)}%`}
              </span>
            </button>
          );
        })}
      </section>

      {toast && (
        <p role="status" className="mb-4 rounded-lg bg-good-bg px-4 py-2.5 text-[13px] text-good-fg">
          {toast}
        </p>
      )}

      {goal && (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_minmax(0,340px)]">
          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-2">
                <Badge tone={STATUS[goal.status].tone} className="self-start">{STATUS[goal.status].label}</Badge>
                <h2 className="text-xl font-bold">{goal.title}</h2>
                <p className="text-[13px] text-sub">{goal.description}</p>
              </div>
            </div>
            <dl className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-ground p-3">
                <dt className="text-xs text-muted">목표일</dt>
                <dd className="text-sm font-bold">{fullDate(goal.target_date)} · D-{diffDays(goal.target_date, p.today)}</dd>
              </div>
              <div className="rounded-lg bg-ground p-3">
                <dt className="text-xs text-muted">구체적 기준</dt>
                <dd className="text-sm">{goal.success_criteria}</dd>
              </div>
              <div className="rounded-lg bg-ground p-3">
                <dt className="text-xs text-muted">진행률 계산</dt>
                <dd className="text-sm">{goal.metric_key ? `${METRICS[goal.metric_key]?.label_ko} 자동 계산 (샘플 값)` : "마일스톤 완료 비율"}</dd>
              </div>
            </dl>

            {!goal.metric_key && (
              <>
                <h3 className="mb-1 text-sm font-bold">
                  마일스톤 {milestones.filter((m) => m.goal_id === goal.id && m.completed_at).length} / {milestones.filter((m) => m.goal_id === goal.id).length}
                </h3>
                <ul>
                  {milestones
                    .filter((m) => m.goal_id === goal.id)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((m) => {
                      const overdue = !m.completed_at && m.due_date < p.today;
                      return (
                        <li key={m.id} className="flex flex-wrap items-center gap-3 border-b border-line-soft py-2.5">
                          <label className="flex min-h-9 flex-[1_1_240px] items-center gap-2.5 text-sm">
                            <input
                              type="checkbox"
                              className="size-[18px] accent-navy"
                              checked={!!m.completed_at}
                              onChange={() => setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, completed_at: x.completed_at ? null : new Date().toISOString() } : x)))}
                            />
                            <span className={m.completed_at ? "text-muted line-through" : ""}>{m.title}</span>
                          </label>
                          <span className={cx("w-36 text-xs", overdue ? "font-bold text-warn" : "text-muted")}>
                            목표 {fullDate(m.due_date)}
                            {m.completed_at ? " · 완료" : overdue ? " · 지남" : ""}
                          </span>
                          {!m.completed_at && (
                            <button type="button" className={btn.secondary + " min-h-8 px-2.5 text-xs"} onClick={() => setToast(`"${m.title}"을(를) 이번 주 작업으로 보냈습니다 (4단계에서 저장 연결)`)}>
                              이번 주 작업으로 보내기
                            </button>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </>
            )}
            {goal.metric_key && (
              <p className="rounded-lg border border-line-soft p-3 text-[13px] text-sub">
                이 목표는 {METRICS[goal.metric_key]?.label_ko} 값으로 진행률을 자동 계산합니다. 현재{" "}
                <strong className="text-ink">{goal.metric_key === "monthly_revenue_krw" ? krw(metricOf(goal)) : num(metricOf(goal))}</strong> (
                {goal.metric_key === "monthly_revenue_krw" ? "이번 달 확정 수익" : "지표 기준일 구독자 수"}, 샘플).
              </p>
            )}
          </Card>

          <aside className="flex flex-col gap-4">
            <Card>
              <CardHeader title="연결된 기록" level={3} />
              <ul className="flex flex-col gap-2 text-[13px]">
                {p.projects.filter((x) => x.goal_id === goal.id).map((x) => (
                  <li key={x.id}>
                    <Badge tone="neutral">제작 · {STAGES.find((s) => s.key === x.stage)?.label}</Badge> <Link href="/routine">{x.title}</Link>
                  </li>
                ))}
                {p.experiments.filter((x) => x.goal_id === goal.id).map((x) => (
                  <li key={x.id}>
                    <Badge tone={VERDICT[x.verdict].tone}>실험 · {VERDICT[x.verdict].label}</Badge> <Link href={`/experiments?id=${x.id}`}>{x.hypothesis}</Link>
                    {x.insight_id && <span className="block pl-1 text-xs text-muted">근거: {p.insights.find((i) => i.id === x.insight_id)?.content}</span>}
                  </li>
                ))}
                {!p.projects.some((x) => x.goal_id === goal.id) && !p.experiments.some((x) => x.goal_id === goal.id) && <li className="text-muted">아직 연결된 기록이 없습니다.</li>}
              </ul>
            </Card>
            <Card>
              <CardHeader title="메모 타임라인" level={3} />
              <form
                className="mb-3 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!draft.trim()) return;
                  setNotes((ns) => [{ id: `gn-${Date.now()}`, goal_id: goal.id, body: draft.trim(), created_at: new Date().toISOString() }, ...ns]);
                  setDraft("");
                }}
              >
                <label htmlFor="note" className="sr-only">메모 추가</label>
                <textarea id="note" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="진행 상황이나 막힌 점" className={fieldFull + " py-2"} />
                <button type="submit" className={btn.secondary + " self-end"}>메모 추가</button>
              </form>
              {notes.filter((n) => n.goal_id === goal.id).length === 0 && <Empty>메모가 없습니다.</Empty>}
              <ol className="flex flex-col gap-3">
                {notes
                  .filter((n) => n.goal_id === goal.id)
                  .map((n) => (
                    <li key={n.id} className="border-l-2 border-line pl-3">
                      <span className="text-xs text-muted">{fullDate(n.created_at.slice(0, 10))}</span>
                      <p className="text-[13px]">{n.body}</p>
                    </li>
                  ))}
              </ol>
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}
