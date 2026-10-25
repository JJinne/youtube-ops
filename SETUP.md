# 무료 플랜 설정 안내

모두 무료 플랜으로 진행합니다. 결제 정보를 넣으라는 화면이 나오면 건너뛰세요. 걸리는 시간은 30~40분 정도입니다.
각 서비스의 메뉴 이름은 업데이트로 조금 바뀔 수 있습니다.

| 순서 | 할 일 | 서비스 |
| --- | --- | --- |
| 1 | DB 만들기와 표 만들기 | Supabase (Free) |
| 2 | 코드 올리기 | GitHub (Free) |
| 3 | 배포하기 | Vercel (Hobby) |
| 4 | 로그인 설정 마무리 | Supabase |
| 5 | 첫 로그인과 연결 점검 | 앱 |

---

## 1. Supabase: DB 만들기

1. <https://supabase.com> 에 가입합니다. GitHub 계정으로 가입하면 2단계가 편합니다.
2. **New project**를 누르고 다음처럼 정합니다.
   - Name: `youtube-ops` (아무 이름)
   - Database Password: 자동 생성된 값을 비밀번호 관리 앱 등에 보관 (앱에는 넣지 않습니다)
   - Region: **Northeast Asia (Seoul)**
   - Plan: **Free**
3. 프로젝트가 준비되면 왼쪽 **SQL Editor** → **New query**를 엽니다.
4. 이 프로젝트의 `supabase/migrations/20261025000000_init_schema.sql` 파일 내용을 전부 붙여 넣고 **Run**을 누릅니다.
   - "Success. No rows returned"가 나오면 됩니다.
   - 한 번만 실행하세요. 두 번 실행하면 "already exists" 오류가 납니다 (이미 만들어졌다는 뜻이라 문제는 없습니다).
5. 왼쪽 **Project Settings** → **API Keys**(또는 **Data API**)에서 두 값을 메모합니다.
   - **Project URL**: `https://xxxx.supabase.co`
   - **Publishable key** (`sb_publishable_…`). 예전 화면에서는 **anon public** 키입니다.
   - `service_role` / `secret` 키는 지금 필요 없습니다. 어디에도 붙여 넣지 마세요.

## 2. GitHub: 코드 올리기

1. <https://github.com> 에서 **New repository** → 이름 `youtube-ops`, **Private** 선택 → 만들기.
2. 받은 `youtube-ops-stage4a.zip`의 압축을 풀고, 저장소 화면의 **uploading an existing file**을 눌러 폴더 안의 파일을 모두 끌어다 놓은 뒤 **Commit changes**.
   - `node_modules`, `.next` 폴더는 zip에 없습니다. 그대로 올리면 됩니다.
   - 원하면 저장소 접근 권한을 이 대화에 연결해 주세요. 제가 직접 올리고 이후 단계도 바로 반영할 수 있습니다.

## 3. Vercel: 배포하기

1. <https://vercel.com> 에 **GitHub로 가입**합니다. 플랜은 **Hobby**.
2. **Add New → Project** → `youtube-ops` 저장소 **Import**.
3. **Environment Variables**에 세 개를 넣습니다.

   | 이름 | 값 |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | 1-5의 Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 1-5의 Publishable key |
   | `ALLOWED_EMAILS` | 로그인할 본인 이메일 (Supabase 가입 이메일과 같게) |

4. **Deploy**. 1~2분 뒤 `https://youtube-ops-xxxx.vercel.app` 같은 주소가 생깁니다. 이 주소를 메모합니다.

> Vercel Hobby는 비상업적 개인 용도 조건이 있습니다. 이 앱은 본인만 쓰는 관리 도구라 Hobby로 시작하고, 조건이 걱정되면 그때 Pro로 바꾸면 됩니다 (코드는 그대로).

## 4. Supabase: 로그인 설정 마무리

1. Supabase 왼쪽 **Authentication** → **URL Configuration**
   - **Site URL**: 3-4의 Vercel 주소
   - **Redirect URLs**에 추가: `https://(Vercel 주소)/auth/callback`
2. **Authentication → Sign In / Providers**에서 **Email**이 켜져 있는지 확인합니다 (기본값 켜짐).

무료 기본 메일은 **Supabase 프로젝트 팀원 주소로만, 시간당 2통까지** 보냅니다. 가입한 본인 이메일은 팀원이라 받을 수 있습니다.

## 5. 첫 로그인과 연결 점검

1. Vercel 주소로 들어가면 로그인 화면이 나옵니다. 본인 이메일을 넣고 **로그인 링크 받기**.
2. 메일의 링크를 **같은 브라우저**에서 엽니다. 홈 화면으로 들어가면 성공입니다.
3. **설정 → 기록 저장소 → 연결 점검**을 누릅니다. 모든 줄이 "정상"이면 끝입니다.
4. 첫 로그인을 마쳤으면 Supabase **Authentication → Sign In / Providers**에서 **Allow new users to sign up**을 끕니다. 다른 사람이 계정을 만드는 것을 막습니다.

### 문제가 생기면

| 증상 | 확인할 것 |
| --- | --- |
| 로그인 화면이 안 나오고 "샘플 데이터 화면" 띠가 보임 | Vercel 환경 변수 3개를 넣은 뒤 **Redeploy** 했는지 |
| "이 이메일은 로그인이 허용되지 않았습니다" | `ALLOWED_EMAILS` 값과 로그인한 이메일이 같은지 |
| "메일을 너무 자주 요청했습니다" | 무료 메일은 시간당 2통. 1시간 뒤 다시 |
| 링크를 눌렀는데 로그인 화면으로 돌아옴 | 4-1의 Redirect URLs, 링크를 같은 브라우저에서 열었는지 |
| 연결 점검에서 "DB 테이블" 문제 | 1-4의 SQL을 실행했는지 |

## 무료 플랜에서 알아 둘 점

- **Supabase 일시 정지:** 무료 프로젝트는 일주일 동안 DB 활동이 없으면 일시 정지됩니다. 앱을 주 1회 이상 열면 됩니다. 정지돼도 데이터는 남고 대시보드에서 다시 켤 수 있습니다. 5단계의 매일 자동 동기화가 붙으면 이 걱정은 없어집니다.
- **백업 없음:** 무료 플랜에는 자동 백업이 없습니다. 중요한 기록이 쌓이면 Supabase **Table Editor**에서 표별로 CSV 내보내기를 가끔 해 두세요 (앱 안 내보내기 버튼은 이후 단계에서 연결).
- **AI 분석 (6단계):** Claude API는 무료 구간이 없어 쓴 만큼 냅니다. 기본 모델을 가장 저렴한 Haiku로 두어 1회 수 원 수준으로 맞출 예정입니다.
