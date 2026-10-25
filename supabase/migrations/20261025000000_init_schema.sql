-- =====================================================================
-- 유튜브 운영 앱 · 초기 스키마 (설계안 v0.2 기준)
-- 2026-10-25
--
-- 묶음: 채널 데이터 · 학습 · 제작 · 실험/AI · 목표/수익
-- 원칙
--   1. 모든 사용자 데이터 테이블은 user_id + RLS로 본인 행만 접근한다.
--   2. 지표 행은 source(api · csv · manual · sample)와 is_sample로 출처를 구분한다.
--   3. 누락된 지표는 0이 아니라 NULL로 둔다.
--   4. 주(week)는 일요일 시작이다. week_start 컬럼은 일요일 날짜만 허용한다.
--   5. YouTube 갱신 토큰은 서버에서 암호화해 저장하고, 브라우저 역할에는 읽기 권한을 주지 않는다.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 공통: updated_at 자동 갱신
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
-- 1. 채널 데이터
-- =====================================================================

-- 지표 정의 사전 (모든 사용자 공용, 읽기 전용)
create table public.metric_definitions (
  metric_key     text primary key,
  label_ko       text not null,
  description    text not null,
  unit           text not null,                -- count · minutes · seconds · percent · ratio · krw
  api_available  boolean not null default false,
  api_name       text,                          -- YouTube Analytics API 지표 이름
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- YouTube 연결 계정과 토큰
create table public.youtube_connections (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  channel_id               text not null,
  channel_title            text,
  scopes                   text[] not null default '{}',
  refresh_token_encrypted  bytea,               -- 서버에서 AES-GCM으로 암호화한 값. 브라우저에 노출 금지
  status                   text not null default 'connected'
                           check (status in ('connected', 'reconnect_required', 'disconnected')),
  last_synced_at           timestamptz,
  last_error               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (user_id, channel_id)
);

-- CSV 업로드 이력 (YouTube Studio · 제휴 플랫폼 공용)
create table public.csv_imports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  import_type   text not null
                check (import_type in ('youtube_studio', 'coupang_partners', 'naver_brand_connect', 'ohou_curator')),
  file_name     text not null,
  mapping_json  jsonb not null default '{}'::jsonb,
  row_count     integer not null default 0,
  period_start  date,
  period_end    date,
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'done', 'failed')),
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start)
);

-- 영상 메타데이터
create table public.videos (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  youtube_video_id     text,                    -- 샘플 데이터는 NULL 가능
  title                text not null,
  published_at         timestamptz,
  duration_sec         integer check (duration_sec is null or duration_sec >= 0),
  thumbnail_url        text,
  privacy_status       text check (privacy_status in ('public', 'unlisted', 'private')),
  content_type         text not null default 'long' check (content_type in ('short', 'long')),
  content_type_source  text not null default 'duration'
                       check (content_type_source in ('api', 'duration', 'manual')),
  source               text not null default 'api' check (source in ('api', 'csv', 'manual', 'sample')),
  is_sample            boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, youtube_video_id)
);

-- 채널 일별 지표
create table public.channel_daily_metrics (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date                   date not null,
  views                  bigint,
  engaged_views          bigint,
  watch_time_minutes     numeric(14, 2),
  avg_view_duration_sec  numeric(10, 2),
  subscribers_gained     integer,
  subscribers_lost       integer,
  source                 text not null default 'api' check (source in ('api', 'csv', 'manual', 'sample')),
  is_sample              boolean not null default false,
  fetched_at             timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, date, is_sample)
);

-- 영상 일별 지표
create table public.video_daily_metrics (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id               uuid not null references public.videos(id) on delete cascade,
  date                   date not null,
  days_since_publish     integer check (days_since_publish is null or days_since_publish >= 0),
  views                  bigint,
  engaged_views          bigint,
  watch_time_minutes     numeric(14, 2),
  avg_view_duration_sec  numeric(10, 2),
  avg_view_percentage    numeric(6, 2),
  likes                  integer,
  comments               integer,
  shares                 integer,
  subscribers_gained     integer,               -- 영상 시청 페이지에서 발생한 것만 집계됨
  subscribers_lost       integer,
  source                 text not null default 'api' check (source in ('api', 'csv', 'manual', 'sample')),
  is_sample              boolean not null default false,
  fetched_at             timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (video_id, date)
);

