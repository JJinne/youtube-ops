"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import * as act from "@/app/actions/routine";
import type { ActionResult } from "@/app/actions/result";
import { Badge, Card, CardHeader, Empty, InfoTip, PageHeader, StatCard, btn, cx, field, fieldFull } from "@/components/ui";
import { Icon } from "@/components/icons";
import { addDays, fullDate, range, shortDate, weekdayKo, weekStartOf } from "@/lib/dates";
import { duration, signedPct } from "@/lib/format";
import { STAGES, TIME_STAGE_LABEL } from "@/lib/labels";
import { completionRate, estimateAccuracy, weekTimeComparison } from "@/lib/metrics";
import { carryOverCopies, type RoutineTemplate } from "@/lib/routine-logic";
import type { Stage, Task, TimeEntry, TimeStage, Video, VideoProject, WeeklyReview } from "@/lib/types";

interface Props {
  live: boolean;
  today: string;
  currentWeek: string;
  tasks: Task[];
  projects: VideoProject[];
  videos: Video[];
  timeEntries: TimeEntry[];
  reviews: WeeklyReview[];
  templates: RoutineTemplate[];
  runningTimer: { id: string; stage: TimeStage; project_id: string | null; started_at: string } | null;
  loadError: string | null;
}

interface Timer {
  id: string | null; // 샘플 모드는 null
  stage: TimeStage;
  projectId: string | null;
  startedAt: number;
}

type Toast = { kind: "ok" | "error"; text: string } | null;

const TIME_STAGES: TimeStage[] = ["plan", "script", "shoot", "edit", "upload", "routine", "other"];
const SAMPLE_NOTE = " (샘플 모드라 새로고침하면 사라집니다)";

