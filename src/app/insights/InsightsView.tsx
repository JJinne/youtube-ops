"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import * as act from "@/app/actions/lectures";
import type { ActionResult } from "@/app/actions/result";
import { Chips } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Badge, Card, CardHeader, Empty, PageHeader, btn, cx, field, fieldFull } from "@/components/ui";
import { fullDate } from "@/lib/dates";
import { VERDICT } from "@/lib/labels";
import type { ContentType, Insight, Lecture, Verdict } from "@/lib/types";

interface Props {
  live: boolean;
  lectures: Lecture[];
  insights: Insight[];
  projects: { id: string; title: string }[];
  videos: { id: string; title: string; content_type: ContentType }[];
  experiments: { id: string; hypothesis: string; insight_id: string | null; verdict: Verdict }[];
  loadError: string | null;
}

type Status = Insight["status"];
const STATUS: Record<Status, { label: string; tone: "accent" | "good" | "neutral" }> = {
  new: { label: "새 인사이트", tone: "accent" },
  applied: { label: "적용함", tone: "good" },
  archived: { label: "보관", tone: "neutral" },
};
type Toast = { kind: "ok" | "error"; text: string } | null;
const SAMPLE_NOTE = " (샘플 모드라 새로고침하면 사라집니다)";

export function InsightsView(p: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lectures, setLectures] = useState(p.lectures);
  const [insights, setInsights] = useState(p.insights);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [selected, setSelected] = useState<string | null>(p.lectures[0]?.id ?? null);
  const [mode, setMode] = useState<"none" | "new" | "edit">("none");
  const [toast, setToast] = useState<Toast>(p.loadError ? { kind: "error", text: `데이터를 불러오지 못했습니다: ${p.loadError}` } : null);

  useEffect(() => setLectures(p.lectures), [p.lectures]);
  useEffect(() => setInsights(p.insights), [p.insights]);
  useEffect(() => {
    if (!toast || toast.kind === "error") return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  function run<T>(action: () => Promise<ActionResult<T>>, okText: string, sample?: () => void, after?: (d?: T) => void) {
    if (!p.live) {
      sample?.();
      setToast({ kind: "ok", text: okText + SAMPLE_NOTE });
      return;
    }
    startTransition(async () => {
      const r = await action();
      if (!r.ok) return setToast({ kind: "error", text: r.error });
      setToast({ kind: "ok", text: okText });
      after?.(r.data);
      router.refresh();
    });
  }

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lectures) for (const t of l.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [lectures]);

  const q = query.trim().toLowerCase();
  const filtered = lectures.filter((l) => {
    if (tag !== "all" && !l.tags.includes(tag)) return false;
    if (!q) return true;
    const ins = insights.filter((i) => i.lecture_id === l.id);
    const hay = [l.title, l.topic, l.summary, ...l.tags, ...ins.flatMap((i) => [i.content, i.action_idea])].join(" ").toLowerCase();
    return hay.includes(q);
  });

  const lecture = lectures.find((l) => l.id === selected) ?? null;
  const lectureInsights = lecture ? insights.filter((i) => i.lecture_id === lecture.id) : [];

  return (
    <>
      <PageHeader
        title="강의·인사이트"
        sub="유튜브 학습과 비즈니스PT 강의를 한 목록에서 관리합니다"
        right={
          <button type="button" className={btn.primary} onClick={() => setMode("new")}>
            + 강의 기록
          </button>
        }
      />

      {toast && (
        <p role={toast.kind === "error" ? "alert" : "status"} className={cx("mb-4 rounded-lg px-4 py-2.5 text-[13px]", toast.kind === "error" ? "bg-bad-bg text-bad" : "bg-good-bg text-good-fg")}>
          {toast.text}
        </p>
      )}

      {mode !== "none" && (
        <LectureForm
          key={mode === "edit" ? selected : "new"}
          initial={mode === "edit" ? lecture : null}
          pending={pending}
          onCancel={() => setMode("none")}
          onSave={(v) => {
            if (mode === "edit" && lecture) {
              run(
                () => act.updateLecture(lecture.id, v),
                "강의를 고쳤습니다",
                () => setLectures((xs) => xs.map((x) => (x.id === lecture.id ? { ...x, ...v, tags: splitTags(v.tags) } : x))),
              );
            } else {
              const localId = `lec-new-${Date.now()}`;
              run(
                () => act.createLecture(v),
                `"${v.title}" 강의를 추가했습니다`,
                () => {
                  setLectures((xs) => [{ id: localId, title: v.title, taken_on: v.taken_on, topic: v.topic, summary: v.summary, tags: splitTags(v.tags) }, ...xs]);
                  setSelected(localId);
                },
                (d) => d && setSelected(d.id),
              );
            }
            setMode("none");
          }}
        />
      )}

      {p.live && lectures.length === 0 ? (
        <Card>
          <Empty>아직 기록한 강의가 없습니다. 오른쪽 위 "+ 강의 기록"으로 첫 강의를 남겨 보세요.</Empty>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3">
            <label className="sr-only" htmlFor="q">
              키워드 검색
            </label>
            <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="강의명, 핵심 내용, 인사이트, 실행 아이디어 검색" className={fieldFull + " min-h-11 max-w-xl"} />
            {tagCounts.length > 0 && (
              <Chips
                label="태그 필터"
                value={tag}
                onChange={setTag}
                options={[{ value: "all", label: "전체" }, ...tagCounts.map(([t, n]) => ({ value: t, label: `#${t}`, count: n }))]}
              />
            )}
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
            <section aria-label="강의 목록" className="flex flex-col gap-2">
              {filtered.length === 0 && <Empty>검색 결과가 없습니다.</Empty>}
              {filtered.map((l) => {
                const on = l.id === selected;
                const count = insights.filter((i) => i.lecture_id === l.id).length;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelected(l.id)}
                    aria-pressed={on}
                    className={`flex flex-col gap-1.5 rounded-xl border bg-surface px-4 py-3.5 text-left ${on ? "border-[1.5px] border-navy" : "border-line hover:border-field"}`}
                  >
                    <span className={`text-sm ${on ? "font-bold" : "font-medium"}`}>{l.title}</span>
                    <span className="text-xs text-muted">
                      {l.taken_on ? fullDate(l.taken_on) : "수강일 없음"} · 인사이트 {count}개 {l.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
                    </span>
                  </button>
                );
              })}
            </section>

            <Card aria-label="강의 상세">
              {!lecture ? (
                <Empty>왼쪽에서 강의를 고르세요.</Empty>
              ) : (
                <>
                  <CardHeader
                    title={lecture.title}
                    sub={`수강일 ${lecture.taken_on ? fullDate(lecture.taken_on) : "—"} · 주제 ${lecture.topic || "—"} · ${lecture.tags.map((t) => `#${t}`).join(" ")}`}
                    right={
                      <>
                        <button type="button" className={btn.secondary} onClick={() => setMode("edit")}>
                          편집
                        </button>
                        <DeleteButton
                          label="강의 삭제"
                          confirmText="강의를 지울까요? 인사이트는 남고 강의 연결만 끊깁니다."
                          disabled={pending}
                          onConfirm={() =>
                            run(
                              () => act.deleteLecture(lecture.id),
                              `"${lecture.title}" 강의를 지웠습니다`,
                              () => {
                                setLectures((xs) => xs.filter((x) => x.id !== lecture.id));
                                setSelected(null);
                              },
                              () => setSelected(null),
                            )
                          }
                        />
                      </>
                    }
                  />
                  <h3 className="mb-1 text-[13px] font-bold text-muted">핵심 내용</h3>
                  <p className="mb-5 whitespace-pre-line text-sm leading-relaxed">{lecture.summary || "아직 작성하지 않았습니다."}</p>

                  <h3 className="mb-2 text-[13px] font-bold text-muted">인사이트 {lectureInsights.length}개</h3>
                  <ul className="flex flex-col gap-3">
                    {lectureInsights.map((i) => (
                      <InsightItem
                        key={i.id}
                        insight={i}
                        live={p.live}
                        pending={pending}
                        projects={p.projects}
                        videos={p.videos}
                        experiments={p.experiments}
                        onStatus={(status) =>
                          run(() => act.updateInsight(i.id, { status }), `상태를 "${STATUS[status].label}"(으)로 바꿨습니다`, () =>
                            setInsights((xs) => xs.map((x) => (x.id === i.id ? { ...x, status } : x))),
                          )
                        }
                        onImpact={(impact_note) =>
                          run(() => act.updateInsight(i.id, { impact_note }), "성과 영향 기록을 저장했습니다", () =>
                            setInsights((xs) => xs.map((x) => (x.id === i.id ? { ...x, impact_note } : x))),
                          )
                        }
                        onLink={(projectId) =>
                          run(() => act.linkInsightProject(i.id, projectId), "영상과 연결했습니다", () =>
                            setInsights((xs) => xs.map((x) => (x.id === i.id ? { ...x, linked_project_ids: [...(x.linked_project_ids ?? []), projectId] } : x))),
                          )
                        }
                        onDelete={() => run(() => act.deleteInsight(i.id), "인사이트를 지웠습니다", () => setInsights((xs) => xs.filter((x) => x.id !== i.id)))}
                      />
                    ))}
                  </ul>
                  <NewInsight
                    key={lecture.id}
                    projects={p.projects}
                    pending={pending}
                    onAdd={(v) =>
                      run(
                        () => act.createInsight({ lecture_id: lecture.id, ...v }),
                        "인사이트를 추가했습니다",
                        () =>
                          setInsights((xs) => [
                            ...xs,
                            {
                              id: `ins-new-${Date.now()}`,
                              lecture_id: lecture.id,
                              content: v.content,
                              action_idea: v.action_idea ?? "",
                              tags: [],
                              impact_note: null,
                              status: "new",
                              created_at: new Date().toISOString(),
                              linked_video_ids: [],
                              linked_project_ids: v.project_id ? [v.project_id] : [],
                            },
                          ]),
                      )
                    }
                  />
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function splitTags(s: string | undefined) {
  return (s ?? "")
    .split(/[,\s#]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function DeleteButton({ label, confirmText, disabled, onConfirm }: { label: string; confirmText: string; disabled?: boolean; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className={btn.danger} disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2 rounded-lg bg-bad-bg px-2 py-1 text-xs text-bad" role="group" aria-label="삭제 확인">
      {confirmText}
      <button
        type="button"
        className="min-h-8 rounded-md bg-bad px-2.5 font-bold text-white"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        삭제
      </button>
      <button type="button" className="min-h-8 rounded-md px-2 font-bold" onClick={() => setAsking(false)}>
        취소
      </button>
    </span>
  );
}

function InsightItem({
  insight: i,
  live,
  pending,
  projects,
  videos,
  experiments,
  onStatus,
  onImpact,
  onLink,
  onDelete,
}: {
  insight: Insight;
  live: boolean;
  pending: boolean;
  projects: { id: string; title: string }[];
  videos: { id: string; title: string }[];
  experiments: { id: string; hypothesis: string; insight_id: string | null; verdict: Verdict }[];
  onStatus: (s: Status) => void;
  onImpact: (note: string) => void;
  onLink: (projectId: string) => void;
  onDelete: () => void;
}) {
  const [impact, setImpact] = useState(i.impact_note ?? "");
  const [linking, setLinking] = useState("");
  const vids = videos.filter((v) => i.linked_video_ids.includes(v.id));
  const projs = projects.filter((x) => i.linked_project_ids?.includes(x.id));
  const exps = experiments.filter((e) => e.insight_id === i.id);
  const unlinked = projects.filter((x) => !i.linked_project_ids?.includes(x.id));

  return (
    <li className="rounded-xl border border-line p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-sm font-bold">{i.content}</p>
        <div className="flex shrink-0 items-center gap-1">
          <label className="sr-only" htmlFor={`st-${i.id}`}>
            상태
          </label>
          <select id={`st-${i.id}`} value={i.status} disabled={pending} onChange={(e) => onStatus(e.target.value as Status)} className={field + " min-h-8 px-2 text-xs"}>
            {(Object.keys(STATUS) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS[s].label}</option>
            ))}
          </select>
          {live && (
            <button type="button" aria-label="인사이트 삭제" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-bad-bg hover:text-bad" disabled={pending} onClick={onDelete}>
              <Icon.close width={14} height={14} />
            </button>
          )}
        </div>
      </div>
      <dl className="grid gap-3 text-[13px] sm:grid-cols-2 [&>div]:min-w-0">
        <div>
          <dt className="text-xs text-muted">실행 아이디어</dt>
          <dd>{i.action_idea || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">연결된 영상 · 실험</dt>
          <dd className="flex min-w-0 flex-col gap-0.5">
            {vids.map((v) => (
              <Link key={v.id} href={`/analytics?video=${v.id}`} className="block truncate">
                {v.title}
              </Link>
            ))}
            {projs.map((x) => (
              <span key={x.id} className="block truncate">
                <Badge tone="neutral">제작</Badge> {x.title}
              </span>
            ))}
            {exps.map((e) => (
              <Link key={e.id} href={`/experiments?id=${e.id}`} className="block truncate">
                실험({VERDICT[e.verdict].label}): {e.hypothesis}
              </Link>
            ))}
            {!vids.length && !projs.length && !exps.length && <span className="text-muted">아직 없음</span>}
            {unlinked.length > 0 && (
              <span className="mt-1 flex items-center gap-1">
                <label className="sr-only" htmlFor={`ln-${i.id}`}>
                  제작 영상 연결
                </label>
                <select id={`ln-${i.id}`} value={linking} onChange={(e) => setLinking(e.target.value)} className={field + " min-h-8 max-w-[200px] px-2 text-xs"}>
                  <option value="">제작 영상 연결…</option>
                  {unlinked.map((x) => (
                    <option key={x.id} value={x.id}>{x.title}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={btn.secondary + " min-h-8 px-2.5 text-xs"}
                  disabled={!linking || pending}
                  onClick={() => {
                    onLink(linking);
                    setLinking("");
                  }}
                >
                  연결
                </button>
              </span>
            )}
          </dd>
        </div>
      </dl>
      <form
        className="mt-3 rounded-lg bg-ground px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          onImpact(impact);
        }}
      >
        <label htmlFor={`im-${i.id}`} className="text-xs text-muted">
          성과 영향 기록
        </label>
        <textarea
          id={`im-${i.id}`}
          rows={2}
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          placeholder="적용 후 성과를 확인하면 근거 지표와 기간을 함께 적어 두세요. 예: 오프닝 변경 후 2편의 평균 시청 비율 41% → 47% (업로드 후 7일)"
          className={fieldFull + " mt-1 bg-surface py-2 text-[13px]"}
        />
        <div className="mt-1.5 flex justify-end">
          <button type="submit" className={btn.secondary + " min-h-8 px-3 text-xs"} disabled={pending || impact === (i.impact_note ?? "")}>
            저장
          </button>
        </div>
      </form>
    </li>
  );
}

function NewInsight({ projects, pending, onAdd }: { projects: { id: string; title: string }[]; pending: boolean; onAdd: (v: { content: string; action_idea?: string; project_id?: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [idea, setIdea] = useState("");
  const [project, setProject] = useState("");
  if (!open)
    return (
      <button type="button" className={btn.accent + " mt-3"} onClick={() => setOpen(true)}>
        + 인사이트
      </button>
    );
  return (
    <form
      className="mt-3 flex flex-col gap-3 rounded-xl border border-navy/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!content.trim()) return;
        onAdd({ content: content.trim(), action_idea: idea.trim() || undefined, project_id: project || undefined });
        setContent("");
        setIdea("");
        setProject("");
        setOpen(false);
      }}
    >
      <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
        인사이트
        <textarea id="ni-content" required rows={2} value={content} onChange={(e) => setContent(e.target.value)} className={fieldFull + " py-2 font-normal"} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
        실행 아이디어
        <input id="ni-idea" value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="다음 영상에서 어떻게 적용할지" className={fieldFull + " font-normal"} />
      </label>
      {projects.length > 0 && (
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          연결할 제작 영상 (선택)
          <select id="ni-project" value={project} onChange={(e) => setProject(e.target.value)} className={field + " max-w-[320px] font-normal"}>
            <option value="">없음</option>
            {projects.map((x) => (
              <option key={x.id} value={x.id}>{x.title}</option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" className={btn.primary} disabled={pending}>
          추가
        </button>
        <button type="button" className={btn.secondary} onClick={() => setOpen(false)}>
          취소
        </button>
      </div>
    </form>
  );
}

function LectureForm({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: Lecture | null;
  pending: boolean;
  onSave: (v: { title: string; taken_on: string; topic: string; summary: string; tags: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [takenOn, setTakenOn] = useState(initial?.taken_on ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");

  return (
    <Card className="mb-4">
      <CardHeader title={initial ? "강의 편집" : "새 강의 기록"} />
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onSave({ title: title.trim(), taken_on: takenOn, topic: topic.trim(), summary: summary.trim(), tags });
        }}
      >
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          강의명
          <input id="lec-title" required value={title} onChange={(e) => setTitle(e.target.value)} className={fieldFull} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          수강일
          <input id="lec-date" type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} className={fieldFull} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          주제
          <input id="lec-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="예: 썸네일, 비즈니스PT 5주차" className={fieldFull} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
          태그 (쉼표로 구분)
          <input id="lec-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="썸네일, 클릭률" className={fieldFull} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-sub sm:col-span-2">
          핵심 내용
          <textarea id="lec-summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} className={fieldFull + " py-2"} />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className={btn.primary} disabled={pending}>
            {initial ? "저장" : "추가"}
          </button>
          <button type="button" className={btn.secondary} onClick={onCancel}>
            취소
          </button>
        </div>
      </form>
    </Card>
  );
}
