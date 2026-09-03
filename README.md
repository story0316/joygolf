# JoyGolf 🏌️‍♂️⛳

회사 골프 동호회를 위한 "재미있는 성장형" 웹앱입니다. 번들러 없이 순수 HTML/CSS/JS로 만들어져 있고,
백엔드는 [Supabase](https://supabase.com)(인증 + DB + 파일 스토리지)를 사용합니다.

## ✨ 주요 기능

- **연습 인증**: 연습장 방문 시 연습공 개수 + 인증샷 등록
- **스코어 인증**: 골프존/필드 스코어카드 사진 + 스코어·퍼팅·페어웨이·GIR 기록
- **육각형 역량 차트**: 정확도 / 그린적중 / 퍼팅 / 스코어 / 성장 / 꾸준함 6축 레이더 차트 (공개 회원들과 상대 비교)
- **레벨 & 배지 시스템**: 인증 누적으로 포인트가 쌓이고 레벨업, 연속 연습일 스트릭, 배지 획득
- **공개/비공개 설정**: 기록 상세 공개 범위와 "이달의 상 닉네임 노출 동의"를 별도로 설정 가능
- **이달의 상**: 연습왕(연습공 수) / 꾸준상(연습 일수) / 스코어 향상상(전월 대비 개선폭) — 비공개 회원도 익명으로 집계에 포함
- **모임(약속) 만들기**: 라운딩/연습 모임 생성 + 참가(✋)/미정(🤔)/불참(✖) RSVP
- **후기 게시판**: 사진 첨부 후기, 좋아요, 댓글
- **운영진 승인 페이지**: 미검증 연습/스코어 인증을 사진과 함께 검토해 승인/반려, 이상치(과도한 연습공 수·비정상 스코어) 자동 플래깅
- **가입 이메일 도메인 제한**: DB 트리거로 서버단에서 강제 (프론트엔드 체크만으로는 API 직접 호출을 막을 수 없기 때문)
- **다크/라이트 테마**: 시스템 설정을 따르고, 상단바 버튼으로 수동 전환 (선택은 브라우저에 저장)
- **PWA**: 홈 화면에 설치해서 앱처럼 사용, 오프라인에서도 이미 본 화면은 열림
- **웹 푸시 알림**: 모임 하루 전 리마인더 등을 기기 알림으로 수신 (기기별로 켜고 끔)

## 🎨 디자인

글래스모피즘 + 오로라 그라디언트 배경을 기반으로 한 자체 디자인 시스템입니다. 프레임워크 없이 `css/style.css` 한 파일에 토큰(색/반경/그림자/이징)과 컴포넌트가 모두 정의돼 있습니다.

- **듀얼 테마**: `prefers-color-scheme` 자동 + `data-theme` 수동 오버라이드. 저장된 테마는 각 페이지 `<head>`의 인라인 스크립트가 페인트 전에 반영해 깜빡임(FOUC)이 없습니다.
- **레이아웃**: 대시보드는 벤토 그리드, 데스크톱은 떠 있는 유리 상단바 / 모바일은 하단 탭 독으로 전환
- **모션**: 카드 진입 시 순차 페이드업, 스프링 이징 호버, 레벨 게이지 shimmer — `prefers-reduced-motion`을 존중해 자동으로 비활성화
- **타이포**: Pretendard Variable (CDN), 한글 가독성을 위한 tight tracking
- 육각형 레이더 차트는 테마 전환 시 색상을 다시 계산해 그려집니다.

## 🗂 구조

```
index.html        로그인/회원가입
dashboard.html     대시보드 (레벨, 육각형, 배지, 최근활동, 다가오는 모임)
practice.html      연습 인증
score.html         스코어 인증
meetup.html        모임 만들기 / RSVP
board.html         후기 게시판
ranking.html       이달의 상
profile.html       프로필 & 공개 설정
admin.html         운영진 승인 대기열 (is_admin 회원만 접근)
offline.html       오프라인 안내 화면
manifest.webmanifest  PWA 매니페스트 (설치 이름/아이콘/바로가기)
sw.js              서비스워커 (앱 셸 캐시 + 푸시 수신)
icons/             앱 아이콘 (icon.svg 가 원본, PNG 는 여기서 렌더)
css/style.css      디자인 시스템 (테마 토큰 + 컴포넌트)
js/config.js        Supabase 프로젝트 설정 (직접 채워야 함)
js/theme.js         라이트/다크 테마 관리
js/supabaseClient.js Supabase 클라이언트 + 공통 유틸
js/nav.js           공통 네비게이션 (상단바 + 모바일 독)
js/pwa.js           서비스워커 등록 / 설치·업데이트 안내
js/push.js          웹 푸시 구독 관리
js/*.js             페이지별 로직
sql/schema.sql       Supabase DB 스키마 (테이블/RLS/이달의상 함수)
supabase/functions/send-push/  푸시 발송 Edge Function (Deno)
```

빌드 도구가 없으므로 `npm install` 없이 그대로 정적 호스팅(Vercel/Netlify/GitHub Pages/사내 웹서버 등)에 올리면 됩니다.

## 🚀 시작하기

### 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 에서 새 프로젝트를 만듭니다.
2. **SQL Editor**에서 `sql/schema.sql` 파일 내용 전체를 실행합니다. (테이블, RLS 정책, 이달의 상 함수, 스토리지 버킷까지 한 번에 생성됩니다)
3. **Authentication > Providers**에서 Email 로그인이 켜져 있는지 확인합니다.
   - 사내용으로 빠르게 테스트하려면 **Authentication > Settings**에서 "Confirm email"을 꺼두면 가입 즉시 로그인됩니다. (운영 시엔 켜두는 것을 권장)
4. **Project Settings > API**에서 `Project URL`과 `anon public` 키를 복사합니다.

### 2. 설정 파일 채우기

`js/config.js` 를 열어 아래 값을 본인 프로젝트 값으로 교체하세요.

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
  ALLOWED_EMAIL_DOMAIN: "yourcompany.com", // 사내 이메일만 가입 허용하려면 설정, 아니면 ""
  ...
};
```

> `anon` 키는 클라이언트에 노출되는 것이 정상입니다(Supabase의 공개 키). 실제 접근 제어는 `sql/schema.sql`의 RLS 정책이 담당합니다.

### 3. 로컬 실행 (빌드 불필요)

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

### 4. 첫 운영진(관리자) 지정

가입 후 Supabase **SQL Editor**에서 아래 쿼리로 본인 계정을 관리자로 지정하세요. (이메일은 본인이 가입한 주소로 변경)

```sql
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'admin@yourcompany.com');
```

관리자로 지정된 계정에는 상단 메뉴에 **🛡️ 운영진** 링크가 나타나고, `admin.html`에서 미검증 인증을 승인/반려할 수 있습니다.
`is_admin`은 API로는 셀프 승격이 불가능하도록 DB 트리거(`protect_is_admin`)로 막혀 있어, 최초 지정은 반드시 SQL Editor에서 해야 합니다.

### 5. 가입 이메일 도메인 제한 (선택)

`js/config.js`의 `ALLOWED_EMAIL_DOMAIN`은 가입 폼에서 즉시 안내 문구를 보여주기 위한 프론트엔드 체크일 뿐이라, API를 직접 호출하면 우회될 수 있습니다.
실제로 막으려면 SQL Editor에서 아래처럼 서버단 설정값을 채우세요 — `sql/schema.sql`에 포함된 `enforce_email_domain` 트리거가 가입 시점에 이 값으로 검증합니다.

```sql
update public.app_settings set value = 'yourcompany.com' where key = 'allowed_email_domain';
```

빈 문자열(`''`, 기본값)이면 제한 없이 모든 이메일로 가입할 수 있습니다.

### 6. 푸시 알림 설정 (선택)

푸시는 브라우저가 아니라 **서버가 VAPID 개인키로 서명해서** 보내야 하므로, 정적 파일만으로는 완결되지 않습니다.
발송 서버 역할은 `supabase/functions/send-push` Edge Function이 담당합니다.

**1) VAPID 키 쌍 생성** (로컬에서 한 번만)

```bash
npx web-push generate-vapid-keys
```

**2) 공개키는 프론트에, 개인키는 서버 시크릿으로**

```js
// js/config.js — 공개키만! 개인키는 절대 넣지 마세요
VAPID_PUBLIC_KEY: "BEl...공개키..."
```

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="BEl...공개키..." \
  VAPID_PRIVATE_KEY="...개인키..." \
  VAPID_SUBJECT="mailto:admin@yourcompany.com" \
  PUSH_CRON_SECRET="$(openssl rand -hex 32)"

supabase functions deploy send-push
```

