-- ============================================================
-- JoyGolf RLS / 비즈니스 규칙 테스트
--
-- 이 앱이 회원에게 한 약속 — "비공개로 두면 남에게 안 보인다",
-- "스스로 운영진이 될 수 없다", "동의 안 하면 이름이 안 나온다" — 을
-- 실제 Postgres 위에서 검증한다.
--
-- 실행: sql/test/run.sh
-- ============================================================

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;

-- ---------- 결과 수집 ----------
drop table if exists public.test_results;
create table public.test_results (
  id serial primary key,
  name text,
  passed boolean,
  detail text
);
grant all on public.test_results, public.test_results_id_seq to authenticated;

-- ---------- 픽스처 ----------
-- alice : 비공개 프로필 / 시상 노출 동의
-- bob   : 공개 프로필   / 시상 노출 동의
-- carol : 비공개 프로필 / 시상 노출 비동의  <- 익명화 대상
-- dave  : 운영진
delete from public.push_subscriptions;
delete from public.score_logs;
delete from public.practice_logs;
delete from public.profiles;
delete from auth.users;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@company.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@company.com'),
  ('33333333-3333-3333-3333-333333333333', 'carol@company.com'),
  ('44444444-4444-4444-4444-444444444444', 'dave@company.com');

insert into public.profiles (id, display_name, profile_visibility, award_visible, is_admin) values
  ('11111111-1111-1111-1111-111111111111', '앨리스', 'private', true,  false),
  ('22222222-2222-2222-2222-222222222222', '밥',     'public',  true,  false),
  ('33333333-3333-3333-3333-333333333333', '캐롤',   'private', false, false),
  ('44444444-4444-4444-4444-444444444444', '데이브', 'public',  true,  true);

-- 연습: 캐롤이 이달의 연습왕(1200개), 앨리스 500, 밥 300
insert into public.practice_logs (user_id, practice_date, ball_count, verified) values
  ('11111111-1111-1111-1111-111111111111', current_date,     300, true),
  ('11111111-1111-1111-1111-111111111111', current_date - 1, 200, false),
  ('22222222-2222-2222-2222-222222222222', current_date,     300, true),
  ('33333333-3333-3333-3333-333333333333', current_date,     700, true),
  ('33333333-3333-3333-3333-333333333333', current_date - 2, 500, true);

-- 스코어: 앨리스가 전월 대비 10타 개선(향상상 1위), 밥은 2타 개선
insert into public.score_logs (user_id, round_date, total_score, par, verified) values
  ('11111111-1111-1111-1111-111111111111', current_date,                      95,  72, true),
  ('11111111-1111-1111-1111-111111111111', current_date - 1,                  95,  72, true),
  ('11111111-1111-1111-1111-111111111111', current_date - interval '1 month', 105, 72, true),
  ('11111111-1111-1111-1111-111111111111', current_date - interval '1 month', 105, 72, true),
  ('22222222-2222-2222-2222-222222222222', current_date,                      90,  72, true),
  ('22222222-2222-2222-2222-222222222222', current_date - 1,                  90,  72, true),
  ('22222222-2222-2222-2222-222222222222', current_date - interval '1 month', 92,  72, true),
  ('22222222-2222-2222-2222-222222222222', current_date - interval '1 month', 92,  72, true);

insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example/alice', '11111111-1111-1111-1111-111111111111', 'k', 'a'),
  ('https://push.example/bob',   '22222222-2222-2222-2222-222222222222', 'k', 'a');

-- ============================================================
-- 1. 비공개 프로필의 기록은 다른 회원에게 보이지 않는다
-- ============================================================
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
set role authenticated;

insert into public.test_results (name, passed, detail)
select '비공개 회원(앨리스)의 연습기록은 밥에게 안 보임',
       count(*) = 0,
       '보인 행 수: ' || count(*)
from public.practice_logs where user_id = '11111111-1111-1111-1111-111111111111';

insert into public.test_results (name, passed, detail)
select '비공개 회원(앨리스)의 스코어는 밥에게 안 보임',
       count(*) = 0,
       '보인 행 수: ' || count(*)
from public.score_logs where user_id = '11111111-1111-1111-1111-111111111111';

insert into public.test_results (name, passed, detail)
select '밥은 자기 연습기록을 본다',
       count(*) = 1,
       '보인 행 수: ' || count(*)
from public.practice_logs where user_id = '22222222-2222-2222-2222-222222222222';

reset role;

-- ============================================================
-- 2. 공개 프로필의 기록은 다른 회원에게 보인다
-- ============================================================
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
set role authenticated;

insert into public.test_results (name, passed, detail)
select '공개 회원(밥)의 연습기록은 앨리스에게 보임',
       count(*) = 1,
       '보인 행 수: ' || count(*)
from public.practice_logs where user_id = '22222222-2222-2222-2222-222222222222';

insert into public.test_results (name, passed, detail)
select '앨리스는 자기 기록 전부를 본다',
       count(*) = 2,
       '보인 행 수: ' || count(*)
from public.practice_logs where user_id = '11111111-1111-1111-1111-111111111111';

