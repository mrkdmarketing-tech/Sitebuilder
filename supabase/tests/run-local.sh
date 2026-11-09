#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres and runs the SQL tests.
# Usage: npm run db:test   (needs PostgreSQL 15+ installed: initdb, pg_ctl, psql)
# Docs: docs/development.md
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PATH="$PGBIN:$PATH"
PORT="${PGPORT_TEST:-54329}"
DATA="$(mktemp -d /tmp/mrkd-pg-XXXXXX)"

# initdb refuses to run as root; use the postgres OS user if we are root.
RUN=()
if [ "$(id -u)" = "0" ]; then RUN=(runuser -u postgres --); chown postgres "$DATA"; fi

cleanup() { "${RUN[@]}" pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"${RUN[@]}" initdb -D "$DATA" -U postgres -A trust >/dev/null
"${RUN[@]}" pg_ctl -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/log" start >/dev/null
for _ in $(seq 1 30); do pg_isready -h /tmp -p "$PORT" >/dev/null 2>&1 && break; sleep 0.2; done

PSQL=(psql -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create database mrkd_test" postgres
"${PSQL[@]}" -c "create database retool_fake" postgres
"${PSQL[@]}" -d retool_fake -f "$HERE/retool-fake.sql"

echo "→ Supabase stand-ins"
"${PSQL[@]}" -d mrkd_test -f "$HERE/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${PSQL[@]}" -d mrkd_test -f "$f"
done
echo "→ seed (sample data)"
"${PSQL[@]}" -d mrkd_test -f "$ROOT/supabase/seed.sql"
for f in "$HERE"/*.test.sql; do
  echo "→ test $(basename "$f")"
  "${PSQL[@]}" -d mrkd_test -v bridge_conn="host=/tmp port=$PORT dbname=retool_fake user=postgres" -f "$f"
done
echo "✓ all database tests passed"