-- 시청 지속 곡선
create table public.video_retention (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id                        uuid not null references public.videos(id) on delete cascade,
  period_start                    date not null,
  period_end                      date not null,
  elapsed_ratio                   numeric(5, 4) not null check (elapsed_ratio between 0 and 1),
  audience_watch_ratio            numeric(8, 4),
  relative_retention_performance  numeric(5, 4),
  fetched_at                      timestamptz not null default now(),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique (video_id, period_start, period_end, elapsed_ratio),
  check (period_end >= period_start)
);

-- API에 없는 지표 (노출수 · 클릭률 등)
create table public.manual_metrics (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id       uuid references public.videos(id) on delete cascade,   -- NULL이면 채널 단위
  metric_key     text not null references public.metric_definitions(metric_key),
  value          numeric(16, 4),
  period_start   date not null,
  period_end     date not null,
  source         text not null check (source in ('csv', 'manual')),
  csv_import_id  uuid references public.csv_imports(id) on delete set null,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (period_end >= period_start)
);
-- 같은 영상·지표·기간이 다시 올라오면 덮어쓰기(upsert) 위한 키. 채널 단위(video_id NULL)도 하나로 취급
create unique index manual_metrics_upsert_key
  on public.manual_metrics (user_id, coalesce(video_id, '00000000-0000-0000-0000-000000000000'::uuid),
                            metric_key, period_start, period_end);

-- 동기화 이력
create table public.sync_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_type       text not null
                 check (job_type in ('initial_backfill', 'daily', 'manual_refresh', 'retention')),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  rows_written   integer not null default 0,
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- =====================================================================
-- 2. 학습 (유튜브 학습 · 비즈니스PT 통합, 분류 없음)
-- =====================================================================

