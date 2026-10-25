"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDate } from "@/lib/dates";
import { krw, num } from "@/lib/format";

const AXIS = { stroke: "#5b6270", fontSize: 12 };
const GRID = "#eef0f3";

export function TrendChart({
  data,
  dataKey,
  label,
  unit,
  provisionalFrom,
  height = 240,
}: {
  data: { date: string; [k: string]: number | string | null }[];
  dataKey: string;
  label: string;
  unit?: string;
  provisionalFrom?: string;
  height?: number;
}) {
  const last = data.at(-1)?.date;
  return (
    <div style={{ height }} role="img" aria-label={`${label} 일별 추이, ${data[0]?.date}부터 ${last}까지`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => shortDate(d, false)} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e3e6eb" }} minTickGap={28} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => num(v)} />
          {provisionalFrom && last && <ReferenceArea x1={provisionalFrom} x2={last} fill="#e9ecf1" fillOpacity={0.7} ifOverflow="extendDomain" />}
          <Tooltip
            formatter={(v) => [`${num(Number(v))}${unit ?? ""}`, label]}
            labelFormatter={(d) => shortDate(String(d))}
            contentStyle={{ borderRadius: 8, borderColor: "#e3e6eb", fontSize: 13 }}
          />
          <Line type="monotone" dataKey={dataKey} stroke="#1f2f57" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RetentionChart({ data, height = 200 }: { data: { pct: number; video: number; relative: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="시청 지속 곡선. 영상 진행 비율에 따른 시청자 비율">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="pct" tickFormatter={(v: number) => `${v}%`} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e3e6eb" }} />
          <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={AXIS} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            formatter={(v, name) => [name === "video" ? `${Math.round(Number(v) * 100)}%` : Number(v).toFixed(2), name === "video" ? "시청 지속 비율" : "상대 시청 지속"]}
            labelFormatter={(l) => `영상 ${l}% 지점`}
            contentStyle={{ borderRadius: 8, borderColor: "#e3e6eb", fontSize: 13 }}
          />
          <Line type="monotone" dataKey="video" stroke="#1f2f57" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="relative" stroke="#8a93a3" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const PLATFORM_COLORS: Record<string, string> = {
  coupang_partners: "#1f2f57",
  naver_brand_connect: "#5c7cc2",
  ohou_curator: "#a8b6d6",
};

export function RevenueStackChart({ data, platforms, height = 260 }: { data: Record<string, number | string>[]; platforms: { key: string; label: string }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="월별 플랫폼별 확정 수익 누적 막대">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tickFormatter={(m: string) => `${Number(m.slice(5))}월`} tick={AXIS} tickLine={false} axisLine={{ stroke: "#e3e6eb" }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 10000)}만` : num(v))} />
          <Tooltip
            formatter={(v, name) => [krw(Number(v)), platforms.find((p) => p.key === name)?.label ?? String(name)]}
            labelFormatter={(m) => `${String(m).slice(0, 4)}년 ${Number(String(m).slice(5))}월`}
            contentStyle={{ borderRadius: 8, borderColor: "#e3e6eb", fontSize: 13 }}
          />
          <Legend formatter={(name) => <span className="text-xs text-sub">{platforms.find((p) => p.key === name)?.label}</span>} iconType="square" iconSize={10} />
          {platforms.map((p, i) => (
            <Bar key={p.key} dataKey={p.key} stackId="a" fill={PLATFORM_COLORS[p.key]} radius={i === platforms.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
