-- ============================================================
-- JoyGolf 사내 골프 동호회 웹 - Supabase 스키마
-- Supabase 프로젝트의 SQL Editor에서 이 파일 전체를 실행하세요.
-- ============================================================

-- ---------- 확장 ----------
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. profiles : 회원 프로필 + 공개 설정
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  department text,
  avatar_emoji text default '🏌️',
  handicap numeric,
  -- 공개 범위: 'public' = 다른 회원에게 상세 기록/육각형 공개, 'private' = 본인만
  profile_visibility text not null default 'private' check (profile_visibility in ('public', 'private')),
  -- 랭킹/이달의 상 발표에 실명(닉네임) 노출 동의 여부 (프로필이 비공개여도 별도로 켤 수 있음)
  award_visible boolean not null default true,
  -- 운영진 여부: 연습/스코어 인증 승인 페이지 접근 권한. 아래 protect_is_admin 트리거로 셀프 승격을 막음
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: 로그인한 회원은 모두 열람 가능" on public.profiles;
create policy "profiles: 로그인한 회원은 모두 열람 가능"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles: 본인만 생성" on public.profiles;
create policy "profiles: 본인만 생성"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles: 본인만 수정" on public.profiles;
create policy "profiles: 본인만 수정"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- is_admin 승격은 두 겹으로 막힌다:
--   1) 위 UPDATE 정책이 "본인 행"만 허용하므로, API 로는 남을 승격시키는 것 자체가 불가능하다.
--   2) 이 트리거가 본인 행에서 스스로 is_admin 을 켜는 것을 되돌린다.
-- 즉 운영진 지정은 auth.uid() 가 없는 컨텍스트(SQL Editor / service_role)에서만 가능하다.
-- 이 동작은 sql/test/01_rls_test.sql 에서 검증한다.
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if auth.uid() is not null and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
    ) then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_is_admin_trigger on public.profiles;
create trigger protect_is_admin_trigger
  before update on public.profiles
  for each row execute function public.protect_is_admin();

-- 정책에서 반복 사용할 관리자 판별 헬퍼
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- ============================================================
-- 2. practice_logs : 연습 인증 (연습공 수)
-- ============================================================
create table if not exists public.practice_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  practice_date date not null default current_date,
  ball_count int not null check (ball_count > 0),
  location text,
  photo_url text,
  note text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.practice_logs enable row level security;

drop policy if exists "practice_logs: 본인 또는 공개 프로필 기록 열람" on public.practice_logs;
create policy "practice_logs: 본인 또는 공개 프로필 기록 열람"
  on public.practice_logs for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = practice_logs.user_id and p.profile_visibility = 'public'
    )
  );

drop policy if exists "practice_logs: 본인만 등록" on public.practice_logs;
create policy "practice_logs: 본인만 등록"
  on public.practice_logs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "practice_logs: 본인만 수정/삭제 (미검증 상태만)" on public.practice_logs;
create policy "practice_logs: 본인만 수정/삭제 (미검증 상태만)"
  on public.practice_logs for update
  to authenticated
  using (user_id = auth.uid() and verified = false);

drop policy if exists "practice_logs: 본인만 삭제 (미검증 상태만)" on public.practice_logs;
create policy "practice_logs: 본인만 삭제 (미검증 상태만)"
  on public.practice_logs for delete
  to authenticated
  using (user_id = auth.uid() and verified = false);

-- 운영진 승인 페이지용: 관리자는 공개설정과 무관하게 전체 열람/검증(승인)/반려(삭제) 가능
drop policy if exists "practice_logs: 관리자 전체 열람" on public.practice_logs;
create policy "practice_logs: 관리자 전체 열람"
  on public.practice_logs for select to authenticated
  using (public.is_admin());

drop policy if exists "practice_logs: 관리자 검증 처리" on public.practice_logs;
create policy "practice_logs: 관리자 검증 처리"
  on public.practice_logs for update to authenticated
  using (public.is_admin());

drop policy if exists "practice_logs: 관리자 반려 삭제" on public.practice_logs;
create policy "practice_logs: 관리자 반려 삭제"
  on public.practice_logs for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- 3. score_logs : 라운드 스코어 인증 (골프존/필드 스코어카드)
-- ============================================================
create table if not exists public.score_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  round_date date not null default current_date,
  course_name text,
  total_score int not null,
  par int not null default 72,
  putts int,
  fairways_hit int,
  fairways_total int,
  gir int,          -- greens in regulation
  gir_total int,
  photo_url text,
  note text,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.score_logs enable row level security;

