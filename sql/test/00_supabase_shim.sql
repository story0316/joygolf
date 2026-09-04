-- ============================================================
-- 로컬 검증용 Supabase 스텁
--
-- Supabase 프로젝트에는 기본으로 존재하지만 맨 Postgres 에는 없는 것들을
-- 최소한으로 재현한다. 이 파일은 *테스트 전용*이며 실제 Supabase 프로젝트에는
-- 절대 실행하지 말 것 (이미 있는 것들을 덮어쓴다).
--
--   - anon / authenticated / service_role 역할
--   - auth 스키마: users 테이블, uid() / role() 함수
--   - storage 스키마: buckets / objects 테이블
--   - public 스키마 기본 권한 (Supabase 가 자동으로 부여하는 것)
-- ============================================================

-- ---------- 역할 ----------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant anon, authenticated, service_role to current_user;

-- ---------- auth 스키마 ----------
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- Supabase 의 auth.uid() 와 동일한 방식: 요청 JWT 의 sub 클레임을 읽는다.
-- 테스트에서는 set_config('request.jwt.claims', ...) 로 흉내낸다.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'anon'
  )
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- ---------- storage 스키마 ----------
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

-- ---------- public 스키마 기본 권한 ----------
-- Supabase 는 새로 만들어지는 public 테이블에 anon/authenticated/service_role
-- 권한을 자동으로 부여한다. RLS 가 실제 접근 제어를 담당하고, 이 권한은
-- "테이블에 말을 걸 수는 있다" 수준의 전제 조건이다.
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