-- 육각형 비교용 뷰도 같은 규칙을 따라야 한다 (security_invoker)
insert into public.test_results (name, passed, detail)
select '레이더 뷰: 비공개 회원(캐롤) 행이 앨리스에게 노출되지 않음',
       count(*) = 0,
       '보인 행 수: ' || count(*)
from public.user_practice_raw where user_id = '33333333-3333-3333-3333-333333333333';

insert into public.test_results (name, passed, detail)
select '레이더 뷰: 공개 회원(밥) 행은 앨리스에게 보임',
       count(*) = 1,
       '보인 행 수: ' || count(*)
from public.user_practice_raw where user_id = '22222222-2222-2222-2222-222222222222';

reset role;

-- ============================================================
-- 3. 남의 이름으로 기록을 만들 수 없다
-- ============================================================
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
set role authenticated;

do $$
declare ok boolean := false;
begin
  begin
    insert into public.practice_logs (user_id, ball_count)
    values ('11111111-1111-1111-1111-111111111111', 100);
  exception when insufficient_privilege then
    ok := true;
  end;
  insert into public.test_results (name, passed, detail)
  values ('밥은 앨리스 이름으로 연습기록을 만들 수 없다', ok,
          case when ok then 'RLS 가 차단함' else '차단 실패 - 삽입됨!' end);
end
$$;

reset role;

-- ============================================================
-- 4. 스스로 검증(승인) 도장을 찍을 수 없다
--    UPDATE 정책의 WITH CHECK 이 USING 을 물려받으므로, verified=true 로 바꾸면
--    조용한 무시가 아니라 RLS 위반 에러로 거부된다.
-- ============================================================
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
set role authenticated;

do $$
declare blocked boolean := false;
begin
  begin
    update public.practice_logs set verified = true
    where user_id = '11111111-1111-1111-1111-111111111111' and verified = false;
  exception when insufficient_privilege then
    blocked := true;
  end;
  insert into public.test_results (name, passed, detail)
  values ('회원이 자기 인증을 스스로 승인할 수 없다', blocked,
          case when blocked then 'RLS 가 거부함' else '차단 실패 - 승인됨!' end);
end
$$;

reset role;

insert into public.test_results (name, passed, detail)
select '자가 승인 시도 후에도 미검증 상태가 유지된다',
       count(*) = 1,
       '아직 미검증인 행: ' || count(*)
from public.practice_logs
where user_id = '11111111-1111-1111-1111-111111111111' and verified = false;

-- ============================================================
-- 5. 스스로 운영진이 될 수 없다 (protect_is_admin 트리거)
-- ============================================================
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
set role authenticated;

update public.profiles set is_admin = true
where id = '22222222-2222-2222-2222-222222222222';

reset role;

insert into public.test_results (name, passed, detail)
select '일반 회원은 스스로 운영진이 될 수 없다',
       is_admin = false,
       '밥의 is_admin = ' || is_admin
from public.profiles where id = '22222222-2222-2222-2222-222222222222';

-- 운영진이라 해도 API 로는 남을 승격시킬 수 없다.
-- (profiles UPDATE 정책이 "본인 행"만 허용하므로 트리거까지 도달하지도 않는다)
set request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444"}';
set role authenticated;

update public.profiles set is_admin = true
where id = '22222222-2222-2222-2222-222222222222';

reset role;

insert into public.test_results (name, passed, detail)
select '운영진도 API 로는 남을 승격시킬 수 없다 (SQL Editor 전용)',
       is_admin = false,
       '밥의 is_admin = ' || is_admin
from public.profiles where id = '22222222-2222-2222-2222-222222222222';

-- 반대로 SQL Editor(=JWT 없는 컨텍스트)에서는 운영진 지정이 되어야 한다.
-- README 의 "첫 운영진 지정" 절차가 실제로 동작하는지 확인하는 테스트.
reset request.jwt.claims;
update public.profiles set is_admin = true
where id = '22222222-2222-2222-2222-222222222222';

insert into public.test_results (name, passed, detail)
select 'SQL Editor 에서는 운영진 지정이 된다 (첫 운영진 부트스트랩)',
       is_admin = true,
       '밥의 is_admin = ' || is_admin
from public.profiles where id = '22222222-2222-2222-2222-222222222222';

-- 원복
update public.profiles set is_admin = false where id = '22222222-2222-2222-2222-222222222222';

-- ============================================================
-- 6. 운영진은 공개설정과 무관하게 대기열 전체를 본다
-- ============================================================
set request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444"}';
set role authenticated;

insert into public.test_results (name, passed, detail)
select '운영진은 비공개 회원(앨리스)의 미검증 기록도 본다',
       count(*) = 1,
       '보인 행 수: ' || count(*)
from public.practice_logs
where user_id = '11111111-1111-1111-1111-111111111111' and verified = false;

-- 운영진의 승인이 실제로 적용되는지
update public.practice_logs set verified = true
where user_id = '11111111-1111-1111-1111-111111111111' and verified = false;

reset role;

