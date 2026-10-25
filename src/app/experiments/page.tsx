import type { Metadata } from "next";
import { Suspense } from "react";
import { ExperimentsView } from "./ExperimentsView";
import { db } from "@/lib/data";
import { compareExperiment } from "@/lib/metrics";

export const metadata: Metadata = { title: "실험·회고" };

export default function ExperimentsPage() {
  const rows = db.experiments.map((ex) => {
    const target = db.videos.find((v) => v.id === ex.video_id) ?? null;
    const secondary = ["views", "avg_view_percentage", "subscribers_gained", "impressions_ctr"].filter((k) => k !== ex.metric_key);
    return {
      ex,
      video: target ? { id: target.id, title: target.title, content_type: target.content_type, published_at: target.published_at } : null,
      baselineTitles: ex.baseline_video_ids.map((id) => db.videos.find((v) => v.id === id)?.title ?? id),
      insight: db.insights.find((i) => i.id === ex.insight_id) ?? null,
      lecture: db.lectures.find((l) => l.id === db.insights.find((i) => i.id === ex.insight_id)?.lecture_id) ?? null,
      goal: db.goals.find((g) => g.id === ex.goal_id) ?? null,
      primary: compareExperiment(ex, ex.metric_key, db.videos, db.videoDailyMetrics, db.manualMetrics),
      secondary: secondary.map((k) => compareExperiment(ex, k, db.videos, db.videoDailyMetrics, db.manualMetrics)),
    };
  });
  return (
    <Suspense>
      <ExperimentsView rows={rows} />
    </Suspense>
  );
}
