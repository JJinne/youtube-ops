"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import * as routineAct from "@/app/actions/routine";
import { checkConnection, type CheckStep } from "@/app/actions/system";
import { Badge, Card, CardHeader, Empty, PageHeader, SourceBadge, btn, cx, field, fieldFull } from "@/components/ui";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { STAGES } from "@/lib/labels";
import type { DataMeta, MetricDefinition } from "@/lib/types";

interface Props {
  meta: DataMeta;
  mode: "sample" | "signed-out" | "live";
  email: string | null;
  metrics: MetricDefinition[];
  routineTemplates: { id: string; title: string; weekday: number; stage: string | null; active?: boolean }[];
}

const UNIT: Record<MetricDefinition["unit"], string> = { count: "횟수", minutes: "분", seconds: "초", percent: "%", ratio: "비율", krw: "원" };

export function SettingsView({ meta, mode, email, metrics, routineTemplates }: Props) {
  const [showSample, setShowSample] = useState(true);
  const [connectInfo, setConnectInfo] = useState(false);

  return (
    <div className="max-w-[1040px]">
      <PageHeader title="설정" />

      <StorageCard mode={mode} email={email} />

      <Card className="mb-4" aria-label="YouTube 연결">
        <CardHeader
          title="YouTube 연결"
          sub="읽기 전용 권한만 요청합니다 · youtube.readonly, yt-analytics.readonly"
          right={
            <button type="button" className={btn.primary} onClick={() => setConnectInfo(true)}>
              Google 계정으로 연결
            </button>
          }
        />
        <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-ground p-3">
            <dt className="text-xs text-muted">상태</dt>
            <dd className="text-sm font-bold text-sample-fg">{meta.connected ? "연결됨" : "미연결"}</dd>
          </div>
          <div className="rounded-lg bg-ground p-3">
            <dt className="text-xs text-muted">현재 데이터</dt>
            <dd className="mt-0.5"><SourceBadge source={meta.source} /></dd>
          </div>
          <div className="rounded-lg bg-ground p-3">
            <dt className="text-xs text-muted">마지막 동기화</dt>
            <dd className="text-sm">{meta.lastUpdatedAt ?? "—"}</dd>
          </div>
          <div className="rounded-lg bg-ground p-3">
            <dt className="text-xs text-muted">자동 동기화</dt>
            <dd className="text-sm">매일 1회 · 최근 7일 재수집</dd>
          </div>
        </dl>
        {connectInfo && (
          <div role="status" className="mb-4 rounded-lg border border-line bg-navy-tint px-4 py-3 text-[13px] text-navy">
            YouTube 연결은 5단계에서 붙입니다. Google Cloud 프로젝트와 OAuth 클라이언트가 준비되면 이 버튼이 Google 동의 화면으로 이동합니다.
          </div>
        )}
        <div className="rounded-lg bg-sample-bg px-4 py-3">
          <p className="text-[13px] font-bold text-sample-fg">연결 전 안내</p>
          <p className="text-xs text-[#5b3a00]">
            본인 전용 앱이라 Google 검증 없이 게시합니다. 연결할 때 "확인되지 않은 앱" 경고가 나타나면 "고급 → 계속"으로 진행하면 됩니다.
          </p>
        </div>
        <h3 className="mb-2 mt-5 text-[13px] font-bold">동기화 기록</h3>
        <Empty>아직 동기화한 적이 없습니다. 연결 후 성공·실패와 오류 내용이 여기에 쌓입니다.</Empty>
      </Card>

      <Card className="mb-4" aria-label="데이터">
        <CardHeader title="데이터" />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft pb-3">
          <div>
            <p className="text-sm">샘플 데이터 표시</p>
            <p className="text-xs text-muted">실제 데이터와 섞이지 않으며, 샘플은 모든 화면에 "샘플" 배지가 붙습니다</p>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-[13px]">
            <input type="checkbox" className="size-[18px] accent-navy" checked={showSample} onChange={(e) => setShowSample(e.target.checked)} />
            {showSample ? "켜짐" : "꺼짐 (4단계에서 실제 적용)"}
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft py-3">
          <div>
            <p className="text-sm">샘플 데이터 모두 삭제</p>
            <p className="text-xs text-muted">실제 데이터는 그대로 남습니다</p>
          </div>
          <button type="button" className={btn.danger} disabled>
            삭제 (4단계)
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <div>
            <p className="text-sm">전체 데이터 내보내기</p>
            <p className="text-xs text-muted">테이블별 CSV 묶음</p>
          </div>
          <button type="button" className={btn.accent} disabled>
            내보내기 (4단계)
          </button>
        </div>
      </Card>

      <Card className="mb-4" aria-label="기본값">
        <CardHeader title="기본값" sub="검토에서 확정한 값 · 4단계에서 변경 저장 연결" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] text-sub">
            주 시작 요일
            <select className={fieldFull} defaultValue="0" disabled>
              <option value="0">일요일</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-sub">
            쇼츠 자동 분류
            <select className={fieldFull} defaultValue="api" disabled>
              <option value="api">API 콘텐츠 유형 우선, 없으면 3분 이하</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-sub">
            성과 좋은 영상 기준
            <select className={fieldFull} defaultValue="views7" disabled>
              <option value="views7">업로드 후 7일 조회수</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-sub">
            제휴 링크 추적 값 형식
            <input className={fieldFull + " font-mono"} defaultValue={"yt_{영상ID}"} disabled />
          </label>
        </div>
      </Card>

      <TemplatesCard live={mode === "live"} templates={routineTemplates} />

      <Card aria-label="지표 정의">
        <CardHeader title="지표 정의" sub="화면의 모든 지표는 이 정의를 따릅니다 · 집계 기간은 각 화면에 함께 표시" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="px-2 py-2.5 font-medium">지표</th>
                <th className="px-2 py-2.5 font-medium">정의</th>
                <th className="px-2 py-2.5 font-medium">단위</th>
                <th className="px-2 py-2.5 font-medium">가져오는 방법</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.metric_key} className="border-b border-line-soft align-top">
                  <td className="whitespace-nowrap px-2 py-2.5 font-bold">{m.label_ko}</td>
                  <td className="px-2 py-2.5 text-sub">{m.description}</td>
                  <td className="whitespace-nowrap px-2 py-2.5">{UNIT[m.unit]}</td>
                  <td className="whitespace-nowrap px-2 py-2.5">
                    {m.api_available ? (
                      <Badge tone="good">API{m.api_name ? ` · ${m.api_name}` : ""}</Badge>
                    ) : (
                      <Badge tone="csv">CSV · 수동</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StorageCard({ mode, email }: { mode: Props["mode"]; email: string | null }) {
  const [pending, start] = useTransition();
  const [steps, setSteps] = useState<CheckStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="mb-4" aria-label="기록 저장소">
      <CardHeader
        title="기록 저장소 (Supabase)"
        sub={mode === "live" ? `${email} 계정으로 로그인됨 · 강의·인사이트·주간 루틴이 저장됩니다` : "연결 전입니다. 지금 입력하는 내용은 저장되지 않습니다"}
        right={
          mode === "live" ? (
            <>
              <button
                type="button"
                className={btn.accent}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await checkConnection();
                    if (r.ok) setSteps(r.data ?? []);
                    else setError(r.error);
                  })
                }
              >
                {pending ? "점검 중…" : "연결 점검"}
              </button>
              <form action="/auth/signout" method="post">
                <button type="submit" className={btn.secondary}>
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Badge tone="sample">샘플 모드</Badge>
          )
        }
      />
      {mode !== "live" && (
        <p className="text-[13px] text-sub">
          Supabase 프로젝트를 만들고 환경 변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ALLOWED_EMAILS)를 넣으면 로그인 화면이 열리고 기록이 저장됩니다. 순서는 프로젝트의 SETUP.md를 따르세요.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
          {error}
        </p>
      )}
      {steps && (
        <ul className="flex flex-col" aria-label="점검 결과">
          {steps.map((s) => (
            <li key={s.name} className="flex flex-wrap items-baseline gap-x-3 border-b border-line-soft py-2 text-[13px]">
              <Badge tone={s.ok ? "good" : "bad"}>{s.ok ? "정상" : "문제"}</Badge>
              <span className="w-20 font-bold">{s.name}</span>
              <span className="min-w-0 flex-1 text-sub">{s.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TemplatesCard({ live, templates }: { live: boolean; templates: Props["routineTemplates"] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [weekday, setWeekday] = useState("1");
  const [stage, setStage] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "저장하지 못했습니다" });
      if (r.ok) router.refresh();
    });
  }

  return (
    <Card className="mb-4" aria-label="반복 작업">
      <CardHeader title="반복 작업" sub="매주 같은 요일에 주간 루틴 보드에 자동으로 생깁니다. 끄면 다음 주부터 생기지 않습니다." />
      {templates.length === 0 && <Empty>등록한 반복 작업이 없습니다.</Empty>}
      <ul className="flex flex-col">
        {templates.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft py-2 text-[13px]">
            <span className={cx(t.active === false && "text-muted line-through")}>{t.title}</span>
            <span className="flex items-center gap-3">
              <span className="text-muted">매주 {WEEKDAY_LABELS[t.weekday]}요일</span>
              {live && (
                <button
                  type="button"
                  className={btn.secondary + " min-h-8 px-2.5 text-xs"}
                  disabled={pending}
                  onClick={() => run(() => routineAct.setTemplateActive(t.id, t.active === false), t.active === false ? "다시 켰습니다" : "껐습니다")}
                >
                  {t.active === false ? "켜기" : "끄기"}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {live ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            run(() => routineAct.createTemplate({ title: title.trim(), weekday: Number(weekday), stage: stage || undefined }), `"${title.trim()}"을(를) 추가했습니다. 이번 주 보드에도 바로 생깁니다`);
            setTitle("");
          }}
        >
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px] font-bold text-sub">
            작업
            <input id="tpl-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 댓글 확인·답글" className={fieldFull} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
            요일
            <select id="tpl-weekday" value={weekday} onChange={(e) => setWeekday(e.target.value)} className={field}>
              {WEEKDAY_LABELS.map((w, i) => (
                <option key={w} value={i}>{w}요일</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-bold text-sub">
            단계
            <select id="tpl-stage" value={stage} onChange={(e) => setStage(e.target.value)} className={field}>
              <option value="">없음</option>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" className={btn.primary} disabled={pending}>
            추가
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted">샘플 모드에서는 목록만 보여 줍니다.</p>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cx("mt-3 text-[13px]", msg.ok ? "text-good-fg" : "text-bad")}>
          {msg.text}
        </p>
      )}
    </Card>
  );
}
