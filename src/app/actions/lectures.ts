"use server";

import { revalidatePath } from "next/cache";
import { requireLive } from "@/lib/supabase/server";
import { fail, type ActionResult } from "./result";

const clean = (s: unknown, max = 5000) => (typeof s === "string" ? s.trim().slice(0, max) : "");
const tagsOf = (s: unknown) =>
  clean(s, 500)
    .split(/[,\s#]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
const dateOrNull = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

function done() {
  revalidatePath("/insights");
  revalidatePath("/");
}

export async function createLecture(input: { title: string; taken_on?: string; topic?: string; summary?: string; tags?: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireLive();
    const title = clean(input.title, 200);
    if (!title) return { ok: false, error: "강의명을 입력하세요." };
    const { data, error } = await supabase
      .from("lectures")
      .insert({ title, taken_on: dateOrNull(input.taken_on), topic: clean(input.topic, 200) || null, summary: clean(input.summary) || null, tags: tagsOf(input.tags) })
      .select("id")
      .single();
    if (error) return fail(error);
    done();
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLecture(id: string, input: { title: string; taken_on?: string; topic?: string; summary?: string; tags?: string }): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const title = clean(input.title, 200);
    if (!title) return { ok: false, error: "강의명을 입력하세요." };
    const { error } = await supabase
      .from("lectures")
      .update({ title, taken_on: dateOrNull(input.taken_on), topic: clean(input.topic, 200) || null, summary: clean(input.summary) || null, tags: tagsOf(input.tags) })
      .eq("id", id);
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLecture(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    // 인사이트는 강의와의 연결만 끊기고 남는다 (lecture_id on delete set null)
    const { error } = await supabase.from("lectures").delete().eq("id", id);
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createInsight(input: { lecture_id: string; content: string; action_idea?: string; project_id?: string }): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireLive();
    const content = clean(input.content, 2000);
    if (!content) return { ok: false, error: "인사이트 내용을 입력하세요." };
    const { data, error } = await supabase
      .from("insights")
      .insert({ lecture_id: input.lecture_id, content, action_idea: clean(input.action_idea, 2000) || null })
      .select("id")
      .single();
    if (error) return fail(error);
    if (input.project_id) {
      const link = await supabase.from("insight_videos").insert({ insight_id: data.id, project_id: input.project_id });
      if (link.error) return fail(link.error);
    }
    done();
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateInsight(id: string, patch: { status?: "new" | "applied" | "archived"; impact_note?: string; action_idea?: string }): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const row: Record<string, unknown> = {};
    if (patch.status && ["new", "applied", "archived"].includes(patch.status)) row.status = patch.status;
    if (patch.impact_note !== undefined) row.impact_note = clean(patch.impact_note, 2000) || null;
    if (patch.action_idea !== undefined) row.action_idea = clean(patch.action_idea, 2000) || null;
    if (!Object.keys(row).length) return { ok: true };
    const { error } = await supabase.from("insights").update(row).eq("id", id);
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function linkInsightProject(insightId: string, projectId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const { error } = await supabase.from("insight_videos").insert({ insight_id: insightId, project_id: projectId });
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteInsight(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireLive();
    const { error } = await supabase.from("insights").delete().eq("id", id);
    if (error) return fail(error);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
