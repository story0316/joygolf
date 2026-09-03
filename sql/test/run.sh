#!/usr/bin/env bash
# JoyGolf 스키마 / RLS 테스트 러너
#
# 로컬 Postgres 에 임시 DB 를 만들고, Supabase 스텁 -> schema.sql -> 테스트 순으로 실행한다.
# Supabase 프로젝트가 없어도 DB 계층(테이블/RLS/트리거/함수)을 검증할 수 있다.
#
#   사용법:  sql/test/run.sh
#   요구사항: PostgreSQL 14+ 가 로컬에 설치되어 실행 중일 것

set -euo pipefail

DB="${JOYGOLF_TEST_DB:-joygolf_test}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

# postgres 슈퍼유저로 실행 (root 로 돌 때는 su 를 거친다)
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  run_psql() { su postgres -c "psql $*"; }
else
  run_psql() { psql "$@"; }
fi

echo "▶ 테스트 DB 재생성 ($DB)"
run_psql "-q -c 'drop database if exists $DB'"
run_psql "-q -c 'create database $DB'"

echo "▶ Supabase 스텁 적용"
run_psql "-q -v ON_ERROR_STOP=1 -d $DB -f $DIR/00_supabase_shim.sql"

echo "▶ schema.sql 적용 (1회차)"
run_psql "-q -v ON_ERROR_STOP=1 -d $DB -f $ROOT/sql/schema.sql"

echo "▶ schema.sql 재적용 (멱등성 확인)"
run_psql "-q -v ON_ERROR_STOP=1 -d $DB -f $ROOT/sql/schema.sql"

echo "▶ RLS / 비즈니스 규칙 테스트"
run_psql "-v ON_ERROR_STOP=1 -d $DB -f $DIR/01_rls_test.sql"
