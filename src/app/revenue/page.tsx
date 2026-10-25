import type { Metadata } from "next";
import { RevenueView } from "./RevenueView";
import { db, today } from "@/lib/data";
import { addDays, monthKey } from "@/lib/dates";
import { PLATFORMS, revenueMonth, revenueMonthlySeries } from "@/lib/metrics";

export const metadata: Metadata = { title: "수익" };

export default function RevenuePage() {
  const month = monthKey(today);
  const prevMonth = monthKey(addDays(`${month}-01`, -1));
  const months: string[] = [];
  for (let i = 11, d = `${month}-01`; i >= 0; i--) {
    months.unshift(monthKey(d));
    d = addDays(`${monthKey(d)}-01`, -1);
  }
  return (
    <RevenueView
      month={month}
      current={revenueMonth(db.revenueEntries, month)}
      previous={revenueMonth(db.revenueEntries, prevMonth)}
      series={revenueMonthlySeries(db.revenueEntries, months)}
      platforms={PLATFORMS}
      entries={db.revenueEntries}
      videos={Object.fromEntries(db.videos.map((v) => [v.id, v.title]))}
    />
  );
}
