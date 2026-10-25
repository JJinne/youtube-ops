import "server-only";
import { addDays } from "../dates";
import { db } from "../data";
import { missingRoutineTasks, type RoutineTemplate } from "../routine-logic";
import type { Task, TimeEntry, Video, VideoProject, WeeklyReview } from "../types";
import type { DataContext } from "./context";

export interface RunningTimer {
  id: string;
  stage: TimeEntry["stage"];
  project_id: string | null;
  started_at: string;
}

export interface RoutineData {
  tasks: Task[];
  projects: VideoProject[];
  videos: Video[];
  timeEntries: TimeEntry[];
  reviews: WeeklyReview[];
  templates: RoutineTemplate[];
  runningTimer: RunningTimer | null;
  error: string | null;
}

const TASK_COLS = "id,project_id,routine_template_id,title,stage,due_date,completed_at,week_start,estimated_minutes,carried_from_task_id";

export async function loadRoutine(ctx: DataContext): Promise<RoutineData> {
  if (ctx.session.mode !== "live") {
    return {
      tasks: db.tasks,
      projects: db.projects,
      videos: db.videos,
      timeEntries: db.timeEntries,
      reviews: db.weeklyReviews,
      templates: db.routineTemplates,
      runningTimer: null,
      error: null,
    };
  }
  const sb = ctx.session.supabase;
  const from = addDays(ctx.currentWeek, -21); // 3주 전 비교까지
  const to = addDays(ctx.currentWeek, 13); // 다음 주(이월 결과)까지

  // 이번 주 반복 작업을 먼저 만들어 둔다 (이미 있으면 건너뜀)
  const tpl = await sb.from("routine_templates").select("id,title,weekday,stage,active").order("weekday");
  if (tpl.error) return empty(tpl.error.message);
  const existing = await sb.from("tasks").select("routine_template_id,week_start").eq("week_start", ctx.currentWeek).not("routine_template_id", "is", null);
  if (existing.error) return empty(existing.error.message);
  const missing = missingRoutineTasks(tpl.data ?? [], existing.data ?? [], ctx.currentWeek);
  if (missing.length) {
    // 동시에 두 번 열려도 중복이 생기지 않도록 고유 인덱스로 막고 충돌은 무시한다
    await sb.from("tasks").upsert(missing, { onConflict: "user_id,routine_template_id,week_start", ignoreDuplicates: true });
  }

  const [tasks, entries, reviews, running] = await Promise.all([
    sb.from("tasks").select(TASK_COLS).gte("week_start", from).lte("week_start", to).order("due_date").order("sort_order").order("created_at"),
    sb.from("time_entries").select("id,task_id,project_id,stage,source,minutes,entry_date,week_start").gte("week_start", from).not("minutes", "is", null),
    sb.from("weekly_reviews").select("week_start,went_well,to_improve,next_focus").gte("week_start", from),
    sb.from("time_entries").select("id,stage,project_id,started_at").eq("source", "timer").is("ended_at", null).maybeSingle(),
  ]);
  const err = tasks.error ?? entries.error ?? reviews.error ?? running.error;
  if (err) return empty(err.message);

  // 시간 기록이 있는 프로젝트(이전 주에 시작한 영상 포함)와 최근 프로젝트를 함께 읽는다
  const projectIds = new Set<string>();
  for (const e of entries.data ?? []) if (e.project_id) projectIds.add(e.project_id);
  for (const t of tasks.data ?? []) if (t.project_id) projectIds.add(t.project_id);
  const recent = await sb
    .from("video_projects")
    .select("id,title,content_type,goal_id,stage,target_upload_date,video_id,week_start,created_at")
    .or(`week_start.gte.${from},stage.neq.upload`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (recent.error) return empty(recent.error.message);
  let projects = recent.data ?? [];
  const missingIds = [...projectIds].filter((id) => !projects.some((p) => p.id === id));
  if (missingIds.length) {
    const extra = await sb.from("video_projects").select("id,title,content_type,goal_id,stage,target_upload_date,video_id,week_start,created_at").in("id", missingIds);
    if (extra.error) return empty(extra.error.message);
    projects = [...projects, ...(extra.data ?? [])];
  }
  // 업로드 연결된 영상의 업로드일 (1편당 평균 제작 시간 계산용)
  const videoIds = projects.map((p) => p.video_id).filter((x): x is string => !!x);
  let videos: Video[] = [];
  if (videoIds.length) {
    const v = await sb.from("videos").select("id,youtube_video_id,title,published_at,duration_sec,content_type,content_type_source,source,is_sample").in("id", videoIds);
    if (v.error) return empty(v.error.message);
    videos = (v.data ?? []) as Video[];
  }

  return {
    tasks: (tasks.data ?? []) as Task[],
    projects: projects.map((p) => ({ ...p, week_start: p.week_start ?? ctx.currentWeek })) as VideoProject[],
    videos,
    timeEntries: (entries.data ?? []) as TimeEntry[],
    reviews: (reviews.data ?? []).map((r) => ({ week_start: r.week_start, went_well: r.went_well ?? "", to_improve: r.to_improve ?? "", next_focus: r.next_focus ?? "" })),
    templates: tpl.data ?? [],
    runningTimer: running.data ?? null,
    error: null,
  };
}

function empty(error: string): RoutineData {
  return { tasks: [], projects: [], videos: [], timeEntries: [], reviews: [], templates: [], runningTimer: null, error };
}