**3) 모임 리마인더 자동 발송** — Supabase SQL Editor에서 `pg_cron` + `pg_net`으로 매시간 호출

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('joygolf-meetup-reminder', '0 * * * *', $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-push-secret', 'PUSH_CRON_SECRET에 넣은 값'
               ),
    body    := '{"kind":"meetup_reminder"}'::jsonb
  );
$$);
```

이 함수는 **24~25시간 뒤에 시작하는 모임**의 참가(`going`) 인원에게 리마인더를 보내고, 만료된 구독(410/404)은 자동으로 정리합니다.
임의 공지를 보내려면 `{"kind":"custom","title":"...","body":"...","url":"ranking.html"}` 형태로 호출하세요 (`user_ids`를 주면 해당 회원에게만).

> 회원은 **프로필 > 알림 설정**에서 기기별로 알림을 켜고 끕니다. iPhone은 Safari에서 "홈 화면에 추가"로 설치한 뒤에야 알림을 켤 수 있습니다(iOS 16.4+).

### 7. 배포

정적 파일 그대로 Vercel / Netlify / GitHub Pages 등에 올리면 됩니다. 별도 빌드 커맨드가 필요 없습니다 (Output Directory: 프로젝트 루트).

> PWA(설치·오프라인·푸시)는 **HTTPS에서만** 동작합니다. 위 호스팅들은 기본적으로 HTTPS라 그대로 사용하면 되고, 로컬 테스트는 `localhost`가 예외로 허용됩니다.
> 앱을 새로 배포하면 서비스워커가 변경을 감지해 "새 버전이 있어요" 칩을 띄웁니다. 캐시 구성을 바꿨다면 `sw.js`의 `VERSION` 값을 올려주세요.

## 🔒 공개/비공개 설계 메모

- `profiles.profile_visibility`: 육각형 차트·개인 인증 내역 등 **상세 기록**의 공개 범위 (`public`/`private`)
- `profiles.award_visible`: **이달의 상** 발표 시 닉네임 노출 동의 여부 (상세 기록 공개 여부와 무관하게 독립 설정)
- 랭킹/이달의 상 집계(`get_monthly_awards` 함수)는 비공개 회원의 데이터도 통계에는 포함하되, 이름은 `award_visible`이 꺼져 있으면 "이름 없는 회원"으로 익명 처리합니다.
- 육각형 차트의 상대 비교는 `security_invoker` 뷰(`user_radar_raw`, `user_practice_raw`)를 통해 RLS를 그대로 적용받으므로, 비공개 회원의 원자료는 다른 회원의 화면에 노출되지 않습니다.

## ⚠️ 알려진 제약 / TODO

- 이 세션 환경에서는 npm 레지스트리 접근이 막혀 있어 로컬에서 실제 Supabase 프로젝트에 연결한 통합 테스트(회원가입/로그인/DB 연동)를 진행하지 못했습니다. Supabase 프로젝트를 연결한 뒤 직접 가입 → 인증 등록 → 운영진 승인 → 랭킹 확인 흐름을 한 번 확인해주세요.
- `enforce_email_domain` 트리거는 `auth.users` 테이블에 `BEFORE INSERT` 트리거를 생성합니다. 대부분의 Supabase 프로젝트에서 SQL Editor로 정상 생성되지만, 만약 권한 오류가 나면 대신 Supabase 대시보드의 **Authentication > Hooks** 기능으로 동일한 검증 함수를 연결하세요.
- 반려(운영진 승인 페이지의 "✖ 반려")는 현재 기록을 바로 삭제합니다. 반려 사유를 남기고 싶다면 `practice_logs`/`score_logs`에 `rejected_reason` 컬럼을 추가하는 방식으로 확장할 수 있습니다.
- `supabase/functions/send-push`는 **작성만 되어 있고 실제 배포·발송 테스트는 하지 못했습니다.** (이 개발 환경에서 npm 레지스트리와 Supabase 접근이 차단되어 있음) 배포 후 아래로 한 번 확인해보세요:
  ```bash
  curl -X POST "https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-push" \
    -H "Content-Type: application/json" -H "x-push-secret: 설정한값" \
    -d '{"kind":"custom","title":"테스트","body":"푸시 연결 확인!"}'
  ```
- 서비스워커의 앱 셸 캐시 목록(`sw.js`의 `SHELL`)은 수동 관리입니다. 페이지나 스크립트를 추가하면 이 목록에도 넣어주세요.