drop policy if exists "score_logs: 본인 기록 또는 공개 프로필 기록 열람" on public.score_logs;
create policy "score_logs: 본인 기록 또는 공개 프로필 기록 열람"
  on public.score_logs for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = score_logs.user_id and p.profile_visibility = 'public'
    )
  );

drop policy if exists "score_logs: 본인만 등록" on public.score_logs;
create policy "score_logs: 본인만 등록"
  on public.score_logs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "score_logs: 본인만 수정 (미검증 상태만)" on public.score_logs;
create policy "score_logs: 본인만 수정 (미검증 상태만)"
  on public.score_logs for update
  to authenticated
  using (user_id = auth.uid() and verified = false);

drop policy if exists "score_logs: 본인만 삭제 (미검증 상태만)" on public.score_logs;
create policy "score_logs: 본인만 삭제 (미검증 상태만)"
  on public.score_logs for delete
  to authenticated
  using (user_id = auth.uid() and verified = false);

-- 운영진 승인 페이지용: 관리자는 공개설정과 무관하게 전체 열람/검증(승인)/반려(삭제) 가능
drop policy if exists "score_logs: 관리자 전체 열람" on public.score_logs;
create policy "score_logs: 관리자 전체 열람"
  on public.score_logs for select to authenticated
  using (public.is_admin());

drop policy if exists "score_logs: 관리자 검증 처리" on public.score_logs;
create policy "score_logs: 관리자 검증 처리"
  on public.score_logs for update to authenticated
  using (public.is_admin());

drop policy if exists "score_logs: 관리자 반려 삭제" on public.score_logs;
create policy "score_logs: 관리자 반려 삭제"
  on public.score_logs for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- 4. meetups : 라운딩/연습 모임 약속
-- ============================================================
create table if not exists public.meetups (
  id uuid primary key default uuid_generate_v4(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  meetup_type text not null default 'round' check (meetup_type in ('round', 'practice', 'etc')),
  meetup_date timestamptz not null,
  location text,
  max_people int default 4,
  description text,
  created_at timestamptz not null default now()
);

alter table public.meetups enable row level security;

drop policy if exists "meetups: 로그인한 회원 모두 열람" on public.meetups;
create policy "meetups: 로그인한 회원 모두 열람"
  on public.meetups for select to authenticated using (true);

drop policy if exists "meetups: 로그인한 회원 생성" on public.meetups;
create policy "meetups: 로그인한 회원 생성"
  on public.meetups for insert to authenticated with check (host_id = auth.uid());

drop policy if exists "meetups: 호스트만 수정" on public.meetups;
create policy "meetups: 호스트만 수정"
  on public.meetups for update to authenticated using (host_id = auth.uid());

drop policy if exists "meetups: 호스트만 삭제" on public.meetups;
create policy "meetups: 호스트만 삭제"
  on public.meetups for delete to authenticated using (host_id = auth.uid());

create table if not exists public.meetup_rsvps (
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'maybe', 'cancelled')),
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);

alter table public.meetup_rsvps enable row level security;

drop policy if exists "rsvps: 로그인한 회원 모두 열람" on public.meetup_rsvps;
create policy "rsvps: 로그인한 회원 모두 열람"
  on public.meetup_rsvps for select to authenticated using (true);

drop policy if exists "rsvps: 본인만 등록/수정" on public.meetup_rsvps;
create policy "rsvps: 본인만 등록/수정"
  on public.meetup_rsvps for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "rsvps: 본인만 수정" on public.meetup_rsvps;
create policy "rsvps: 본인만 수정"
  on public.meetup_rsvps for update to authenticated using (user_id = auth.uid());

drop policy if exists "rsvps: 본인만 삭제" on public.meetup_rsvps;
create policy "rsvps: 본인만 삭제"
  on public.meetup_rsvps for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- 5. posts / comments : 후기 게시판
-- ============================================================
create table if not exists public.posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  content text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

drop policy if exists "posts: 로그인한 회원 모두 열람" on public.posts;
create policy "posts: 로그인한 회원 모두 열람"
  on public.posts for select to authenticated using (true);
drop policy if exists "posts: 본인만 작성" on public.posts;
create policy "posts: 본인만 작성"
  on public.posts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "posts: 본인만 수정" on public.posts;
