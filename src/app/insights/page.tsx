import type { Metadata } from "next";
import { InsightsView } from "./InsightsView";
import { db } from "@/lib/data";
import { getDataContext } from "@/lib/repo/context";
import { loadLectures } from "@/lib/repo/lectures";

export const metadata: Metadata = { title: "강의·인사이트" };

export default async function InsightsPage() {
  const ctx = await getDataContext();
  const d = await loadLectures(ctx);
  return (
    <InsightsView
      live={ctx.live}
      lectures={d.lectures}
      insights={d.insights}
      projects={d.projects}
      // YouTube 영상과 실험은 5단계·4b에서 실제 데이터로 바뀐다. 실제 모드에서는 샘플을 섞지 않는다.
      videos={ctx.live ? [] : db.videos.map((v) => ({ id: v.id, title: v.title, content_type: v.content_type }))}
      experiments={ctx.live ? [] : db.experiments.map((e) => ({ id: e.id, hypothesis: e.hypothesis, insight_id: e.insight_id, verdict: e.verdict }))}
      loadError={d.error}
    />
  );
}