create table public.lectures (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  taken_on    date,
  topic       text,
  summary     text,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.insights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lecture_id   uuid references public.lectures(id) on delete set null,
  content      text not null,
  action_idea  text,
  tags         text[] not null default '{}',
  impact_note  text,                            -- 실제 영상 성과에 미친 영향 기록
  status       text not null default 'new' check (status in ('new', 'applied', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =====================================================================
-- 3. 목표 (제작·실험보다 먼저 만든다: 작업이 목표를 참조)
-- =====================================================================

create table public.goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title             text not null,               -- 예: 대형 살림 유튜브 채널에 출연
  description       text,
  success_criteria  text,                        -- 예: 구독자 10만 이상 채널 1곳 출연
  target_date       date,
  status            text not null default 'active'
                    check (status in ('active', 'achieved', 'paused', 'dropped')),
  metric_key        text references public.metric_definitions(metric_key),  -- 숫자 목표 연결(선택)
  target_value      numeric(16, 2),
  achieved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((metric_key is null) = (target_value is null))
);

create table public.goal_milestones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id       uuid not null references public.goals(id) on delete cascade,
  title         text not null,
  due_date      date,
  completed_at  timestamptz,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 목표별 메모 타임라인
create table public.goal_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id     uuid not null references public.goals(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =====================================================================
-- 4. 제작
-- =====================================================================

create table public.routine_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  weekday     smallint not null check (weekday between 0 and 6),   -- 0 = 일요일
  stage       text check (stage in ('idea', 'plan', 'script', 'shoot', 'edit', 'upload')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.video_projects (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title               text not null,
  content_type        text not null default 'long' check (content_type in ('short', 'long')),
  goal_id             uuid references public.goals(id) on delete set null,
  stage               text not null default 'idea'
                      check (stage in ('idea', 'plan', 'script', 'shoot', 'edit', 'upload')),
  target_upload_date  date,
  video_id            uuid references public.videos(id) on delete set null,   -- 업로드 후 연결
  week_start          date check (week_start is null or extract(dow from week_start) = 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id            uuid references public.video_projects(id) on delete cascade,
  goal_milestone_id     uuid references public.goal_milestones(id) on delete set null,
  routine_template_id   uuid references public.routine_templates(id) on delete set null,
  title                 text not null,
  stage                 text check (stage in ('idea', 'plan', 'script', 'shoot', 'edit', 'upload')),
  due_date              date,
  completed_at          timestamptz,
  week_start            date not null check (extract(dow from week_start) = 0),
  carried_from_task_id  uuid references public.tasks(id) on delete set null,   -- 이월 원본
  estimated_minutes     integer check (estimated_minutes is null or estimated_minutes > 0),  -- 예상 소요 시간
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- 같은 반복 작업이 한 주에 두 번 생기지 않게 한다 (일반 작업은 template이 NULL이라 해당 없음)
  unique (user_id, routine_template_id, week_start)
);

-- 작업 시간 기록 (타이머 또는 직접 입력)
create table public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id     uuid references public.tasks(id) on delete set null,
  project_id  uuid references public.video_projects(id) on delete set null,
  stage       text not null
              check (stage in ('idea', 'plan', 'script', 'shoot', 'edit', 'upload', 'routine', 'other')),
  source      text not null check (source in ('timer', 'manual')),
  started_at  timestamptz,
  ended_at    timestamptz,
  minutes     integer check (minutes is null or minutes between 1 and 1440),
  entry_date  date not null default current_date,
  week_start  date not null check (extract(dow from week_start) = 0),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- 직접 입력은 분이 필수. 타이머는 시작 시각이 필수이고, 끝나면 분이 채워진다(진행 중이면 둘 다 비어 있음)
  check (source <> 'manual' or minutes is not null),
  check (source <> 'timer' or (started_at is not null and (ended_at is null) = (minutes is null))),
  check (ended_at is null or started_at is null or ended_at > started_at),
  check (entry_date >= week_start and entry_date < week_start + 7)
);
-- 진행 중인 타이머는 사용자당 하나만
create unique index time_entries_one_running_timer
  on public.time_entries (user_id)
  where source = 'timer' and ended_at is null;

create table public.weekly_reviews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start       date not null check (extract(dow from week_start) = 0),
  completion_rate  numeric(5, 2) check (completion_rate is null or completion_rate between 0 and 100),
  went_well        text,
  to_improve       text,
  next_focus       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, week_start)
);

-- =====================================================================
-- 5. 실험 · AI
-- =====================================================================

create table public.experiments (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hypothesis                  text not null,
  insight_id                  uuid references public.insights(id) on delete set null,
  video_id                    uuid references public.videos(id) on delete set null,
  goal_id                     uuid references public.goals(id) on delete set null,
  action_detail               text,
  metric_key                  text references public.metric_definitions(metric_key),
  baseline_period_start       date,
  baseline_period_end         date,
  compare_days_since_publish  integer check (compare_days_since_publish is null or compare_days_since_publish > 0),
  before_value                numeric(16, 4),
  after_value                 numeric(16, 4),
  verdict                     text not null default 'planned'
                              check (verdict in ('planned', 'running', 'success', 'fail', 'pending')),
  verdict_reason              text,
  next_experiment_id          uuid references public.experiments(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  check (baseline_period_end is null or baseline_period_start is null or baseline_period_end >= baseline_period_start)
);

create table public.ai_analyses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope               text not null check (scope in ('channel', 'video', 'experiment', 'weekly')),
  target_id           uuid,                     -- scope에 따라 videos · experiments 등의 id
  period_start        date,
  period_end          date,
  input_metrics_json  jsonb not null,           -- 분석에 사용한 실제 지표 스냅샷 (샘플 제외)
  output_json         jsonb not null,           -- 관찰 · 가설 · 제안 · 근거 지표 · 신뢰도
  model               text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.priorities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title           text not null,
  origin          text not null default 'user' check (origin in ('user', 'ai')),
  ai_analysis_id  uuid references public.ai_analyses(id) on delete set null,
  rank            smallint not null check (rank between 1 and 3),
  done            boolean not null default false,
  week_start      date not null check (extract(dow from week_start) = 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (origin = 'user' or ai_analysis_id is not null)
);

-- =====================================================================
-- 6. 수익 (건별 기록)
-- =====================================================================

create table public.revenue_entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform          text not null
                    check (platform in ('coupang_partners', 'naver_brand_connect', 'ohou_curator')),
  entry_date        date not null,
  settlement_month  date check (settlement_month is null or extract(day from settlement_month) = 1),  -- 매월 1일로 저장
  amount_krw        integer not null,
  status            text not null default 'expected' check (status in ('expected', 'confirmed', 'paid')),
  video_id          uuid references public.videos(id) on delete set null,
  tracking_code     text,                       -- 링크에 붙인 영상별 추적 값 (영상 ID 규칙)
  order_ref         text,                       -- 플랫폼 주문·건 식별자 (중복 업로드 방지)
  source            text not null check (source in ('csv', 'manual')),
  csv_import_id     uuid references public.csv_imports(id) on delete set null,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index revenue_entries_dedupe
  on public.revenue_entries (user_id, platform, order_ref)
  where order_ref is not null;

-- =====================================================================
-- 7. 연결 테이블
-- =====================================================================

-- 인사이트 ↔ 영상 · 제작 프로젝트 (둘 중 하나 이상)
create table public.insight_videos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  insight_id  uuid not null references public.insights(id) on delete cascade,
  video_id    uuid references public.videos(id) on delete cascade,
  project_id  uuid references public.video_projects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (video_id is not null or project_id is not null)
);

-- =====================================================================
-- 인덱스
-- =====================================================================

create index videos_user_published_idx       on public.videos (user_id, published_at desc);
create index videos_user_type_idx            on public.videos (user_id, content_type);
create index channel_daily_user_date_idx     on public.channel_daily_metrics (user_id, date desc);
create index video_daily_user_date_idx       on public.video_daily_metrics (user_id, date desc);
create index video_daily_days_idx            on public.video_daily_metrics (video_id, days_since_publish);
create index manual_metrics_video_idx        on public.manual_metrics (video_id, metric_key);
create index sync_logs_user_started_idx      on public.sync_logs (user_id, started_at desc);
create index lectures_tags_idx               on public.lectures using gin (tags);
create index insights_tags_idx               on public.insights using gin (tags);
create index insights_lecture_idx            on public.insights (lecture_id);
create index goal_milestones_goal_idx        on public.goal_milestones (goal_id, sort_order);
create index goal_notes_goal_idx             on public.goal_notes (goal_id, created_at desc);
create index tasks_user_week_idx             on public.tasks (user_id, week_start);
create index tasks_project_idx               on public.tasks (project_id);
create index video_projects_user_stage_idx   on public.video_projects (user_id, stage);
create index experiments_user_verdict_idx    on public.experiments (user_id, verdict);
create index ai_analyses_target_idx          on public.ai_analyses (scope, target_id, created_at desc);
create index priorities_user_week_idx        on public.priorities (user_id, week_start, rank);
create index time_entries_user_week_idx      on public.time_entries (user_id, week_start, stage);
create index time_entries_project_idx        on public.time_entries (project_id);
create index revenue_user_date_idx          on public.revenue_entries (user_id, entry_date desc);
create index revenue_tracking_idx            on public.revenue_entries (user_id, tracking_code);
create index insight_videos_insight_idx      on public.insight_videos (insight_id);

-- 강의·인사이트 키워드 검색 (한글은 simple 사전 + pg_trgm 조합을 3단계에서 검토)
create index lectures_search_idx on public.lectures
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(topic, '') || ' ' || coalesce(summary, '')));
create index insights_search_idx on public.insights
  using gin (to_tsvector('simple', coalesce(content, '') || ' ' || coalesce(action_idea, '')));