create policy "posts: 본인만 수정"
  on public.posts for update to authenticated using (user_id = auth.uid());
drop policy if exists "posts: 본인만 삭제" on public.posts;
create policy "posts: 본인만 삭제"
  on public.posts for delete to authenticated using (user_id = auth.uid());

create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

drop policy if exists "comments: 로그인한 회원 모두 열람" on public.comments;
create policy "comments: 로그인한 회원 모두 열람"
  on public.comments for select to authenticated using (true);
drop policy if exists "comments: 본인만 작성" on public.comments;
create policy "comments: 본인만 작성"
  on public.comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "comments: 본인만 삭제" on public.comments;
create policy "comments: 본인만 삭제"
  on public.comments for delete to authenticated using (user_id = auth.uid());

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "post_likes: 로그인한 회원 모두 열람" on public.post_likes;
create policy "post_likes: 로그인한 회원 모두 열람"
  on public.post_likes for select to authenticated using (true);
drop policy if exists "post_likes: 본인만 등록" on public.post_likes;
create policy "post_likes: 본인만 등록"
  on public.post_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "post_likes: 본인만 삭제" on public.post_likes;
create policy "post_likes: 본인만 삭제"
  on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- 6. Storage bucket : 인증샷 업로드용
-- ============================================================
insert into storage.buckets (id, name, public)
values ('proof-photos', 'proof-photos', true)
on conflict (id) do nothing;

drop policy if exists "proof-photos: 로그인한 회원 업로드" on storage.objects;
create policy "proof-photos: 로그인한 회원 업로드"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'proof-photos');

drop policy if exists "proof-photos: 누구나(공개버킷) 조회" on storage.objects;
create policy "proof-photos: 누구나(공개버킷) 조회"
  on storage.objects for select
  using (bucket_id = 'proof-photos');

drop policy if exists "proof-photos: 본인 파일만 삭제" on storage.objects;
create policy "proof-photos: 본인 파일만 삭제"
  on storage.objects for delete to authenticated
  using (bucket_id = 'proof-photos' and owner = auth.uid());

-- ============================================================
-- 7. app_settings + 가입 이메일 도메인 서버단 검증
--    (js/config.js의 ALLOWED_EMAIL_DOMAIN은 UX용 프론트 체크일 뿐이라 API를 직접
--     호출하면 우회 가능함 -> auth.users 가입 트리거에서 실제로 강제한다)
-- ============================================================
create table if not exists public.app_settings (
  key text primary key,
  value text
);

alter table public.app_settings enable row level security;
-- 정책을 하나도 두지 않아 PostgREST(anon/authenticated 키)로는 조회/수정 모두 막히고,
-- SQL Editor(관리자)와 security definer 함수에서만 접근 가능하다.

insert into public.app_settings (key, value)
values ('allowed_email_domain', '')
on conflict (key) do nothing;
-- 사내 이메일만 가입을 허용하려면 아래처럼 값을 채우세요 (빈 문자열이면 제한 없음):
--   update public.app_settings set value = 'yourcompany.com' where key = 'allowed_email_domain';

create or replace function public.enforce_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text;
begin
  select value into allowed from public.app_settings where key = 'allowed_email_domain';
  if allowed is not null and allowed <> '' and new.email not ilike ('%@' || allowed) then
    raise exception 'signup_domain_not_allowed: only @% addresses may sign up', allowed;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_domain_trigger on auth.users;
create trigger enforce_email_domain_trigger
  before insert on auth.users
  for each row execute function public.enforce_email_domain();

-- ============================================================
-- 8. push_subscriptions : 웹 푸시 구독 (브라우저/기기 단위)
--    실제 발송은 Edge Function(supabase/functions/send-push)이 담당한다.
-- ============================================================
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: 본인 구독만 열람" on public.push_subscriptions;
create policy "push_subscriptions: 본인 구독만 열람"
  on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_subscriptions: 본인만 등록" on public.push_subscriptions;
create policy "push_subscriptions: 본인만 등록"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_subscriptions: 본인만 수정" on public.push_subscriptions;
create policy "push_subscriptions: 본인만 수정"
  on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_subscriptions: 본인만 삭제" on public.push_subscriptions;
create policy "push_subscriptions: 본인만 삭제"
  on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());
-- 발송용 Edge Function 은 service_role 키로 접근하므로 RLS 를 우회한다.