export function RoutineView(p: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const earliest = addDays(p.currentWeek, -14);
  const [week, setWeek] = useState(p.currentWeek);
  const [tasks, setTasks] = useState(p.tasks);
  const [entries, setEntries] = useState(p.timeEntries);
  const [projects, setProjects] = useState(p.projects);
  const [timer, setTimer] = useState<Timer | null>(() => fromRunning(p.runningTimer));
  const [now, setNow] = useState(() => Date.now());
  const activeProjects = projects.filter((x) => x.stage !== "upload" || x.week_start === p.currentWeek);
  const [timerStage, setTimerStage] = useState<TimeStage>("edit");
  const [timerProject, setTimerProject] = useState<string>(() => activeProjects[0]?.id ?? "");
  const [panel, setPanel] = useState<"none" | "time" | "task" | "project">("none");
  const [toast, setToast] = useState<Toast>(p.loadError ? { kind: "error", text: `데이터를 불러오지 못했습니다: ${p.loadError}` } : null);

  // 저장 후 서버에서 새로 받은 값으로 맞춘다
  useEffect(() => setTasks(p.tasks), [p.tasks]);
  useEffect(() => setEntries(p.timeEntries), [p.timeEntries]);
  useEffect(() => setProjects(p.projects), [p.projects]);
  useEffect(() => {
    if (p.live) setTimer(fromRunning(p.runningTimer));
  }, [p.live, p.runningTimer]);

  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!toast || toast.kind === "error") return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  /** 실제 모드: 서버 저장 후 새로고침. 샘플 모드: 화면 안에서만 반영 */
  function run<T>(action: () => Promise<ActionResult<T>>, okText: (data?: T) => string, sample?: () => void) {
    if (!p.live) {
      sample?.();
      setToast({ kind: "ok", text: okText() + SAMPLE_NOTE });
      return;
    }
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setToast({ kind: "error", text: r.error });
        return;
      }
      setToast({ kind: "ok", text: okText(r.data) });
      router.refresh();
    });
  }

  const weekEnd = addDays(week, 6);
  const days = range(week, weekEnd);
  const weekTasks = tasks.filter((t) => t.week_start === week);
  const rate = completionRate(tasks, week);
  const time = useMemo(() => weekTimeComparison(entries, projects, p.videos, week, p.today), [entries, projects, p.videos, week, p.today]);
  const accuracy = useMemo(() => estimateAccuracy(tasks, entries, projects, week), [tasks, entries, projects, week]);
  const isCurrent = week === p.currentWeek;
  const carryable = carryOverCopies(tasks, week, p.today);
  const review = p.reviews.find((r) => r.week_start === week);
  const maxStage = Math.max(1, ...time.byStage.flatMap((s) => [s.now, s.before]));

  function toggleTask(t: Task) {
    const doneNow = !t.completed_at;
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, completed_at: doneNow ? new Date().toISOString() : null } : x)));
    if (p.live) {
      startTransition(async () => {
        const r = await act.setTaskDone(t.id, doneNow);
        if (!r.ok) {
          setToast({ kind: "error", text: r.error });
          setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, completed_at: t.completed_at } : x)));
        } else router.refresh();
      });
    }
  }

  function startTimer() {
    const t = Date.now();
    setNow(t);
    run(
      () => act.startTimer({ stage: timerStage, project_id: timerProject || undefined }),
      () => `${TIME_STAGE_LABEL[timerStage]} 타이머를 시작했습니다. 다른 기기에서도 이어서 멈출 수 있습니다`,
      () => setTimer({ id: null, stage: timerStage, projectId: timerProject || null, startedAt: t }),
    );
  }

  function stopTimer() {
    if (!timer) return;
    const minutes = Math.max(1, Math.round((Date.now() - timer.startedAt) / 60000));
    run(
      () => act.stopTimer(timer.id!),
      (d) => `${TIME_STAGE_LABEL[timer.stage]} ${duration(d?.minutes ?? minutes)} 기록했습니다`,
      () => {
        setEntries((xs) => [...xs, { id: `local-${Date.now()}`, task_id: null, project_id: timer.projectId, stage: timer.stage, source: "timer", minutes, entry_date: p.today, week_start: weekStartOf(p.today) }]);
        setTimer(null);
      },
    );
  }

  const elapsedSec = timer ? Math.max(0, Math.floor((now - timer.startedAt) / 1000)) : 0;
  const clock = `${String(Math.floor(elapsedSec / 3600)).padStart(2, "0")}:${String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}`;
  const perLong = time.perVideo.find((x) => x.type === "long")!;
  const perShort = time.perVideo.find((x) => x.type === "short")!;
  const totalDelta = time.total.now - time.total.before;

  return (
    <>
      <PageHeader
        title="주간 제작 루틴"
        sub={
          <span className="flex items-center gap-2">
            <button type="button" aria-label="지난주" className="flex size-9 items-center justify-center rounded-lg border border-field bg-surface text-sub disabled:opacity-40" disabled={week <= earliest} onClick={() => setWeek(addDays(week, -7))}>
              <Icon.chevronLeft width={16} height={16} />
            </button>
            <span className="text-[13px] text-sub">
              {fullDate(week)}(일) – {shortDate(weekEnd)} {isCurrent && <Badge tone="accent">이번 주</Badge>}
            </span>
            <button type="button" aria-label="다음 주" className="flex size-9 items-center justify-center rounded-lg border border-field bg-surface text-sub disabled:opacity-40" disabled={week >= addDays(p.currentWeek, 7)} onClick={() => setWeek(addDays(week, 7))}>
              <Icon.chevronRight width={16} height={16} />
            </button>
          </span>
        }
        right={
          <>
            <span className="text-[13px] text-sub">
              완료율 <strong className="tabular text-navy">{rate.rate === null ? "—" : `${Math.round(rate.rate)}%`}</strong> ({rate.done}/{rate.total})
            </span>
            {timer ? (
              <>
                <button type="button" className={btn.primary} onClick={stopTimer} disabled={pending} aria-live="polite">
                  <Icon.clock width={16} height={16} /> 정지 · {TIME_STAGE_LABEL[timer.stage]} <span className="tabular">{clock}</span>
                </button>
                {p.live && timer.id && (
                  <button type="button" className={btn.secondary} disabled={pending} onClick={() => run(() => act.cancelTimer(timer.id!), () => "타이머를 기록 없이 취소했습니다")}>
                    취소
                  </button>
                )}
              </>
            ) : (
              <button type="button" className={btn.accent} onClick={startTimer} disabled={pending}>
                <Icon.clock width={16} height={16} /> 타이머 시작
              </button>
            )}
            <button type="button" className={btn.secondary} onClick={() => setPanel(panel === "time" ? "none" : "time")} aria-expanded={panel === "time"}>
              시간 직접 입력
            </button>
            <button type="button" className={btn.secondary} onClick={() => setPanel(panel === "task" ? "none" : "task")} aria-expanded={panel === "task"}>
              <Icon.plus width={16} height={16} /> 작업
            </button>
          </>
        }
      />

      {!timer && (
        <div className="-mt-3 mb-4 flex flex-wrap items-center gap-2 text-[13px] text-sub">
          <span>타이머 설정</span>
          <label className="sr-only" htmlFor="ts">단계</label>
          <select id="ts" value={timerStage} onChange={(e) => setTimerStage(e.target.value as TimeStage)} className={field + " min-h-9"}>
            {TIME_STAGES.map((s) => (
              <option key={s} value={s}>{TIME_STAGE_LABEL[s]}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="tp">영상</label>
          <select id="tp" value={timerProject} onChange={(e) => setTimerProject(e.target.value)} className={field + " min-h-9 max-w-[260px]"}>
            <option value="">영상과 무관 (반복 작업 등)</option>
            {activeProjects.map((x) => (
              <option key={x.id} value={x.id}>{x.title}</option>
            ))}
          </select>
        </div>
      )}

      {panel === "time" && (
        <ManualEntry
          projects={activeProjects}
          earliest={earliest}
          today={p.today}
          pending={pending}
          onAdd={(e) => {
            run(
              () => act.addManualTime({ stage: e.stage, project_id: e.project_id ?? undefined, minutes: e.minutes, entry_date: e.entry_date }),
              () => `${TIME_STAGE_LABEL[e.stage]} ${duration(e.minutes)} 기록했습니다`,
              () => setEntries((xs) => [...xs, { ...e, id: `local-${Date.now()}`, week_start: weekStartOf(e.entry_date) }]),
            );
            setPanel("none");
          }}
        />
      )}

      {panel === "task" && (
        <TaskForm
          projects={activeProjects}
          weekStart={week}
          pending={pending}
          onAdd={(t) => {
            run(
              () => act.createTask(t),
              () => `"${t.title}" 작업을 추가했습니다`,
              () =>
                setTasks((xs) => [
                  ...xs,
                  { id: `local-${Date.now()}`, project_id: t.project_id || null, routine_template_id: null, title: t.title, stage: (t.stage as Stage) || null, due_date: t.due_date, completed_at: null, week_start: weekStartOf(t.due_date), estimated_minutes: t.estimated_minutes ?? null, carried_from_task_id: null },
                ]),
            );
            setPanel("none");
          }}
        />
      )}

      {toast && (
        <p role={toast.kind === "error" ? "alert" : "status"} className={cx("mb-4 flex items-start justify-between gap-3 rounded-lg px-4 py-2.5 text-[13px]", toast.kind === "error" ? "bg-bad-bg text-bad" : "bg-good-bg text-good-fg")}>
          <span>{toast.text}</span>
          {toast.kind === "error" && (
            <button type="button" className="shrink-0 font-bold underline" onClick={() => setToast(null)}>
              닫기
            </button>
          )}
        </p>
      )}

      {/* 주간 보드 */}
      <Card className="mb-4 p-4" aria-label="주간 보드">
        {p.live && tasks.length === 0 && p.templates.length === 0 && (
          <p className="mb-3 rounded-lg bg-navy-tint px-3 py-2 text-[13px] text-navy">
            첫 주입니다. 위의 "+ 작업"으로 이번 주 할 일을 넣거나, 설정에서 매주 반복할 작업을 등록하세요.
          </p>
        )}
        <div className="overflow-x-auto">
          <div className="grid min-w-[920px] grid-cols-7 gap-2">
            {days.map((d) => {
              const dayTasks = weekTasks.filter((t) => t.due_date === d);
              const isToday = d === p.today;
              return (
                <div key={d} className={cx("flex min-h-[220px] flex-col gap-2 rounded-xl p-2.5", isToday ? "bg-navy-tint" : "bg-ground")}>
                  <div className="flex items-baseline justify-between">
                    <span className={cx("text-[13px] font-bold", isToday ? "text-navy" : "")}>{weekdayKo(d)}</span>
                    <span className="text-xs text-muted">{shortDate(d, false)}</span>
                  </div>
                  {dayTasks.length === 0 && <span className="text-xs text-muted">작업 없음</span>}
                  {dayTasks.map((t) => {
                    const project = projects.find((x) => x.id === t.project_id);
                    return (
                      <div key={t.id} className="group relative rounded-lg border border-line bg-surface">
                        <label className="flex items-start gap-2 p-2 pr-6 text-xs leading-relaxed">
                          <input type="checkbox" checked={!!t.completed_at} onChange={() => toggleTask(t)} className="mt-0.5 size-4 shrink-0 accent-navy" />
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className={t.completed_at ? "text-muted line-through" : ""}>{t.title}</span>
                            <span className="text-muted">
                              {t.routine_template_id ? "반복" : t.stage ? STAGES.find((s) => s.key === t.stage)?.label : ""}
                              {project ? ` · ${project.content_type === "long" ? "일반" : "쇼츠"}` : ""}
                              {t.estimated_minutes ? ` · 예상 ${duration(t.estimated_minutes)}` : ""}
                            </span>
                            {t.carried_from_task_id && <Badge tone="warn" className="self-start">지난주에서 이월</Badge>}
                          </span>
                        </label>
                        {p.live && (
                          <button
                            type="button"
                            aria-label={`${t.title} 삭제`}
                            className="absolute right-1 top-1 flex size-6 items-center justify-center rounded text-muted opacity-60 hover:bg-bad-bg hover:text-bad hover:opacity-100 focus:opacity-100"
                            onClick={() => run(() => act.deleteTask(t.id), () => `"${t.title}" 작업을 지웠습니다`)}
                          >
                            <Icon.close width={12} height={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 투여 시간 */}
      <Card className="mb-4" aria-label="투여 시간">
        <CardHeader
          title="투여 시간 · 지난주 대비"
          sub={
            time.inProgress
              ? `진행 중인 주라 공정하게 비교하려고 지난주도 같은 요일까지(${shortDate(time.prevRange.start, false)}–${shortDate(time.prevRange.end)})만 잘라 비교합니다`
              : `${shortDate(time.range.start, false)}–${shortDate(time.range.end)} vs ${shortDate(time.prevRange.start, false)}–${shortDate(time.prevRange.end)}`
          }
          right={
            <InfoTip label="1편당 평균 제작 시간">
              그 주에 업로드한 영상들의 총 제작 시간(이전 주에 한 작업 포함) ÷ 편수. 만든 편수에 따라 총 시간이 달라지므로, 시간이 줄었는지는 이 값으로 판단합니다. 반복 작업 시간은 제외. 영상을 "업로드" 단계로 옮기고 YouTube 영상과 연결되면(5단계) 계산됩니다.
            </InfoTip>
          }
        />
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={time.inProgress ? `총 투여 시간 · ${time.elapsedDays}일째` : "총 투여 시간"}
            value={duration(time.total.now)}
            delta={time.total.before ? `지난주${time.inProgress ? " 같은 시점" : ""} 대비 ${totalDelta <= 0 ? "−" : "+"}${duration(Math.abs(totalDelta))}` : "비교할 지난주 기록 없음"}
            deltaTone={totalDelta < 0 ? "good" : totalDelta > 0 ? "bad" : "neutral"}
            note={`지난주 ${duration(time.total.before)}`}
          />
          <PerVideoCard label="일반 영상 1편당 평균" data={perLong} />
          <PerVideoCard label="쇼츠 1편당 평균" data={perShort} />
          <StatCard
            label="예상 대비 실제"
            value={accuracy ? `${Math.round(accuracy.ratio)}%` : "—"}
            note={accuracy ? `예상 ${duration(accuracy.estimated)} · 실제 ${duration(accuracy.actual)} · 100%보다 크면 예상보다 오래 걸림` : "완료 작업에 시간 기록이 쌓이면 계산됩니다"}
          />
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-sub">
          <span className="text-[13px] font-bold text-ink">단계별 투여 시간</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-3 rounded-sm bg-navy" />이번 기간</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-3 rounded-sm bg-[#b8c0cc]" />비교 기간</span>
        </div>
        {time.byStage.length === 0 ? (
          <Empty>이 주에는 시간 기록이 없습니다. 타이머를 켜거나 "시간 직접 입력"으로 기록하세요.</Empty>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {time.byStage.map((s) => (
              <li key={s.stage} className="grid grid-cols-[72px_minmax(0,1fr)_96px] items-center gap-3">
                <span className="text-[13px]">{TIME_STAGE_LABEL[s.stage]}</span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 rounded-[3px] bg-navy" style={{ width: `${(s.now / maxStage) * 100}%`, minWidth: s.now ? 2 : 0 }} />
                    <span className="tabular whitespace-nowrap text-[11px] text-sub">{duration(s.now)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 rounded-[3px] bg-[#b8c0cc]" style={{ width: `${(s.before / maxStage) * 100}%`, minWidth: s.before ? 2 : 0 }} />
                    <span className="tabular whitespace-nowrap text-[11px] text-muted">{duration(s.before)}</span>
                  </div>
                </div>
                <span className={cx("tabular text-right text-xs font-bold", s.delta < 0 ? "text-good" : s.delta > 0 ? "text-warn" : "text-muted")}>
                  {s.delta === 0 ? "변화 없음" : `${s.delta < 0 ? "−" : "+"}${duration(Math.abs(s.delta))}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">감소는 초록, 증가는 주황으로 표시합니다. 다른 주를 보려면 위의 ‹ › 버튼을 누르세요.</p>
      </Card>

      {/* 파이프라인 */}
      <section aria-label="제작 파이프라인" className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">제작 파이프라인</h2>
          <button type="button" className={btn.secondary} onClick={() => setPanel(panel === "project" ? "none" : "project")} aria-expanded={panel === "project"}>
            <Icon.plus width={16} height={16} /> 영상
          </button>
        </div>
        {panel === "project" && (
          <ProjectForm
            pending={pending}
            onAdd={(x) => {
              run(
                () => act.createProject(x),
                () => `"${x.title}" 영상을 아이디어 단계에 추가했습니다`,
                () => setProjects((ps) => [{ id: `local-${Date.now()}`, title: x.title, content_type: x.content_type, goal_id: null, stage: "idea", target_upload_date: x.target_upload_date || null, video_id: null, week_start: p.currentWeek }, ...ps]),
              );
              setPanel("none");
            }}
          />
        )}
        <div className="overflow-x-auto">
          <div className="grid min-w-[960px] grid-cols-6 gap-2.5">
            {STAGES.map((s, si) => {
              const cards = activeProjects.filter((x) => x.stage === s.key);
              return (
                <div key={s.key} className="flex min-h-[180px] flex-col gap-2 rounded-xl bg-track p-3">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-bold">{s.label}</span>
                    <span className="tabular text-muted">{cards.length}</span>
                  </div>
                  {cards.map((c) => {
                    const spent = entries.filter((e) => e.project_id === c.id).reduce((a, e) => a + e.minutes, 0);
                    const est = tasks.filter((t) => t.project_id === c.id).reduce((a, t) => a + (t.estimated_minutes ?? 0), 0);
                    const checks = tasks.filter((t) => t.project_id === c.id);
                    const move = (to: Stage) =>
                      run(
                        () => act.setProjectStage(c.id, to),
                        () => `"${c.title}"을(를) ${STAGES.find((x) => x.key === to)!.label} 단계로 옮겼습니다`,
                        () => setProjects((ps) => ps.map((x) => (x.id === c.id ? { ...x, stage: to } : x))),
                      );
                    return (
                      <article key={c.id} className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-2.5">
                        <span className="text-[13px] font-medium">{c.title}</span>
                        <Badge tone="neutral" className="self-start">{c.content_type === "long" ? "일반" : "쇼츠"}</Badge>
                        <span className="text-[11px] text-muted">
                          {c.target_upload_date ? `목표 ${shortDate(c.target_upload_date)}` : "목표일 미정"} · 체크 {checks.filter((t) => t.completed_at).length}/{checks.length}
                        </span>
                        <span className="text-[11px] text-sub">
                          누적 {duration(spent)}
                          {est ? ` · 예상 ${duration(est)}` : ""}
                        </span>
                        <div className="mt-1 flex justify-between">
                          <button type="button" className="flex size-8 items-center justify-center rounded-md border border-line text-sub hover:border-navy hover:text-navy disabled:opacity-30" disabled={si === 0 || pending} aria-label={`${c.title} 이전 단계로`} onClick={() => move(STAGES[si - 1].key)}>
                            <Icon.chevronLeft width={14} height={14} />
                          </button>
                          <button type="button" className="flex size-8 items-center justify-center rounded-md border border-line text-sub hover:border-navy hover:text-navy disabled:opacity-30" disabled={si === STAGES.length - 1 || pending} aria-label={`${c.title} 다음 단계로`} onClick={() => move(STAGES[si + 1].key)}>
                            <Icon.chevronRight width={14} height={14} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 회고 */}
      <Review
        key={week}
        live={p.live}
        pending={pending}
        week={week}
        review={review}
        isCurrent={isCurrent}
        summary={`자동 요약: 완료율 ${rate.rate === null ? "—" : `${Math.round(rate.rate)}%`} · 투여 시간 ${duration(time.total.now)} · 일반 영상 1편당 ${perLong.change === null ? "비교 불가" : signedPct(perLong.change)}`}
        carryCount={week <= p.currentWeek ? carryable.length : 0}
        templatesCount={p.templates.filter((t) => t.active !== false).length}
        onCarry={() =>
          run(
            () => act.carryOver(week),
            (d) => `미완료 ${d?.count ?? carryable.length}건을 다음 주로 이월했습니다`,
            () =>
              setTasks((ts) => [
                ...ts,
                ...carryable.map((c, i) => ({ ...c, id: `local-c${Date.now()}-${i}`, routine_template_id: null, completed_at: null, project_id: c.project_id, stage: c.stage, estimated_minutes: c.estimated_minutes })),
              ]),
          )
        }
        onSave={(v) => run(() => act.saveReview({ week_start: week, ...v, completion_rate: rate.rate }), () => "회고를 저장했습니다")}
      />
    </>
  );
}

function fromRunning(r: Props["runningTimer"]): Timer | null {
  return r ? { id: r.id, stage: r.stage, projectId: r.project_id, startedAt: Date.parse(r.started_at) } : null;
}

function Review({
  live,
  pending,
  week,
  review,
  isCurrent,
  summary,
  carryCount,
  templatesCount,
  onCarry,
  onSave,
}: {
  live: boolean;
  pending: boolean;
  week: string;
  review: WeeklyReview | undefined;
  isCurrent: boolean;
  summary: string;
  carryCount: number;
  templatesCount: number;
  onCarry: () => void;
  onSave: (v: { went_well: string; to_improve: string; next_focus: string }) => void;
}) {
  const [v, setV] = useState({ went_well: review?.went_well ?? "", to_improve: review?.to_improve ?? "", next_focus: review?.next_focus ?? "" });
  const dirty = v.went_well !== (review?.went_well ?? "") || v.to_improve !== (review?.to_improve ?? "") || v.next_focus !== (review?.next_focus ?? "");
  return (
    <Card aria-label="주간 회고">
      <CardHeader
        title="주간 회고 · 토요일 마감"
        sub={summary}
        right={
          <button type="button" className={btn.accent} disabled={carryCount === 0 || pending} onClick={onCarry}>
            지난 날짜 미완료 {carryCount}건 다음 주로 이월
          </button>
        }
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              ["went_well", "잘된 점"],
              ["to_improve", "아쉬운 점"],
              ["next_focus", "다음 주 집중점"],
            ] as const
          ).map(([k, label]) => (
            <label key={`${week}-${k}`} className="flex flex-col gap-1.5 text-[13px] font-bold text-sub">
              {label}
              <textarea id={`review-${k}`} rows={4} value={v[k]} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))} placeholder={isCurrent ? "토요일에 작성" : "기록 없음"} className={fieldFull + " py-2 font-normal"} />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">활성 반복 작업 {templatesCount}개가 매주 요일에 맞춰 자동으로 생깁니다 (설정 › 반복 작업).</p>
          <button type="submit" className={btn.primary} disabled={!dirty || pending}>
            {live ? "회고 저장" : "회고 저장 (샘플 모드)"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function PerVideoCard({ label, data }: { label: string; data: ReturnType<typeof weekTimeComparison>["perVideo"][number] }) {
  const tone = data.change === null ? "neutral" : data.change < 0 ? "good" : data.change > 0 ? "bad" : "neutral";
  return (
    <StatCard
      label={label}
      value={data.now.avg === null ? "—" : duration(data.now.avg)}
      delta={data.change === null ? (data.now.count === 0 ? "이번 기간 업로드 전" : "비교할 지난주 업로드 없음") : `지난주 대비 ${signedPct(data.change)} ${data.change < 0 ? "감소" : "증가"}`}
      deltaTone={tone}
      note={`이번 ${data.now.count}편 · 지난주 ${data.before.count}편${data.before.avg !== null ? ` (편당 ${duration(data.before.avg)})` : ""}`}
    />
  );
}

function ManualEntry({ projects, earliest, today, pending, onAdd }: { projects: VideoProject[]; earliest: string; today: string; pending: boolean; onAdd: (e: Omit<TimeEntry, "id" | "week_start">) => void }) {
  const [stage, setStage] = useState<TimeStage>("edit");
  const [project, setProject] = useState(projects[0]?.id ?? "");
  const [minutes, setMinutes] = useState("60");
  const [date, setDate] = useState(today);

  return (
    <Card className="mb-4">
      <CardHeader title="시간 직접 입력" sub={`${fullDate(earliest)}부터 오늘까지 입력할 수 있습니다`} />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const m = Math.round(Number(minutes));
          if (!m || m < 1 || m > 1440) return;
          onAdd({ task_id: null, project_id: project || null, stage, source: "manual", minutes: m, entry_date: date });
        }}
      >
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          단계
          <select id="mt-stage" value={stage} onChange={(e) => setStage(e.target.value as TimeStage)} className={field}>
            {TIME_STAGES.map((s) => (
              <option key={s} value={s}>{TIME_STAGE_LABEL[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          영상
          <select id="mt-project" value={project} onChange={(e) => setProject(e.target.value)} className={field + " max-w-[260px]"}>
            <option value="">영상과 무관</option>
            {projects.map((x) => (
              <option key={x.id} value={x.id}>{x.title}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          시간(분)
          <input id="mt-minutes" type="number" min={1} max={1440} step={1} required value={minutes} onChange={(e) => setMinutes(e.target.value)} className={field + " w-28"} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          날짜
          <input id="mt-date" type="date" min={earliest} max={today} required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <button type="submit" className={btn.primary} disabled={pending}>
          기록
        </button>
      </form>
    </Card>
  );
}

function TaskForm({ projects, weekStart, pending, onAdd }: { projects: VideoProject[]; weekStart: string; pending: boolean; onAdd: (t: { title: string; due_date: string; project_id?: string; stage?: string; estimated_minutes?: number }) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(weekStart);
  const [project, setProject] = useState("");
  const [stage, setStage] = useState("");
  const [est, setEst] = useState("");
  return (
    <Card className="mb-4">
      <CardHeader title="작업 추가" />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onAdd({ title: title.trim(), due_date: date, project_id: project || undefined, stage: stage || undefined, estimated_minutes: est ? Number(est) : undefined });
        }}
      >
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[13px] font-bold text-sub">
          작업
          <input id="task-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 현관 정리 자막 작업" className={fieldFull} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          날짜
          <input id="task-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          영상
          <select id="task-project" value={project} onChange={(e) => setProject(e.target.value)} className={field + " max-w-[220px]"}>
            <option value="">없음</option>
            {projects.map((x) => (
              <option key={x.id} value={x.id}>{x.title}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          단계
          <select id="task-stage" value={stage} onChange={(e) => setStage(e.target.value)} className={field}>
            <option value="">없음</option>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          예상(분)
          <input id="task-est" type="number" min={1} max={1440} step={1} value={est} onChange={(e) => setEst(e.target.value)} className={field + " w-24"} />
        </label>
        <button type="submit" className={btn.primary} disabled={pending}>
          추가
        </button>
      </form>
    </Card>
  );
}

function ProjectForm({ pending, onAdd }: { pending: boolean; onAdd: (x: { title: string; content_type: "long" | "short"; target_upload_date?: string }) => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"long" | "short">("long");
  const [date, setDate] = useState("");
  return (
    <Card className="mb-3">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onAdd({ title: title.trim(), content_type: type, target_upload_date: date || undefined });
        }}
      >
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[13px] font-bold text-sub">
          영상 제목(가제)
          <input id="project-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={fieldFull} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          유형
          <select id="project-type" value={type} onChange={(e) => setType(e.target.value as "long" | "short")} className={field}>
            <option value="long">일반 영상</option>
            <option value="short">쇼츠</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          목표 업로드일
          <input id="project-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <button type="submit" className={btn.primary} disabled={pending}>
          추가
        </button>
      </form>
    </Card>
  );
}