-- =====================================================================
-- updated_at 트리거 · RLS (user_id를 가진 모든 테이블에 일괄 적용)
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'youtube_connections', 'csv_imports', 'videos', 'channel_daily_metrics', 'video_daily_metrics',
    'video_retention', 'manual_metrics', 'sync_logs', 'lectures', 'insights', 'goals',
    'goal_milestones', 'goal_notes', 'routine_templates', 'video_projects', 'tasks', 'time_entries',
    'weekly_reviews', 'experiments', 'ai_analyses', 'priorities', 'revenue_entries', 'insight_videos'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner_all', t);
  end loop;
end;
$$;

create trigger metric_definitions_set_updated_at
  before update on public.metric_definitions
  for each row execute function public.set_updated_at();

-- 지표 정의: 로그인 사용자는 읽기만
alter table public.metric_definitions enable row level security;
create policy metric_definitions_read on public.metric_definitions
  for select to authenticated using (true);

-- 토큰 보호: 브라우저 역할은 갱신 토큰 컬럼을 읽거나 쓸 수 없다. 토큰 저장은 서버(service_role)만.
revoke all on public.youtube_connections from anon, authenticated;
grant select (id, user_id, channel_id, channel_title, scopes, status, last_synced_at, last_error, created_at, updated_at)
  on public.youtube_connections to authenticated;
