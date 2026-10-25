import type { Metadata } from "next";
import { RoutineView } from "./RoutineView";
import { getDataContext } from "@/lib/repo/context";
import { loadRoutine } from "@/lib/repo/routine";

export const metadata: Metadata = { title: "주간 제작 루틴" };

export default async function RoutinePage() {
  const ctx = await getDataContext();
  const d = await loadRoutine(ctx);
  return (
    <RoutineView
      live={ctx.live}
      today={ctx.today}
      currentWeek={ctx.currentWeek}
      tasks={d.tasks}
      projects={d.projects}
      videos={d.videos}
      timeEntries={d.timeEntries}
      reviews={d.reviews}
      templates={d.templates}
      runningTimer={d.runningTimer}
      loadError={d.error}
    />
  );
}
