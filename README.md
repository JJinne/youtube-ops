# 채널 운영실

유튜브 채널 운영 · 강의 인사이트 · 주간 제작 루틴 · 실험 · 목표 · 제휴 수익을 한곳에서 관리하는 개인용 대시보드.

현재 단계: **4a 완료 (강의·인사이트·주간 루틴 저장)**. 무료 플랜(Supabase Free · Vercel Hobby)으로 동작합니다.
설정 순서는 [SETUP.md](./SETUP.md)를 보세요.

| 화면 | 데이터 |
| --- | --- |
| 강의·인사이트, 주간 제작 루틴(작업·시간 기록·회고), 반복 작업 | **저장됨** (로그인 시) |
| 홈 | 제작 현황·루틴·인사이트는 저장된 기록, 나머지 카드는 샘플 |
| 유튜브 분석 | 샘플 (5단계에서 YouTube 연결) |
| 실험·회고, 목표, 수익 | 샘플 (4b단계에서 저장 연결) |

## 동작 방식

- Supabase 환경 변수가 **없으면** 샘플 모드: 로그인 없이 열리고, 입력은 저장되지 않습니다.
- 환경 변수가 **있으면** 실제 모드: `ALLOWED_EMAILS`에 등록한 이메일만 로그인 링크로 들어올 수 있고, 기록은 Supabase에 저장됩니다.
- 모든 읽기·쓰기는 서버에서 로그인한 사용자 권한으로 하며, DB의 행 단위 보안(RLS)이 본인 기록만 허용합니다.
- 타이머는 DB에 "진행 중" 기록을 남기므로 PC에서 켜고 휴대폰에서 멈출 수 있습니다.

## 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev        # http://localhost:3000  (.env.local이 없으면 샘플 모드)
npm run build      # 배포용 빌드 (Vercel)
npm run typecheck
npm test           # 루틴 로직 단위 시험
```

## 구조

```
src/
  app/
    page.tsx              홈
    analytics/ insights/ routine/ experiments/ goals/ revenue/ settings/
    login/                이메일 로그인 링크
    auth/callback, signout
    actions/              서버 액션 (lectures, routine, system=연결 점검)
  components/             공통 UI (사이드바, 카드, 배지, 차트)
  proxy.ts                세션 갱신 · 로그인 확인 (Next.js 16의 middleware)
  lib/
    supabase/             설정, 서버·브라우저 클라이언트
    repo/                 화면별 데이터 읽기 (샘플/실제 전환)
    routine-logic.ts      반복 작업 생성 · 이월 · 타이머 계산 (단위 시험 있음)
    metrics.ts            화면의 모든 계산
    sample-data.ts        고정 시드 샘플 데이터 (기준일 2026-10-25)
supabase/migrations/      DB 스키마 (테이블 24개, 뷰 5개, RLS)
```

## 주요 계산 규칙

| 항목 | 규칙 |
| --- | --- |
| 주 | 일요일 시작, 한국 시간 기준 |
| 반복 작업 | 이번 주 화면을 열 때 요일에 맞춰 자동 생성 (중복 생성은 DB가 막음) |
| 이월 | 지난 날짜의 미완료 일반 작업을 다음 주 같은 요일로 복사, 원래 작업은 그 주 기록으로 남김 |
| 최근 성과 좋은 영상 | 최근 30일 업로드 중 업로드 후 7일 조회수 상위, 일반 영상과 쇼츠를 따로 |
| 영상 비교 | 같은 유형끼리, 업로드 후 같은 경과일 기준 |
| 진행 중인 주의 시간 비교 | 지난주도 같은 요일까지만 잘라서 비교 |
| 1편당 평균 제작 시간 | 그 주에 업로드한 영상들의 총 제작 시간(이전 주 작업 포함) ÷ 편수 |
| 진행 중인 실험 | 실험 영상이 목표 일수를 못 채웠으면 기준 영상도 같은 경과일로 잘라 임시 비교 |
| 수익 합계 | 확정·지급 완료만 합산, 예상은 별도 표시 |

## 다음 단계

- 4b: 실험·목표·수익 저장 (외부 설정 없음)
- 5단계: Google Cloud 프로젝트, YouTube Data API v3 · YouTube Analytics API, OAuth 클라이언트 (무료)
- 6단계: Claude API 키 (사용량 과금, 기본 모델 Haiku)
- 7단계: 마무리 점검 (배포는 4a에서 이미 Vercel Hobby로 시작)
