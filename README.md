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
css/style.css      공통 스타일
js/config.js        Supabase 프로젝트 설정 (직접 채워야 함)
js/supabaseClient.js Supabase 클라이언트 + 공통 유틸
js/nav.js           공통 상단 네비게이션
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

### 4. 배포

정적 파일 그대로 Vercel / Netlify / GitHub Pages 등에 올리면 됩니다. 별도 빌드 커맨드가 필요 없습니다 (Output Directory: 프로젝트 루트).

## 🔒 공개/비공개 설계 메모

- `profiles.profile_visibility`: 육각형 차트·개인 인증 내역 등 **상세 기록**의 공개 범위 (`public`/`private`)
- `profiles.award_visible`: **이달의 상** 발표 시 닉네임 노출 동의 여부 (상세 기록 공개 여부와 무관하게 독립 설정)
- 랭킹/이달의 상 집계(`get_monthly_awards` 함수)는 비공개 회원의 데이터도 통계에는 포함하되, 이름은 `award_visible`이 꺼져 있으면 "이름 없는 회원"으로 익명 처리합니다.
- 육각형 차트의 상대 비교는 `security_invoker` 뷰(`user_radar_raw`, `user_practice_raw`)를 통해 RLS를 그대로 적용받으므로, 비공개 회원의 원자료는 다른 회원의 화면에 노출되지 않습니다.

## ⚠️ 알려진 제약 / TODO

- 이 세션 환경에서는 npm 레지스트리 접근이 막혀 있어 로컬에서 실제 Supabase 프로젝트에 연결한 통합 테스트(회원가입/로그인/DB 연동)를 진행하지 못했습니다. Supabase 프로젝트를 연결한 뒤 직접 가입 → 인증 등록 → 랭킹 확인 흐름을 한 번 확인해주세요.
- 인증(검증) 처리는 현재 수동입니다. `practice_logs.verified` / `score_logs.verified` 를 운영진이 Supabase 테이블 에디터에서 직접 체크하는 방식이며, 추후 운영진 전용 승인 페이지를 추가할 수 있습니다.
- 사내 이메일 도메인 제한은 프론트엔드 체크만 되어 있습니다. 더 강하게 막으려면 Supabase Auth Hook(또는 이메일 도메인 allow-list)을 추가로 설정하세요.
