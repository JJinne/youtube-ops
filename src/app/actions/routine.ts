"use server";

import { revalidatePath } from "next/cache";
import { addDays, diffDays, weekStartOf } from "@/lib/dates";
import { kstToday } from "@/lib/repo/context";
import { carryOverCopies, timerMinutes } from "@/lib/routine-logic";
import { requireLive } from "@/lib/supabase/server";
import type { Stage, Task, TimeStage } from "@/lib/types";
import { fail, type ActionResult } from "./result";

const STAGES: Stage[] = ["idea", "plan", "script", "shoot", "edit", "upload"];
const TIME_STAGES: TimeStage[] = [...STAGES, "routine", "other"];
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const clean = (s: unknown, max = 300) => (typeof s === "string" ? s.trim().slice(0, max) : "");

function done() {
  revalidatePath("/routine");
  revalidatePath("/");
}

// ---------------------------------------------------------------------
// 작업
// ---------------------------------------------------------------------
export async function createTask(input: { title: string; due_date: string; project_id?: string; stage?: string; estimated_minutes?: number }): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const title = clean(input.title, 200);
    if (!title) return { ok: false, error: "작업 이름을 입력하세요." };
    if (!isDate(input.due_date)) return { ok: false, error: "날짜가 올바르지 않습니다." };
    const est = Number(input.estimated_minutes);
    const { error } = await supabase.from("tasks").insert({
      title,
      due_date: input.due_date,
      week_start: weekStartOf(input.due_date),
      project_id: input.project_id || null,
      stage: STAGES.includes(input.stage as Stage) ? input.stage : null,
      estimated_minutes: Number.isFinite(est) && est > 0 ? Math.round(est) : null,
    });
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setTaskDone(id: string, isDone: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const { error } = await supabase.from("tasks").update({ completed_at: isDone ? new Date().toISOString() : null }).eq("id", id);
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 지난 날짜의 미완료 작업을 다음 주로 복사한다 (원래 작업은 그 주 기록으로 남는다) */
export async function carryOver(weekStart: string): Promise<ActionResult<{ count: number }>> {
  try {
    const { supabase } = await requireLive();
    if (!isDate(weekStart)) return { ok: false, error: "주가 올바르지 않습니다." };
    const { data, error } = await supabase
      .from("tasks")
      .select("id,project_id,routine_template_id,title,stage,due_date,completed_at,week_start,estimated_minutes,carried_from_task_id")
      .gte("week_start", weekStart)
      .lte("week_start", addDays(weekStart, 7));
    if (error) return fail(error);
    const copies = carryOverCopies((data ?? []) as Task[], weekStart, kstToday());
    if (copies.length) {
      const ins = await supabase.from("tasks").insert(copies);
      if (ins.error) return fail(ins.error);
    }
    done();
    return { ok: true, data: { count: copies.length } };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------
// 반복 작업 템플릿
// ---------------------------------------------------------------------
export async function createTemplate(input: { title: string; weekday: number; stage?: string }): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const title = clean(input.title, 200);
    const weekday = Math.round(Number(input.weekday));
    if (!title || !(weekday >= 0 && weekday <= 6)) return { ok: false, error: "이름과 요일을 확인하세요." };
    const { error } = await supabase.from("routine_templates").insert({ title, weekday, stage: STAGES.includes(input.stage as Stage) ? input.stage : null });
    if (error) return fail(error);
    done();
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setTemplateActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const { error } = await supabase.from("routine_templates").update({ active }).eq("id", id);
    if (error) return fail(error);
    done();
    revalidatePath("/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------
// 영상 프로젝트
// ---------------------------------------------------------------------
export async function createProject(input: { title: string; content_type: "long" | "short"; target_upload_date?: string }): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const title = clean(input.title, 200);
    if (!title) return { ok: false, error: "영상 제목을 입력하세요." };
    const { error } = await supabase.from("video_projects").insert({
      title,
      content_type: input.content_type === "short" ? "short" : "long",
      target_upload_date: isDate(input.target_upload_date) ? input.target_upload_date : null,
      week_start: weekStartOf(kstToday()),
    });
    if (error) return fail(error);
    done();
    revalidatePath("/insights");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setProjectStage(id: string, stage: Stage): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    if (!STAGES.includes(stage)) return { ok: false, error: "단계가 올바르지 않습니다." };
    const { error } = await supabase.from("video_projects").update({ stage }).eq("id", id);
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------
// 시간 기록
// ---------------------------------------------------------------------
export async function addManualTime(input: { stage: string; project_id?: string; minutes: number; entry_date: string }): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const minutes = Math.round(Number(input.minutes));
    if (!TIME_STAGES.includes(input.stage as TimeStage)) return { ok: false, error: "단계를 고르세요." };
    if (!(minutes >= 1 && minutes <= 1440)) return { ok: false, error: "시간은 1~1440분 사이로 입력하세요." };
    if (!isDate(input.entry_date) || diffDays(input.entry_date, kstToday()) > 0) return { ok: false, error: "오늘 이후 날짜는 기록할 수 없습니다." };
    const { error } = await supabase.from("time_entries").insert({
      stage: input.stage,
      project_id: input.project_id || null,
      source: "manual",
      minutes,
      entry_date: input.entry_date,
      week_start: weekStartOf(input.entry_date),
    });
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** 타이머 시작. DB에 진행 중 기록을 남기므로 다른 기기에서도 이어서 보이고 멈출 수 있다 */
export async function startTimer(input: { stage: string; project_id?: string }): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    if (!TIME_STAGES.includes(input.stage as TimeStage)) return { ok: false, error: "단계를 고르세요." };
    const today = kstToday();
    const { error } = await supabase.from("time_entries").insert({
      stage: input.stage,
      project_id: input.project_id || null,
      source: "timer",
      started_at: new Date().toISOString(),
      entry_date: today,
      week_start: weekStartOf(today),
    });
    if (error) {
      if (error.code === "23505") return { ok: false, error: "이미 다른 타이머가 켜져 있습니다. 먼저 멈춰 주세요." };
      return fail(error);
    }
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function stopTimer(id: string): Promise<ActionResult<{ minutes: number }>> {
  try {
    const { supabase } = await requireLive();
    const { data, error } = await supabase.from("time_entries").select("started_at").eq("id", id).is("ended_at", null).single();
    if (error) return fail(error);
    const now = Date.now();
    const minutes = timerMinutes(data.started_at, now);
    const upd = await supabase.from("time_entries").update({ ended_at: new Date(now).toISOString(), minutes }).eq("id", id);
    if (upd.error) return fail(upd.error);
    done();
    return { ok: true, data: { minutes } };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelTimer(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const { error } = await supabase.from("time_entries").delete().eq("id", id).is("ended_at", null);
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------
// 주간 회고
// ---------------------------------------------------------------------
export async function saveReview(input: { week_start: string; went_well: string; to_improve: string; next_focus: string; completion_rate: number | null }): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    if (!isDate(input.week_start) || weekStartOf(input.week_start) !== input.week_start) return { ok: false, error: "주가 올바르지 않습니다." };
    const rate = input.completion_rate === null ? null : Math.max(0, Math.min(100, Math.round(input.completion_rate * 100) / 100));
    const { error } = await supabase.from("weekly_reviews").upsert(
      { week_start: input.week_start, went_well: clean(input.went_well, 3000), to_improve: clean(input.to_improve, 3000), next_focus: clean(input.next_focus, 3000), completion_rate: rate },
      { onConflict: "user_id,week_start" },
    );
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