insert into public.test_results (name, passed, detail)
select '운영진이 승인하면 verified 가 실제로 바뀐다',
       count(*) = 0,
       '아직 미검증인 행: ' || count(*)
from public.practice_logs
where user_id = '11111111-1111-1111-1111-111111111111' and verified = false;

-- ============================================================
-- 7. 푸시 구독은 본인 것만 보인다
-- ============================================================
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
set role authenticated;

insert into public.test_results (name, passed, detail)
select '푸시 구독은 본인 것만 조회된다',
       count(*) = 1 and bool_and(user_id = '22222222-2222-2222-2222-222222222222'),
       '보인 행 수: ' || count(*)
from public.push_subscriptions;

reset role;

-- ============================================================
-- 8. app_settings 는 API 로 읽을 수 없다 (정책 없음 = 전면 차단)
-- ============================================================
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
set role authenticated;

insert into public.test_results (name, passed, detail)
select '설정값 테이블은 일반 회원이 읽을 수 없다',
       count(*) = 0,
       '보인 행 수: ' || count(*)
from public.app_settings;

reset role;

-- ============================================================
-- 9. 이달의 상: 집계값과 익명화
-- ============================================================
insert into public.test_results (name, passed, detail)
select '이달의 연습왕 1위는 캐롤(1200개)',
       value = 1200,
       '값: ' || value
from public.get_monthly_awards()
where award_type = '연습왕' and rank = 1;

insert into public.test_results (name, passed, detail)
select '시상 노출 비동의(캐롤)는 "이름 없는 회원"으로 익명화된다',
       display_name = '이름 없는 회원',
       '표시된 이름: ' || display_name
from public.get_monthly_awards()
where award_type = '연습왕' and rank = 1;

insert into public.test_results (name, passed, detail)
select '시상 노출 동의(앨리스)는 닉네임이 그대로 나온다',
       display_name = '앨리스',
       '표시된 이름: ' || display_name
from public.get_monthly_awards()
where award_type = '스코어 향상상' and rank = 1;

insert into public.test_results (name, passed, detail)
select '스코어 향상상 1위는 앨리스(10타 개선)',
       round(value) = 10,
       '값: ' || round(value, 1)
from public.get_monthly_awards()
where award_type = '스코어 향상상' and rank = 1;

insert into public.test_results (name, passed, detail)
select '이달의 꾸준상 1위는 캐롤(2일)',
       value = 2,
       '값: ' || value
from public.get_monthly_awards()
where award_type = '꾸준상' and rank = 1;

-- ============================================================
-- 10. 가입 이메일 도메인 서버단 강제
-- ============================================================
update public.app_settings set value = 'company.com' where key = 'allowed_email_domain';

do $$
declare blocked boolean := false;
begin
  begin
    insert into auth.users (id, email)
    values ('99999999-9999-9999-9999-999999999999', 'outsider@gmail.com');
  exception when others then
    blocked := true;
  end;
  insert into public.test_results (name, passed, detail)
  values ('허용 도메인 밖 이메일은 가입이 차단된다', blocked,
          case when blocked then '트리거가 차단함' else '차단 실패 - 가입됨!' end);
end
$$;

do $$
declare allowed boolean := false;
begin
  begin
    insert into auth.users (id, email)
    values ('88888888-8888-8888-8888-888888888888', 'newbie@company.com');
    allowed := true;
  exception when others then
    allowed := false;
  end;
  insert into public.test_results (name, passed, detail)
  values ('사내 도메인 이메일은 정상 가입된다', allowed,
          case when allowed then '가입 성공' else '차단됨 - 오탐!' end);
end
$$;

-- 설정을 비우면 제한이 풀려야 한다
update public.app_settings set value = '' where key = 'allowed_email_domain';

do $$
declare allowed boolean := false;
begin
  begin
    insert into auth.users (id, email)
    values ('77777777-7777-7777-7777-777777777777', 'anyone@gmail.com');
    allowed := true;
  exception when others then
    allowed := false;
  end;
  insert into public.test_results (name, passed, detail)
  values ('도메인 설정이 비어있으면 제한이 없다', allowed,
          case when allowed then '가입 성공' else '차단됨 - 오탐!' end);
end
$$;

-- ============================================================
-- 결과 출력
-- ============================================================
\unset QUIET
\pset border 2
\echo ''
\echo '================ 테스트 결과 ================'
select
  case when passed then 'PASS' else 'FAIL' end as "결과",
  name as "항목",
  detail as "상세"
from public.test_results
order by id;

\echo ''
select
  count(*) filter (where passed) || ' / ' || count(*) || ' 통과' as "요약",
  count(*) filter (where not passed) as "실패"
from public.test_results;

-- 실패가 하나라도 있으면 예외를 던져 psql 이 0이 아닌 코드로 끝나게 한다
-- (\quit 은 인자를 받지 않아서 종료코드를 만들 수 없다)
do $$
declare n int;
begin
  select count(*) into n from public.test_results where not passed;
  if n > 0 then
    raise exception '% 개 테스트 실패', n;
  end if;
end
$$;

\echo '모든 테스트 통과'