grant delete on public.youtube_connections to authenticated;   -- 설정 화면의 "연결 해제"

-- 동기화 이력은 서버만 쓴다. 브라우저는 읽기만
revoke insert, update, delete on public.sync_logs from anon, authenticated;
grant select on public.sync_logs to authenticated;

-- =====================================================================
-- 편의 뷰: 쇼츠·일반 분리 비교와 홈 카드
-- (security_invoker로 호출자의 RLS를 그대로 적용)
-- =====================================================================

-- 영상별 업로드 후 N일 누적 지표 (7 · 28일)
create view public.video_cumulative_metrics
with (security_invoker = true) as
select
  v.id                as video_id,
  v.user_id,
  v.title,
  v.content_type,
  v.published_at,
  v.is_sample,
  sum(m.views)              filter (where m.days_since_publish < 7)  as views_7d,
  sum(m.watch_time_minutes) filter (where m.days_since_publish < 7)  as watch_minutes_7d,
  sum(m.views)              filter (where m.days_since_publish < 28) as views_28d,
  sum(m.watch_time_minutes) filter (where m.days_since_publish < 28) as watch_minutes_28d,
  max(m.days_since_publish) + 1                                     as days_observed
from public.videos v
left join public.video_daily_metrics m on m.video_id = v.id
group by v.id;

-- 주별 · 단계별 투여 시간과 지난주 대비 증감 (끝난 기록만)
create view public.weekly_time_by_stage
with (security_invoker = true) as
with weekly as (
  select user_id, week_start, stage, sum(minutes) as minutes
  from public.time_entries
  where minutes is not null
  group by user_id, week_start, stage
),
weeks as (select distinct user_id, week_start from weekly),
stages as (select unnest(array['idea', 'plan', 'script', 'shoot', 'edit', 'upload', 'routine', 'other']) as stage),
grid as (
  select w.user_id, w.week_start, s.stage from weeks w cross join stages s
  union
  select w.user_id, w.week_start + 7, s.stage from weeks w cross join stages s
)
select
  g.user_id,
  g.week_start,
  g.stage,
  coalesce(cur.minutes, 0)                          as minutes,
  coalesce(prev.minutes, 0)                         as prev_week_minutes,
  coalesce(cur.minutes, 0) - coalesce(prev.minutes, 0) as delta_minutes
from grid g
left join weekly cur  on cur.user_id = g.user_id  and cur.week_start = g.week_start      and cur.stage = g.stage
left join weekly prev on prev.user_id = g.user_id and prev.week_start = g.week_start - 7 and prev.stage = g.stage
where coalesce(cur.minutes, prev.minutes) is not null;

-- 주별 · 콘텐츠 유형별 "1편당 평균 제작 시간"
-- 정의: 그 주(일요일 시작)에 업로드된 영상 프로젝트들의 총 제작 시간(모든 주에 걸친 기록 합) ÷ 편수.
--       아직 끝나지 않은 영상이 섞여 평균이 흔들리지 않도록 업로드 완료 기준으로 센다. 반복 작업 시간은 제외.
create view public.weekly_time_per_video
with (security_invoker = true) as
with project_totals as (
  select vp.id as project_id, vp.user_id, vp.content_type,
         (date_trunc('week', (v.published_at at time zone 'Asia/Seoul')::date + 1) - interval '1 day')::date as upload_week_start,
         sum(te.minutes) as minutes
  from public.video_projects vp
  join public.videos v on v.id = vp.video_id
  join public.time_entries te on te.project_id = vp.id and te.minutes is not null
  where v.published_at is not null
  group by vp.id, vp.user_id, vp.content_type, v.published_at
),
per_week as (
  select user_id, upload_week_start as week_start, content_type,
         sum(minutes)     as minutes,
         count(*)         as video_count
  from project_totals
  group by user_id, upload_week_start, content_type
)
select
  cur.user_id,
  cur.week_start,
  cur.content_type,
  cur.minutes,
  cur.video_count,
  round(cur.minutes::numeric / cur.video_count, 1)   as minutes_per_video,
  round(prev.minutes::numeric / prev.video_count, 1) as prev_week_minutes_per_video,
  case when prev.minutes is null then null
       else round(100.0 * ((cur.minutes::numeric / cur.video_count) / (prev.minutes::numeric / prev.video_count) - 1), 1)
  end                                                 as change_pct
