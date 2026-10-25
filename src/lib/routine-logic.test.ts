import assert from "node:assert/strict";
import { test } from "node:test";
import { weekStartOf } from "./dates";
import { carryOverCopies, missingRoutineTasks, timerMinutes } from "./routine-logic";
import type { Task } from "./types";

const base: Omit<Task, "id" | "title" | "due_date"> = {
  project_id: null,
  routine_template_id: null,
  stage: null,
  completed_at: null,
  week_start: "2026-10-25",
  estimated_minutes: null,
  carried_from_task_id: null,
};

test("주 시작은 일요일", () => {
  assert.equal(weekStartOf("2026-10-25"), "2026-10-25"); // 일
  assert.equal(weekStartOf("2026-10-31"), "2026-10-25"); // 토
  assert.equal(weekStartOf("2026-11-01"), "2026-11-01"); // 다음 일
});

test("반복 작업: 이미 만든 것은 건너뛰고 요일에 맞는 날짜로 만든다", () => {
  const templates = [
    { id: "a", title: "기획 회의", weekday: 0, stage: "plan" },
    { id: "b", title: "댓글 확인", weekday: 3, stage: null },
    { id: "c", title: "꺼 둔 작업", weekday: 5, stage: null, active: false },
  ];
  const existing = [{ routine_template_id: "a", week_start: "2026-10-25" }];
  const out = missingRoutineTasks(templates, existing, "2026-10-25");
  assert.deepEqual(
    out.map((t) => [t.routine_template_id, t.due_date]),
    [["b", "2026-10-28"]],
  );
});

test("이월: 지난 날짜 미완료 일반 작업만, 다음 주 같은 요일로, 한 번만", () => {
  const tasks: Task[] = [
    { ...base, id: "t1", title: "편집", due_date: "2026-10-26" }, // 월, 미완료 → 이월
    { ...base, id: "t2", title: "업로드", due_date: "2026-10-27", completed_at: "2026-10-27T10:00:00Z" }, // 완료 → 제외
    { ...base, id: "t3", title: "반복", due_date: "2026-10-26", routine_template_id: "a" }, // 반복 → 제외
    { ...base, id: "t4", title: "아직 안 온 날", due_date: "2026-10-31" }, // 오늘 이후 → 제외
    { ...base, id: "t5", title: "이미 이월함", due_date: "2026-10-26" },
    { ...base, id: "t6", title: "이미 이월함", due_date: "2026-11-02", week_start: "2026-11-01", carried_from_task_id: "t5" },
  ];
  const out = carryOverCopies(tasks, "2026-10-25", "2026-10-29");
  assert.equal(out.length, 1);
  assert.equal(out[0].carried_from_task_id, "t1");
  assert.equal(out[0].due_date, "2026-11-02");
  assert.equal(out[0].week_start, "2026-11-01");
});

test("타이머: 1분 미만은 1분, 24시간 초과는 1440분, 그 사이는 반올림", () => {
  const start = "2026-10-25T01:00:00.000Z";
  const t0 = Date.parse(start);
  assert.equal(timerMinutes(start, t0 + 10_000), 1);
  assert.equal(timerMinutes(start, t0 + 90 * 60_000 + 20_000), 90);
  assert.equal(timerMinutes(start, t0 + 30 * 3_600_000), 1440);
});
