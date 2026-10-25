"use client";

import { useState } from "react";
import { fullDate } from "@/lib/dates";
import { METRICS } from "@/lib/labels";
import type { AiAnalysis, Priority } from "@/lib/types";
import { AiBadge, btn } from "./ui";

export function PriorityList({ items, analyses }: { items: Priority[]; analyses: AiAnalysis[] }) {
  const [done, setDone] = useState<Record<string, boolean>>(Object.fromEntries(items.map((p) => [p.id, p.done])));
  const [asked, setAsked] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1.5">
        {[...items]
          .sort((a, b) => a.rank - b.rank)
          .map((p) => {
            const ai = p.origin === "ai" ? analyses.find((a) => a.id === p.ai_analysis_id) : null;
            return (
              <li key={p.id} className={ai ? "rounded-lg bg-ai-bg px-3 py-2" : ""}>
                <label className="flex min-h-11 items-start gap-2.5 py-1 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-[18px] shrink-0 accent-navy"
                    checked={done[p.id]}
                    onChange={(e) => setDone((d) => ({ ...d, [p.id]: e.target.checked }))}
                  />
                  <span className={done[p.id] ? "text-muted line-through" : ""}>
                    {p.rank}. {p.title}
                  </span>
                </label>
                {ai && (
                  <div className="flex flex-wrap items-center gap-1.5 pb-1 pl-7">
                    <AiBadge>AI 제안 · 승인함</AiBadge>
                    <span className="text-[11px] text-ai-fg">
                      근거: {ai.output.evidence_metrics.map((k) => METRICS[k]?.label_ko ?? k).join(", ")} · {fullDate(ai.period_start)}–{fullDate(ai.period_end).slice(5)}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
      </ol>
      <button type="button" className={btn.ai + " self-start"} onClick={() => setAsked(true)} disabled={asked}>
        {asked ? "6단계에서 연결됩니다" : "AI 제안 다시 받기"}
      </button>
    </div>
  );
}
