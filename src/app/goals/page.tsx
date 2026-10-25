import type { Metadata } from "next";
import { GoalsView } from "./GoalsView";
import { db, lastDataDate, today } from "@/lib/data";
import { monthKey } from "@/lib/dates";
import { revenueMonth, subscriberCount } from "@/lib/metrics";

export const metadata: Metadata = { title: "목표" };

export default function GoalsPage() {
  const metricValues: Record<string, number> = {
    subscriber_count: subscriberCount(db.channelDailyMetrics, db.subscribersBeforeStart, lastDataDate),
    monthly_revenue_krw: revenueMonth(db.revenueEntries, monthKey(today)).confirmed,
  };
  return (
    <GoalsView
      today={today}
      goals={db.goals}
      milestones={db.goalMilestones}
      notes={db.goalNotes}
      metricValues={metricValues}
      projects={db.projects.map((p) => ({ id: p.id, title: p.title, goal_id: p.goal_id, stage: p.stage }))}
      experiments={db.experiments.map((e) => ({ id: e.id, hypothesis: e.hypothesis, goal_id: e.goal_id, verdict: e.verdict, insight_id: e.insight_id }))}
      insights={db.insights.map((i) => ({ id: i.id, content: i.content }))}
    />
  );
}
