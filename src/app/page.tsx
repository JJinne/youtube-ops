import Link from "next/link";
import { PriorityList } from "@/components/PriorityList";
import { Badge, Card, CardHeader, DataStatus, InfoTip, PageHeader, Progress, SourceBadge, StatCard, deltaTone } from "@/components/ui";
import { db, lastDataDate, meta } from "@/lib/data";
import { getDataContext } from "@/lib/repo/context";
import { SAMPLE_TODAY } from "@/lib/sample-data";
import { loadLectures } from "@/lib/repo/lectures";
import { loadRoutine } from "@/lib/repo/routine";
import { addDays, diffDays, fullDate, monthKey, shortDate } from "@/lib/dates";
import { changeRate, duration, hours, krw, num, pct, signed, signedPct } from "@/lib/format";
import { METRICS, STAGES } from "@/lib/labels";
import {
  channelPeriodWithPrevious,
  completionRate,
  goalProgress,
  revenueMonth,
  subscriberCount,
  topVideos,
  weekTimeComparison,
} from "@/lib/metrics";

export default async function HomePage() {
  const ctx = await getDataContext();
  const [routineData, lectureData] = await Promise.all([loadRoutine(ctx), loadLectures(ctx)]);
  const today = ctx.today;
  const currentWeek = ctx.currentWeek;

  // YouTube 지표는 5단계 전까지 샘플
  const { current, previous } = channelPeriodWithPrevious(db.channelDailyMetrics, lastDataDate, 28);
  const longs = db.videos.filter((v) => v.content_type === "long");
  const avgPctNow = weightedAvgPct(longs.map((v) => v.id), current.start, current.end);
  const avgPctPrev = previous ? weightedAvgPct(longs.map((v) => v.id), previous.start, previous.end) : null;
  const sampleToday = SAMPLE_TODAY; // 샘플 영상·수익·목표 계산은 샘플 기준일로

  // 루틴 · 인사이트는 실제 모드에서 DB 값
  const weekEnd = addDays(currentWeek, 6);
  const routine = completionRate(routineData.tasks, currentWeek);
  const carried = routineData.tasks.filter((t) => t.week_start === currentWeek && t.carried_from_task_id).length;
  const activeProjects = routineData.projects.filter((p) => p.stage !== "idea" && (p.stage !== "upload" || p.week_start === currentWeek));
  const time = weekTimeComparison(routineData.timeEntries, routineData.projects, routineData.videos, currentWeek, today);

  const recentInsights = lectureData.insights.filter((i) => diffDays(today, i.created_at.slice(0, 10)) < 7).slice(-3).reverse();
  const sampleTag = ctx.live ? <Badge tone="sample">샘플</Badge> : null;
  const month = monthKey(sampleToday);
  const rev = revenueMonth(db.revenueEntries, month);
  const subs = subscriberCount(db.channelDailyMetrics, db.subscribersBeforeStart, lastDataDate);
  const mainGoal = db.goals[0];
  const mainGoalProgress = goalProgress(mainGoal, db.goalMilestones, null);

  return (
    <>
      <PageHeader
        title="홈"
        sub={`이번 주 ${fullDate(currentWeek)}(일) – ${shortDate(weekEnd)} · 지표 기준일 ${shortDate(lastDataDate)}`}
        right={<DataStatus source={meta.source} lastUpdatedAt={meta.lastUpdatedAt} />}
      />

      <section aria-label="채널 주요 지표" className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="조회수 · 최근 28일"
          value={num(current.views)}
          delta={`직전 28일 대비 ${signedPct(changeRate(current.views, previous?.views ?? null))}`}
          deltaTone={deltaTone(changeRate(current.views, previous?.views ?? null), true)}
          note={`${shortDate(current.start, false)} – ${shortDate(current.end, false)}`}
          badge={<SourceBadge source={meta.source} short />}
          info={<InfoTip label={METRICS.views.label_ko}>{METRICS.views.description}. 채널 전체(일반 영상 + 쇼츠) 합계.</InfoTip>}
        />
        <StatCard
          label="시청 시간 · 최근 28일"
          value={hours(current.watchMinutes)}
          delta={`직전 28일 대비 ${signedPct(changeRate(current.watchMinutes, previous?.watchMinutes ?? null))}`}
          deltaTone={deltaTone(changeRate(current.watchMinutes, previous?.watchMinutes ?? null), true)}
          note={`${shortDate(current.start, false)} – ${shortDate(current.end, false)}`}
          badge={<SourceBadge source={meta.source} short />}
          info={<InfoTip label={METRICS.watch_time_minutes.label_ko}>{METRICS.watch_time_minutes.description}(시간 단위로 반올림).</InfoTip>}
        />
        <StatCard
          label="순 구독자 증감 · 28일"
          value={signed(current.netSubs)}
          delta={`증가 ${num(current.subsGained)} · 감소 ${num(current.subsLost)}`}
          deltaTone="neutral"
          note={`현재 약 ${num(subs)}명`}
          badge={<SourceBadge source={meta.source} short />}
          info={<InfoTip label="순 구독자 증감">구독자 증가 − 구독자 감소. 채널 전체 기준.</InfoTip>}
        />
        <StatCard
          label="평균 시청 비율 · 일반 영상"
          value={pct(avgPctNow)}
          delta={avgPctPrev !== null && avgPctNow !== null ? `직전 28일 대비 ${signed(avgPctNow - avgPctPrev)}%p` : undefined}
          deltaTone={deltaTone(avgPctNow !== null && avgPctPrev !== null ? avgPctNow - avgPctPrev : null, true)}
          note="쇼츠는 분석 화면에서 따로"
          badge={<SourceBadge source={meta.source} short />}
          info={<InfoTip label={METRICS.avg_view_percentage.label_ko}>{METRICS.avg_view_percentage.description}. 조회수 가중 평균.</InfoTip>}
        />
      </section>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="이번 주 제작 현황" right={<Link href="/routine" className="text-[13px] font-bold">루틴 보드</Link>} />
          <div className="mb-2 hidden grid-cols-[minmax(0,220px)_repeat(6,minmax(0,1fr))] gap-1 text-[11px] text-muted sm:grid">
            <span />
            {STAGES.map((s) => (
              <span key={s.key}>{s.label}</span>
            ))}
          </div>
          {activeProjects.length === 0 && <p className="text-[13px] text-muted">진행 중인 영상이 없습니다. 루틴 보드에서 "+ 영상"으로 추가하세요.</p>}
          <ul className="flex flex-col gap-3">
            {activeProjects.map((p) => {
              const idx = STAGES.findIndex((s) => s.key === p.stage);
              return (
                <li key={p.id} className="grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{p.title}</span>
                    <span className="text-xs text-muted">
                      {p.content_type === "long" ? "일반 영상" : "쇼츠"} · {STAGES[idx].label} 단계
                      {p.target_upload_date ? ` · 목표 ${shortDate(p.target_upload_date)}` : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1" aria-label={`${STAGES.length}단계 중 ${idx + 1}단계`}>
                    {STAGES.map((s, i) => (
                      <span key={s.key} className={`h-2 rounded ${i <= idx ? "bg-navy" : "bg-line"}`} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="주간 루틴" sub="일요일 시작 · 토요일 마감" />
          <div className="flex items-baseline gap-2">
            <span className="tabular text-4xl font-bold tracking-tight">{routine.rate === null ? "—" : `${Math.round(routine.rate)}%`}</span>
            <span className="text-[13px] text-muted">
              완료 {routine.done} / {routine.total}
              {carried ? ` · 이월 ${carried}` : ""}
            </span>
          </div>
          <Progress value={routine.rate ?? 0} label="주간 루틴 달성률" className="mt-3" />
          <div className="mt-5 border-t border-line-soft pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-muted">투여 시간 ({time.elapsedDays}일째)</span>
              <span className="tabular text-lg font-bold">{duration(time.total.now)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              지난주 같은 시점 {duration(time.total.before)} ·{" "}
              <span className={time.total.now <= time.total.before ? "font-bold text-good" : "font-bold text-warn"}>
                {time.total.now <= time.total.before ? "줄었음" : "늘었음"} {duration(Math.abs(time.total.now - time.total.before))}
              </span>
            </p>
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title="최근 성과 좋은 영상" sub="최근 30일 업로드 · 업로드 후 7일 조회수 · 유형별 상위 3개" right={<>{sampleTag}<Link href="/analytics" className="text-[13px] font-bold">분석</Link></>} />
        <div className="grid gap-6 md:grid-cols-2">
          {(["long", "short"] as const).map((type) => (
            <div key={type} className="min-w-0">
              <h3 className="mb-1 text-[13px] font-bold text-navy">{type === "long" ? "일반 영상" : "쇼츠"}</h3>
              <ol>
                {topVideos(db.videos, db.videoDailyMetrics, type, sampleToday).map((c, i) => (
                  <li key={c.video.id} className="flex items-center gap-3 border-t border-line-soft py-2.5">
                    <span className="w-4 text-[13px] font-bold text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/analytics?video=${c.video.id}`} className="block truncate text-sm text-ink no-underline hover:text-navy">
                        {c.video.title}
                      </Link>
                      <span className="text-xs text-muted">
                        업로드 {shortDate(c.video.published_at.slice(0, 10))} · {diffDays(sampleToday, c.video.published_at.slice(0, 10))}일 경과
                        {!c.complete && " · 7일 집계 중"}
                      </span>
                    </div>
                    <span className="tabular text-sm font-bold">{num(c.views)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="이번 주 인사이트" sub="최근 7일 작성" right={<Link href="/insights" className="text-[13px] font-bold">전체</Link>} />
          {recentInsights.length === 0 && <p className="text-[13px] text-muted">최근 7일에 쓴 인사이트가 없습니다.</p>}
          <ul className="flex flex-col gap-2">
            {recentInsights.map((i) => {
              const lec = lectureData.lectures.find((l) => l.id === i.lecture_id);
              return (
                <li key={i.id} className="rounded-lg border border-line-soft p-3">
                  <p className="text-sm">{i.content}</p>
                  <p className="mt-1 text-xs text-muted">
                    {lec?.title ?? "강의 없음"} · {shortDate(i.created_at.slice(0, 10))}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="다음 우선순위 3가지" right={sampleTag} />
          <PriorityList items={db.priorities} analyses={db.aiAnalyses} />
        </Card>

        <Card>
          <CardHeader title="목표 · 이번 달 수익" right={<>{sampleTag}<Link href="/goals" className="text-[13px] font-bold">목표</Link></>} />
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate">{mainGoal.title}</span>
              <span className="tabular shrink-0 font-bold text-navy">D-{diffDays(mainGoal.target_date, today)}</span>
            </div>
            <Progress value={mainGoalProgress.pct} label={`${mainGoal.title} 진행률`} />
            <span className="text-xs text-muted">
              {mainGoalProgress.kind === "milestone" ? `마일스톤 ${mainGoalProgress.done} / ${mainGoalProgress.total} 완료` : ""}
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-1.5 border-t border-line-soft pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-muted">{Number(month.slice(5))}월 제휴 수익 (확정)</span>
              <span className="tabular text-xl font-bold">{krw(rev.confirmed)}</span>
            </div>
            <span className="text-xs text-muted">
              예상 {krw(rev.expected)} 별도 · <Badge tone="csv">CSV · 수동</Badge>
            </span>
            <Link href="/revenue" className="text-[13px] font-bold">
              수익 상세
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}

function weightedAvgPct(ids: string[], start: string, end: string): number | null {
  const set = new Set(ids);
  let views = 0;
  let w = 0;
  for (const m of db.videoDailyMetrics) {
    if (!set.has(m.video_id) || m.date < start || m.date > end) continue;
    views += m.views ?? 0;
    w += (m.avg_view_percentage ?? 0) * (m.views ?? 0);
  }
  return views ? w / views : null;
}