-- ============================================================
-- 9. 육각형 역량 원자료 뷰 (본인/공개 프로필만 RLS로 필터링됨)
-- ============================================================
create or replace view public.user_radar_raw
with (security_invoker = true) as
select
  s.user_id,
  count(*) filter (where s.round_date >= (current_date - interval '180 days')) as rounds_180d,
  avg(s.total_score - s.par) filter (where s.round_date >= (current_date - interval '90 days')) as avg_score_to_par_90d,
  avg(s.total_score - s.par) filter (
    where s.round_date < (current_date - interval '90 days')
      and s.round_date >= (current_date - interval '180 days')
  ) as avg_score_to_par_prev90d,
  avg(s.putts) filter (where s.round_date >= (current_date - interval '180 days')) as avg_putts,
  avg(s.fairways_hit::numeric / nullif(s.fairways_total, 0)) filter (where s.round_date >= (current_date - interval '180 days')) as avg_fairway_pct,
  avg(s.gir::numeric / nullif(s.gir_total, 0)) filter (where s.round_date >= (current_date - interval '180 days')) as avg_gir_pct
from public.score_logs s
group by s.user_id;

create or replace view public.user_practice_raw
with (security_invoker = true) as
select
  p.user_id,
  count(*) filter (where p.practice_date >= (current_date - interval '30 days')) as sessions_30d,
  sum(p.ball_count) filter (where p.practice_date >= (current_date - interval '30 days')) as balls_30d,
  count(distinct p.practice_date) filter (where p.practice_date >= (current_date - interval '30 days')) as active_days_30d
from public.practice_logs p
group by p.user_id;

-- ============================================================
-- 10. 이달의 상 : SECURITY DEFINER 함수로 익명 처리하여 반환
--     (프로필 비공개 회원도 집계엔 포함되지만, award_visible=false면 이름 대신 '이름 없는 회원')
-- ============================================================
create or replace function public.get_monthly_awards()
returns table (
  award_type text,
  rank int,
  display_name text,
  avatar_emoji text,
  value numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  -- 이달의 연습왕 (연습공 수)
  select '연습왕' as award_type, row_number() over (order by t.total_balls desc)::int as rank,
         case when p.award_visible then p.display_name else '이름 없는 회원' end,
         case when p.award_visible then p.avatar_emoji else '🙈' end,
         t.total_balls::numeric
  from (
    select user_id, sum(ball_count) as total_balls
    from practice_logs
    where date_trunc('month', practice_date) = date_trunc('month', current_date)
    group by user_id
  ) t
  join profiles p on p.id = t.user_id
  order by t.total_balls desc
  limit 3;

  return query
  -- 이달의 꾸준상 (연습 인증 일수)
  select '꾸준상', row_number() over (order by t.active_days desc)::int,
         case when p.award_visible then p.display_name else '이름 없는 회원' end,
         case when p.award_visible then p.avatar_emoji else '🙈' end,
         t.active_days::numeric
  from (
    select user_id, count(distinct practice_date) as active_days
    from practice_logs
    where date_trunc('month', practice_date) = date_trunc('month', current_date)
    group by user_id
  ) t
  join profiles p on p.id = t.user_id
  order by t.active_days desc
  limit 3;

  return query
  -- 이달의 스코어 향상상 (전월 대비 평균 스코어 개선폭, 각 달 2라운드 이상)
  select '스코어 향상상', row_number() over (order by (prev.avg_score - cur.avg_score) desc)::int,
         case when p.award_visible then p.display_name else '이름 없는 회원' end,
         case when p.award_visible then p.avatar_emoji else '🙈' end,
         (prev.avg_score - cur.avg_score)
  from (
    select user_id, avg(total_score - par) as avg_score, count(*) as cnt
    from score_logs
    where date_trunc('month', round_date) = date_trunc('month', current_date)
    group by user_id
  ) cur
  join (
    select user_id, avg(total_score - par) as avg_score, count(*) as cnt
    from score_logs
    where date_trunc('month', round_date) = date_trunc('month', current_date - interval '1 month')
    group by user_id
  ) prev on prev.user_id = cur.user_id
  join profiles p on p.id = cur.user_id
  where cur.cnt >= 2 and prev.cnt >= 2
  order by (prev.avg_score - cur.avg_score) desc
  limit 3;
end;
$$;

grant execute on function public.get_monthly_awards() to authenticated;
