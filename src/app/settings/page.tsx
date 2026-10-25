import type { Metadata } from "next";
import { SettingsView } from "./SettingsView";
import { meta } from "@/lib/data";
import { METRICS } from "@/lib/labels";
import { getDataContext } from "@/lib/repo/context";
import { loadRoutine } from "@/lib/repo/routine";

export const metadata: Metadata = { title: "설정" };

export default async function SettingsPage() {
  const ctx = await getDataContext();
  const routine = await loadRoutine(ctx);
  return (
    <SettingsView
      meta={meta}
      mode={ctx.session.mode}
      email={ctx.session.mode === "live" ? ctx.session.email : null}
      metrics={Object.values(METRICS)}
      routineTemplates={routine.templates}
    />
  );
}
