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
- **다크/라이트 테마**: 시스템 설정을 따라가되 직접 전환 가능하며 선택은 브라우저에 저장됨

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
css/style.css      디자인 시스템 (토큰 · 컴포넌트 · 다크/라이트 테마)
js/config.js        Supabase 프로젝트 설정 (직접 채워야 함)
js/supabaseClient.js Supabase 클라이언트 + 공통 유틸
js/theme.js         다크/라이트 테마 전환
js/nav.js           공통 네비게이션 (상단 바 + 모바일 하단 탭바)
js/*.js             페이지별 로직
sql/schema.sql       Supabase DB 스키마 (테이블/RLS/이달의상 함수)
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

### 6. 배포

정적 파일 그대로 Vercel / Netlify / GitHub Pages 등에 올리면 됩니다. 별도 빌드 커맨드가 필요 없습니다 (Output Directory: 프로젝트 루트).

## 🎨 디자인 시스템

`css/style.css` 하나에 토큰과 컴포넌트가 모두 정의돼 있고, 빌드 단계는 없습니다.

- **테마**: 다크가 기본이며 `:root`에 다크 토큰, `:root[data-theme="light"]`에 라이트 토큰을 둡니다.
  첫 방문자는 OS의 `prefers-color-scheme`을 따르고, 한 번 전환하면 `localStorage`(`joygolf-theme`)에 저장됩니다.
  각 페이지 `<head>`의 인라인 스크립트가 첫 페인트 전에 테마를 확정해 깜빡임(FOUC)이 없습니다.
- **색**: 그린(`--accent`) 단일 강조색 + 앰버(`--amber`)를 보조로 씁니다. 색을 새로 쓸 일이 생기면
  하드코딩하지 말고 토큰을 추가하세요 — 그래야 두 테마가 함께 따라옵니다.
- **레이아웃**: 12칼럼 `.bento` 그리드(`.col-4` ~ `.col-12`)를 씁니다. 카드 높이는 내용에 맞춰지므로
  (`align-items: start`) 짧은 카드 아래에 빈 공간이 생기지 않습니다.
- **컴포넌트**: `.card` `.btn`(`-outline` `-ghost` `-amber` `-danger` `-sm`) `.badge` `.stat-tile`
  `.list-item` `.empty-state` `.skeleton` 등이 준비돼 있습니다.
- **모바일**: 860px 이하에서 상단 알약 메뉴가 하단 탭바 + "더보기" 바텀시트로 바뀝니다.
- **접근성**: `prefers-reduced-motion`을 존중하고, 표시/숨김은 인라인 `style` 대신 `hidden` 속성으로 다룹니다.

차트 색도 `JoyGolf.cssVar()`로 같은 토큰을 읽어가므로, 테마를 바꾸면 육각형 차트가 함께 다시 그려집니다.

## 🔒 공개/비공개 설계 메모

- `profiles.profile_visibility`: 육각형 차트·개인 인증 내역 등 **상세 기록**의 공개 범위 (`public`/`private`)
- `profiles.award_visible`: **이달의 상** 발표 시 닉네임 노출 동의 여부 (상세 기록 공개 여부와 무관하게 독립 설정)
- 랭킹/이달의 상 집계(`get_monthly_awards` 함수)는 비공개 회원의 데이터도 통계에는 포함하되, 이름은 `award_visible`이 꺼져 있으면 "이름 없는 회원"으로 익명 처리합니다.
- 육각형 차트의 상대 비교는 `security_invoker` 뷰(`user_radar_raw`, `user_practice_raw`)를 통해 RLS를 그대로 적용받으므로, 비공개 회원의 원자료는 다른 회원의 화면에 노출되지 않습니다.

## ⚠️ 알려진 제약 / TODO

- 이 세션 환경에서는 npm 레지스트리 접근이 막혀 있어 로컬에서 실제 Supabase 프로젝트에 연결한 통합 테스트(회원가입/로그인/DB 연동)를 진행하지 못했습니다. Supabase 프로젝트를 연결한 뒤 직접 가입 → 인증 등록 → 운영진 승인 → 랭킹 확인 흐름을 한 번 확인해주세요.
- `enforce_email_domain` 트리거는 `auth.users` 테이블에 `BEFORE INSERT` 트리거를 생성합니다. 대부분의 Supabase 프로젝트에서 SQL Editor로 정상 생성되지만, 만약 권한 오류가 나면 대신 Supabase 대시보드의 **Authentication > Hooks** 기능으로 동일한 검증 함수를 연결하세요.
- 반려(운영진 승인 페이지의 "✖ 반려")는 현재 기록을 바로 삭제합니다. 반려 사유를 남기고 싶다면 `practice_logs`/`score_logs`에 `rejected_reason` 컬럼을 추가하는 방식으로 확장할 수 있습니다.
