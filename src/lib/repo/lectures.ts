import "server-only";
import { db } from "../data";
import type { Insight, Lecture } from "../types";
import type { DataContext } from "./context";

export interface LectureData {
  lectures: Lecture[];
  insights: Insight[];
  projects: { id: string; title: string }[];
  error: string | null;
}

export async function loadLectures(ctx: DataContext): Promise<LectureData> {
  if (ctx.session.mode !== "live") {
    return { lectures: db.lectures, insights: db.insights, projects: db.projects.map((p) => ({ id: p.id, title: p.title })), error: null };
  }
  const sb = ctx.session.supabase;
  const [lec, ins, links, proj] = await Promise.all([
    sb.from("lectures").select("id,title,taken_on,topic,summary,tags").order("taken_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    sb.from("insights").select("id,lecture_id,content,action_idea,tags,impact_note,status,created_at").order("created_at", { ascending: true }),
    sb.from("insight_videos").select("insight_id,video_id,project_id"),
    sb.from("video_projects").select("id,title").order("created_at", { ascending: false }).limit(100),
  ]);
  const error = lec.error ?? ins.error ?? links.error ?? proj.error;
  if (error) return { lectures: [], insights: [], projects: [], error: error.message };

  const byInsight = new Map<string, { videos: string[]; projects: string[] }>();
  for (const l of links.data ?? []) {
    const cur = byInsight.get(l.insight_id) ?? { videos: [], projects: [] };
    if (l.video_id) cur.videos.push(l.video_id);
    if (l.project_id) cur.projects.push(l.project_id);
    byInsight.set(l.insight_id, cur);
  }
  return {
    lectures: (lec.data ?? []).map((l) => ({ id: l.id, title: l.title, taken_on: l.taken_on ?? "", topic: l.topic ?? "", summary: l.summary ?? "", tags: l.tags ?? [] })),
    insights: (ins.data ?? []).map((i) => ({
      id: i.id,
      lecture_id: i.lecture_id,
      content: i.content,
      action_idea: i.action_idea ?? "",
      tags: i.tags ?? [],
      impact_note: i.impact_note,
      status: i.status,
      created_at: i.created_at,
      linked_video_ids: byInsight.get(i.id)?.videos ?? [],
      linked_project_ids: byInsight.get(i.id)?.projects ?? [],
    })),
    projects: proj.data ?? [],
    error: null,
  };
}
