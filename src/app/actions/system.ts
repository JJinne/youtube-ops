"use server";

import { requireLive } from "@/lib/supabase/server";
import { fail, type ActionResult } from "./result";

export interface CheckStep {
  name: string;
  ok: boolean;
  detail: string;
}

const TABLES = [
  "lectures",
  "insights",
  "insight_videos",
  "video_projects",
  "tasks",
  "routine_templates",
  "time_entries",
  "weekly_reviews",
  "goals",
  "experiments",
  "revenue_entries",
  "metric_definitions",
];

/** 설정 화면의 "연결 점검". 표 확인 → 쓰기 → 읽기 → 지우기를 차례로 해 보고 결과를 돌려준다. */
export async function checkConnection(): Promise<ActionResult<CheckStep[]>> {
  try {
    const { supabase, email } = await requireLive();
    const steps: CheckStep[] = [{ name: "로그인", ok: true, detail: email }];

    const missing: string[] = [];
    for (const t of TABLES) {
      const { error } = await supabase.from(t).select("*", { count: "exact", head: true });
      if (error) missing.push(`${t} (${error.code ?? error.message})`);
    }
    steps.push({
      name: "DB 테이블",
      ok: missing.length === 0,
      detail: missing.length === 0 ? `${TABLES.length}개 확인` : `없는 테이블: ${missing.join(", ")} — 마이그레이션 SQL을 실행했는지 확인하세요`,
    });
    if (missing.length) return { ok: true, data: steps };

    const metrics = await supabase.from("metric_definitions").select("metric_key", { count: "exact", head: true });
    steps.push({ name: "지표 정의", ok: (metrics.count ?? 0) > 0, detail: `${metrics.count ?? 0}개` });

    const probeTitle = `연결 점검 ${new Date().toISOString()}`;
    const ins = await supabase.from("lectures").insert({ title: probeTitle, tags: [] }).select("id,user_id").single();
    steps.push({ name: "쓰기", ok: !ins.error, detail: ins.error ? ins.error.message : "점검용 강의 1건 저장" });
    if (ins.error) return { ok: true, data: steps };

    const read = await supabase.from("lectures").select("id").eq("id", ins.data.id).maybeSingle();
    steps.push({ name: "읽기", ok: !!read.data, detail: read.data ? "방금 저장한 행을 읽음" : (read.error?.message ?? "읽지 못함 (권한 정책 확인)") });

    const del = await supabase.from("lectures").delete().eq("id", ins.data.id);
    steps.push({ name: "지우기", ok: !del.error, detail: del.error ? del.error.message : "점검용 행 삭제" });

    return { ok: true, data: steps };
  } catch (e) {
    return fail(e);
  }
}
