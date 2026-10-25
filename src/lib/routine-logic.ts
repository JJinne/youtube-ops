// 주간 루틴의 순수 로직. DB와 무관해서 단독으로 시험할 수 있다.

import { addDays } from "./dates";
import type { Task } from "./types";

export interface RoutineTemplate {
  id: string;
  title: string;
  weekday: number; // 0 = 일요일
  stage: string | null;
  active?: boolean;
}

/** 이번 주에 아직 만들어지지 않은 반복 작업 목록 */
export function missingRoutineTasks(templates: RoutineTemplate[], existing: Pick<Task, "routine_template_id" | "week_start">[], weekStart: string) {
  const have = new Set(existing.filter((t) => t.week_start === weekStart && t.routine_template_id).map((t) => t.routine_template_id));
  return templates
    .filter((t) => t.active !== false && !have.has(t.id))
    .map((t) => ({
      title: t.title,
      routine_template_id: t.id,
      stage: (t.stage as Task["stage"]) ?? null,
      due_date: addDays(weekStart, t.weekday),
      week_start: weekStart,
    }));
}

/** 이월: 원래 작업은 그 주 기록으로 남기고, 다음 주에 같은 요일로 복사본을 만든다 */
export function carryOverCopies(tasks: Task[], weekStart: string, today: string) {
  const nextWeek = addDays(weekStart, 7);
  const alreadyCarried = new Set(tasks.filter((t) => t.carried_from_task_id).map((t) => t.carried_from_task_id));
  return tasks
    // 반복 작업은 다음 주에 템플릿으로 새로 생기므로 이월하지 않는다
    .filter((t) => t.week_start === weekStart && !t.completed_at && !t.routine_template_id && t.due_date < today && !alreadyCarried.has(t.id))
    .map((t) => ({
      title: t.title,
      project_id: t.project_id,
      stage: t.stage,
      due_date: addDays(t.due_date, 7),
      week_start: nextWeek,
      estimated_minutes: t.estimated_minutes,
      carried_from_task_id: t.id,
    }));
}

/** 타이머 경과 분 (최소 1분, 최대 24시간) */
export function timerMinutes(startedAtIso: string, endedAtMs: number): number {
  const ms = endedAtMs - Date.parse(startedAtIso);
  return Math.min(1440, Math.max(1, Math.round(ms / 60000)));
}
