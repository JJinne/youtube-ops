import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyticsView } from "./AnalyticsView";
import { db, lastDataDate, meta, PROVISIONAL_DAYS, today } from "@/lib/data";

export const metadata: Metadata = { title: "유튜브 분석" };

export default function AnalyticsPage() {
  const revenueByVideo: Record<string, number> = {};
  for (const r of db.revenueEntries) {
    if (r.video_id && r.status !== "expected") revenueByVideo[r.video_id] = (revenueByVideo[r.video_id] ?? 0) + r.amount_krw;
  }
  return (
    <Suspense>
      <AnalyticsView
        meta={meta}
        today={today}
        lastDataDate={lastDataDate}
        provisionalDays={PROVISIONAL_DAYS}
        videos={db.videos}
        daily={db.videoDailyMetrics}
        channel={db.channelDailyMetrics}
        retention={db.retention}
        manual={db.manualMetrics}
        insights={db.insights.map((i) => ({ id: i.id, content: i.content, linked_video_ids: i.linked_video_ids }))}
        experiments={db.experiments.map((e) => ({ id: e.id, hypothesis: e.hypothesis, video_id: e.video_id, verdict: e.verdict }))}
        revenueByVideo={revenueByVideo}
        channelAnalysis={db.aiAnalyses.find((a) => a.scope === "channel") ?? null}
      />
    </Suspense>
  );
}