from per_week cur
left join per_week prev
  on prev.user_id = cur.user_id and prev.content_type = cur.content_type and prev.week_start = cur.week_start - 7;

-- 월별 · 플랫폼별 수익 합계 (예상 · 확정 분리)
create view public.revenue_monthly
with (security_invoker = true) as
select
  user_id,
  date_trunc('month', entry_date)::date as month,
  platform,
  sum(amount_krw) filter (where status = 'expected')            as expected_krw,
  sum(amount_krw) filter (where status in ('confirmed', 'paid')) as confirmed_krw,
  count(*)                                                       as entry_count
from public.revenue_entries
group by user_id, date_trunc('month', entry_date), platform;

-- 목표 진행률 (숫자 목표가 없으면 마일스톤 완료 비율)
create view public.goal_progress
with (security_invoker = true) as
select
  g.id as goal_id,
  g.user_id,
  g.title,
  g.target_date,
  g.status,
  count(ms.id)                                  as milestone_count,
  count(ms.id) filter (where ms.completed_at is not null) as milestone_done,
  case when count(ms.id) = 0 then null
       else round(100.0 * count(ms.id) filter (where ms.completed_at is not null) / count(ms.id), 1)
  end as milestone_progress_pct,
  (g.target_date - current_date)                as days_left
from public.goals g
left join public.goal_milestones ms on ms.goal_id = g.id
group by g.id;

-- =====================================================================
-- 시드: 지표 정의
-- =====================================================================

insert into public.metric_definitions (metric_key, label_ko, description, unit, api_available, api_name) values
  ('views',                  '조회수',            '선택 기간 동안 영상이 조회된 횟수',                                   'count',   true,  'views'),
  ('engaged_views',          '참여 조회수',        '첫 프레임을 넘겨 시청했거나 직접 재생한 조회',                          'count',   true,  'engagedViews'),
  ('watch_time_minutes',     '시청 시간',          '선택 기간 동안 시청된 총 시간(분)',                                   'minutes', true,  'estimatedMinutesWatched'),
  ('avg_view_duration_sec',  '평균 시청 시간',      '재생 1회당 평균 시청 시간(초)',                                       'seconds', true,  'averageViewDuration'),
  ('avg_view_percentage',    '평균 시청 비율',      '재생 1회당 영상 길이 대비 평균 시청 비율(%)',                          'percent', true,  'averageViewPercentage'),
  ('subscribers_gained',     '구독자 증가',        '구독한 횟수. 영상 단위 조회 시 해당 영상 시청 페이지에서 발생한 것만 포함',   'count',   true,  'subscribersGained'),
  ('subscribers_lost',       '구독자 감소',        '구독 취소 횟수. 영상 단위 조회 시 해당 영상 시청 페이지에서 발생한 것만 포함', 'count',   true,  'subscribersLost'),
  ('likes',                  '좋아요',            '좋아요 수',                                                          'count',   true,  'likes'),
  ('comments',               '댓글',              '댓글 수',                                                            'count',   true,  'comments'),
  ('shares',                 '공유',              '공유 버튼으로 공유한 횟수',                                            'count',   true,  'shares'),
  ('audience_watch_ratio',   '시청 지속 비율',      '영상의 특정 지점을 본 비율(되감기 시 1을 넘을 수 있음)',                   'ratio',   true,  'audienceWatchRatio'),
  ('relative_retention',     '상대 시청 지속',      '비슷한 길이의 영상 대비 시청 유지 수준(0~1, 0.5가 중간)',                  'ratio',   true,  'relativeRetentionPerformance'),
  ('impressions',            '노출수',            '썸네일이 시청자에게 표시된 횟수. API 제공 여부 확인 전까지 CSV로 관리',         'count',   false, null),
  ('impressions_ctr',        '노출 클릭률',        '노출 중 시청으로 이어진 비율(%). API 제공 여부 확인 전까지 CSV로 관리',       'percent', false, null),
  ('subscriber_count',       '총 구독자 수',       '특정 시점의 채널 구독자 수. 목표 진행률 계산용',                           'count',   true,  null),
  ('monthly_revenue_krw',    '월 제휴 수익',        '쿠팡 파트너스 · 네이버 브랜드커넥트 · 오늘의집 큐레이터 확정 수익 합계(원)',   'krw',     false, null);
