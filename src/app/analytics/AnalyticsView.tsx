"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { RetentionChart, TrendChart } from "@/components/charts";
import { Chips, Segmented } from "@/components/controls";
import { AiBadge, Badge, Card, CardHeader, DataStatus, Empty, InfoTip, PageHeader, SourceBadge, StatCard, btn, deltaTone } from "@/components/ui";
import { addDays, diffDays, fullDate, shortDate } from "@/lib/dates";
import { changeRate, hours, krw, num, pct, secondsToClock, signed, signedPct } from "@/lib/format";
import { METRICS, VERDICT } from "@/lib/labels";
import { channelPeriodWithPrevious, dailySeries, dailySeriesByType, manualValue, videoCumulative } from "@/lib/metrics";
import type { AiAnalysis, ChannelDailyMetric, ContentType, DataMeta, ManualMetric, RetentionPoint, Verdict, Video, VideoDailyMetric } from "@/lib/types";

type TypeFilter = "all" | ContentType;
type Period = "7" | "28" | "90";
type SeriesKey = "views" | "watchHours" | "netSubs";
type Basis = "7" | "28" | "all";

interface Props {
  meta: DataMeta;
  today: string;
  lastDataDate: string;
  provisionalDays: number;
  videos: Video[];
  daily: VideoDailyMetric[];
  channel: ChannelDailyMetric[];
  retention: RetentionPoint[];
  manual: ManualMetric[];
  insights: { id: string; content: string; linked_video_ids: string[] }[];
  experiments: { id: string; hypothesis: string; video_id: string | null; verdict: Verdict }[];
  revenueByVideo: Record<string, number>;
  channelAnalysis: AiAnalysis | null;
}

export function AnalyticsView(p: Props) {
  const params = useSearchParams();
  const initialVideo = params.get("video");
  const [type, setType] = useState<TypeFilter>(() => (initialVideo ? (p.videos.find((v) => v.id === initialVideo)?.content_type ?? "long") : "long"));
  const [period, setPeriod] = useState<Period>("28");
  const [series, setSeries] = useState<SeriesKey>("views");
  const [basis, setBasis] = useState<Basis>("7");
  const [selected, setSelected] = useState<string | null>(initialVideo);

  const days = Number(period);
  const start = addDays(p.lastDataDate, -(days - 1));
  const provisionalFrom = addDays(p.lastDataDate, -(p.provisionalDays - 1));

  const chartData = useMemo(
    () => (type === "all" ? dailySeries(p.channel, start, p.lastDataDate) : dailySeriesByType(p.daily, p.videos, type, start, p.lastDataDate)),
    [type, start, p.channel, p.daily, p.videos, p.lastDataDate],
  );

  const summary = useMemo(() => {
    if (type === "all") {
      const { current, previous } = channelPeriodWithPrevious(p.channel, p.lastDataDate, days);
      return { views: current.views, prevViews: previous?.views ?? null, minutes: current.watchMinutes, prevMinutes: previous?.watchMinutes ?? null, subs: current.netSubs, subsLabel: "순 구독자 증감" };
    }
    const agg = (s: string, e: string) => {
      const ids = new Set(p.videos.filter((v) => v.content_type === type).map((v) => v.id));
      let views = 0, minutes = 0, subs = 0;
      for (const m of p.daily) {
        if (!ids.has(m.video_id) || m.date < s || m.date > e) continue;
        views += m.views ?? 0;
        minutes += m.watch_time_minutes ?? 0;
        subs += m.subscribers_gained ?? 0;
      }
      return { views, minutes, subs };
    };
    const cur = agg(start, p.lastDataDate);
    const prev = agg(addDays(start, -days), addDays(start, -1));
    return { views: cur.views, prevViews: prev.views || null, minutes: cur.minutes, prevMinutes: prev.minutes || null, subs: cur.subs, subsLabel: "구독자 증가(시청 페이지)" };
  }, [type, days, start, p.channel, p.daily, p.videos, p.lastDataDate]);

  const rows = useMemo(() => {
    const list = p.videos.filter((v) => type === "all" || v.content_type === type);
    const n: number | "all" = basis === "all" ? "all" : Number(basis);
    return list.map((v) => ({ c: videoCumulative(v, p.daily, n), ctr: manualValue(p.manual, v.id, "impressions_ctr") }));
  }, [type, basis, p.videos, p.daily, p.manual]);

  const selectedVideo = p.videos.find((v) => v.id === selected) ?? null;
  const seriesLabel = series === "views" ? "조회수" : series === "watchHours" ? "시청 시간" : summary.subsLabel;
  const typeName = type === "all" ? "전체" : type === "long" ? "일반 영상" : "쇼츠";

  return (
    <>
      <PageHeader title="유튜브 분석" right={<DataStatus source={p.meta.source} lastUpdatedAt={p.meta.lastUpdatedAt} provisionalNote />} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="콘텐츠 유형"
          value={type}
          onChange={(v) => {
            setType(v);
            setSelected(null);
          }}
          options={[
            { value: "all", label: "전체" },
            { value: "long", label: "일반 영상" },
            { value: "short", label: "쇼츠" },
          ]}
        />
        <Chips
          label="기간"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "7", label: "7일" },
            { value: "28", label: "28일" },
            { value: "90", label: "90일" },
          ]}
        />
      </div>
      <p className="mb-4 text-xs text-muted">
        현재 보기: {typeName} · {fullDate(start)} – {fullDate(p.lastDataDate).slice(5)} ({days}일) · 비교와 순위는 같은 유형끼리만 계산
        {type === "all" && " · 전체에는 이전에 올린 영상의 조회도 포함"}
      </p>

      <section aria-label="기간 요약" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={`조회수 · ${days}일`}
          value={num(summary.views)}
          delta={`직전 ${days}일 대비 ${signedPct(changeRate(summary.views, summary.prevViews))}`}
          deltaTone={deltaTone(changeRate(summary.views, summary.prevViews), true)}
          badge={<SourceBadge source={p.meta.source} short />}
        />
        <StatCard
          label={`시청 시간 · ${days}일`}
          value={hours(summary.minutes)}
          delta={`직전 ${days}일 대비 ${signedPct(changeRate(summary.minutes, summary.prevMinutes))}`}
          deltaTone={deltaTone(changeRate(summary.minutes, summary.prevMinutes), true)}
          badge={<SourceBadge source={p.meta.source} short />}
        />
        <StatCard
          label={`${summary.subsLabel} · ${days}일`}
          value={signed(summary.subs)}
          note={type === "all" ? "채널 전체 기준" : "영상 단위 구독은 해당 영상 시청 페이지에서 생긴 것만 포함"}
          badge={<SourceBadge source={p.meta.source} short />}
        />
      </section>

      <Card className="mb-4" id="overview">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Segmented
            size="sm"
            label="차트 지표"
            value={series}
            onChange={setSeries}
            options={[
              { value: "views", label: "조회수" },
              { value: "watchHours", label: "시청 시간" },
              { value: "netSubs", label: type === "all" ? "순 구독자" : "구독자 증가" },
            ]}
          />
          <InfoTip label={seriesLabel}>
            {series === "views" ? METRICS.views.description : series === "watchHours" ? `${METRICS.watch_time_minutes.description}(시간)` : "구독자 증가 − 감소(전체 보기). 유형별 보기에서는 영상 시청 페이지에서 생긴 증가만 집계"}
            <br />
            집계 기간: {fullDate(start)} – {fullDate(p.lastDataDate)}
          </InfoTip>
        </div>
        <TrendChart data={chartData} dataKey={series} label={seriesLabel} unit={series === "watchHours" ? "시간" : ""} provisionalFrom={provisionalFrom} />
        <p className="mt-2 text-xs text-muted">회색 영역: 최근 {p.provisionalDays}일은 YouTube가 수치를 보정 중일 수 있어 확정 전 값입니다.</p>

        {p.channelAnalysis && type === "all" && (
          <div className="mt-4 rounded-xl bg-ai-bg p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <AiBadge />
              <Badge tone="sample">샘플 분석</Badge>
              <span className="text-xs text-ai-fg">신뢰도 {p.channelAnalysis.output.confidence === "high" ? "높음" : p.channelAnalysis.output.confidence === "medium" ? "보통" : "낮음"}</span>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              {p.channelAnalysis.output.items.map((it, i) => (
                <li key={i}>
                  <span className="mr-1.5 text-xs font-bold text-ai-fg">{it.kind === "observation" ? "관찰" : it.kind === "hypothesis" ? "가설" : "제안"}</span>
                  {it.text}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-sub">
              근거: {p.channelAnalysis.output.evidence_metrics.map((k) => METRICS[k]?.label_ko).join(", ")} · {fullDate(p.channelAnalysis.period_start)} – {fullDate(p.channelAnalysis.period_end)}
            </p>
          </div>
        )}
      </Card>

      <Card className="mb-4" id="compare">
        <CardHeader
          title="영상별 비교"
          sub="행을 누르면 영상 상세가 열립니다"
          right={
            <Segmented
              size="sm"
              label="비교 기준"
              value={basis}
              onChange={setBasis}
              options={[
                { value: "7", label: "업로드 후 7일" },
                { value: "28", label: "28일" },
                { value: "all", label: "전체 기간" },
              ]}
            />
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-2 py-2.5 font-medium">영상</th>
                {type === "all" && <th className="px-2 py-2.5 font-medium">유형</th>}
                <th className="px-2 py-2.5 font-medium">업로드일</th>
                <th className="px-2 py-2.5 text-right font-medium">경과일</th>
                <th className="px-2 py-2.5 text-right font-medium">조회수</th>
                <th className="px-2 py-2.5 text-right font-medium">시청 시간</th>
                <th className="px-2 py-2.5 text-right font-medium">평균 시청 비율</th>
                <th className="px-2 py-2.5 text-right font-medium">
                  노출 클릭률 <Badge tone="csv">CSV</Badge>
                </th>
                <th className="px-2 py-2.5 text-right font-medium">구독자 증가</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, ctr }) => {
                const on = c.video.id === selected;
                return (
                  <tr key={c.video.id} className={`border-b border-line-soft ${on ? "bg-navy-tint" : "hover:bg-ground"}`}>
                    <td className="max-w-[320px] px-2 py-2">
                      <button type="button" onClick={() => setSelected(c.video.id)} className="block w-full truncate text-left text-ink hover:text-navy" aria-pressed={on}>
                        {c.video.title}
                      </button>
                    </td>
                    {type === "all" && <td className="px-2 py-2 text-sub">{c.video.content_type === "long" ? "일반" : "쇼츠"}</td>}
                    <td className="px-2 py-2 text-sub">{shortDate(c.video.published_at.slice(0, 10))}</td>
                    <td className="tabular px-2 py-2 text-right">{diffDays(p.today, c.video.published_at.slice(0, 10))}</td>
                    <td className="tabular px-2 py-2 text-right font-bold">
                      {num(c.views)}
                      {!c.complete && <span className="ml-1 text-[11px] font-normal text-warn">집계 중</span>}
                    </td>
                    <td className="tabular px-2 py-2 text-right">{hours(c.watchMinutes)}</td>
                    <td className="tabular px-2 py-2 text-right">{pct(c.avgViewPercentage)}</td>
                    <td className="tabular px-2 py-2 text-right">{ctr ? pct(ctr.value) : <span className="text-muted">—</span>}</td>
                    <td className="tabular px-2 py-2 text-right">{signed(c.subsGained)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          "집계 중": 아직 기준 일수가 차지 않은 영상. 노출 클릭률은 API 제공 여부를 확인하기 전까지 Studio CSV의 최근 28일 값({fullDate(addDays(p.lastDataDate, -27))} – {fullDate(p.lastDataDate).slice(5)})입니다.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="detail">
          {selectedVideo ? <VideoDetail video={selectedVideo} {...p} /> : (
            <>
              <CardHeader title="영상 상세" />
              <Empty>위 표에서 영상을 고르면 일별 추이, 시청 지속 곡선, 연결된 기록이 여기에 표시됩니다.</Empty>
            </>
          )}
        </Card>
        <CsvImport />
      </div>
    </>
  );
}

function VideoDetail({ video, ...p }: Props & { video: Video }) {
  const pub = video.published_at.slice(0, 10);
  const c7 = videoCumulative(video, p.daily, 7);
  const all = videoCumulative(video, p.daily, "all");
  const curve = p.retention
    .filter((r) => r.video_id === video.id)
    .map((r) => ({ pct: Math.round(r.elapsed_ratio * 100), video: r.audience_watch_ratio, relative: r.relative_retention_performance }));
  const linkedInsights = p.insights.filter((i) => i.linked_video_ids.includes(video.id));
  const linkedExperiments = p.experiments.filter((e) => e.video_id === video.id);
  const revenue = p.revenueByVideo[video.id] ?? 0;
  const impressions = manualValue(p.manual, video.id, "impressions");
  const ctr = manualValue(p.manual, video.id, "impressions_ctr");

  return (
    <>
      <CardHeader title={video.title} level={3} sub={`${video.content_type === "long" ? "일반 영상" : "쇼츠"} · 업로드 ${fullDate(pub)} · ${diffDays(p.today, pub)}일 경과 · 길이 ${secondsToClock(video.duration_sec)}`} />
      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="7일 조회수" value={`${num(c7.views)}${c7.complete ? "" : " (집계 중)"}`} />
        <Stat label="누적 조회수" value={num(all.views)} />
        <Stat label="평균 시청 비율" value={pct(all.avgViewPercentage)} />
        <Stat label="노출 클릭률 (CSV)" value={ctr ? `${pct(ctr.value)}` : "—"} sub={impressions ? `노출 ${num(impressions.value)}` : undefined} />
      </dl>

      <h4 className="mb-1 text-[13px] font-bold">시청 지속 곡선</h4>
      {curve.length ? (
        <>
          <RetentionChart data={curve} />
          <p className="mt-1 text-xs text-muted">실선: 이 영상의 시청 지속 비율 · 점선: 비슷한 길이 영상 대비 상대 시청 지속(0.5가 중간) · 누적 기간 기준</p>
        </>
      ) : (
        <Empty>{video.content_type === "short" ? "쇼츠의 시청 지속 곡선은 5단계에서 API 제공 범위를 확인한 뒤 표시합니다." : "시청 지속 데이터가 없습니다."}</Empty>
      )}

      <div className="mt-4 rounded-xl bg-ai-bg p-4">
        <div className="mb-1 flex items-center gap-2">
          <AiBadge />
        </div>
        <p className="text-sm text-sub">이 영상의 지표를 근거로 한 가설은 6단계(AI 인사이트)에서 생성됩니다. 생성 결과에는 근거 지표와 분석 기간이 함께 표시됩니다.</p>
        <button type="button" className={btn.ai + " mt-2"} disabled>
          AI 분석 받기 (6단계)
        </button>
      </div>

      <div className="mt-4 border-t border-line-soft pt-3">
        <h4 className="mb-2 text-[13px] font-bold">연결된 기록</h4>
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {linkedInsights.map((i) => (
            <li key={i.id}>
              <Badge tone="accent">인사이트</Badge> <Link href="/insights">{i.content}</Link>
            </li>
          ))}
          {linkedExperiments.map((e) => (
            <li key={e.id}>
              <Badge tone={VERDICT[e.verdict].tone}>실험 · {VERDICT[e.verdict].label}</Badge> <Link href={`/experiments?id=${e.id}`}>{e.hypothesis}</Link>
            </li>
          ))}
          <li>
            <Badge tone="csv">제휴 수익</Badge> 확정 {krw(revenue)}
          </li>
          {!linkedInsights.length && !linkedExperiments.length && <li className="text-muted">연결된 인사이트·실험이 없습니다.</li>}
        </ul>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-ground p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-bold">{value}</dd>
      {sub && <dd className="text-[11px] text-muted">{sub}</dd>}
    </div>
  );
}

/** CSV 미리보기. 3단계에서는 파일을 읽어 열 구성만 보여 주고 저장하지 않는다. */
function CsvImport() {
  const [preview, setPreview] = useState<{ name: string; rows: number; columns: string[]; error?: string } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const columns = (lines[0] ?? "").split(",").map((c) => c.replace(/^"|"$/g, "").trim());
      setPreview({ name: file.name, rows: Math.max(0, lines.length - 1), columns });
    } catch {
      setPreview({ name: file.name, rows: 0, columns: [], error: "파일을 읽지 못했습니다. CSV 형식인지 확인해 주세요." });
    }
  }

  const known = ["노출수", "노출 클릭률(%)", "Impressions", "Impressions click-through rate (%)", "콘텐츠", "Content"];

  return (
    <Card id="import">
      <CardHeader title="데이터 가져오기" sub="YouTube Studio에서 내보낸 CSV · 영상별 최근 28일 권장" />
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-field bg-ground p-4 text-center hover:border-navy">
        <span className="text-sm font-medium">CSV 파일 선택</span>
        <span className="text-xs text-muted">노출수 · 노출 클릭률이 들어 있는 파일</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <span className={btn.accent}>파일 고르기</span>
      </label>
      {preview && (
        <div className="mt-3 rounded-lg border border-line p-3 text-[13px]" role="status">
          {preview.error ? (
            <p className="text-bad">{preview.error}</p>
          ) : (
            <>
              <p>
                <strong>{preview.name}</strong> · {num(preview.rows)}행 · 열 {preview.columns.length}개
              </p>
              <ul className="mt-2 flex flex-wrap gap-1">
                {preview.columns.slice(0, 12).map((c) => (
                  <li key={c}>
                    <Badge tone={known.includes(c) ? "good" : "neutral"}>{c || "(빈 열)"}</Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">초록: 앱이 알아보는 열. 열 매핑과 저장은 4단계에서 연결됩니다 (지금은 미리보기만).</p>
            </>
          )}
        </div>
      )}
      <button type="button" className={btn.secondary + " mt-3"} disabled>
        수동으로 지표 입력 (4단계)
      </button>
    </Card>
  );
}
