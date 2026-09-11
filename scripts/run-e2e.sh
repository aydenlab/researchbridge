#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
LOG_PATH="${TMPDIR:-/tmp}/rbprod.log"

taskkill //F //IM node.exe //T >/dev/null 2>&1 || true
sleep 3

rm -rf .pgdata .storage
npx tsx src/db/migrate.ts
npx tsx src/db/seed.ts | tail -2
sleep 1

rm -f "$LOG_PATH"
# The digest has its own tests. Left on, it wakes up against the fresh
# database this script just seeded and competes with the suite for the single
# PGlite writer, which shows up as sign in timing out.
DIGEST_AUTORUN=false npm run dev > "$LOG_PATH" 2>&1 &
for i in $(seq 1 40); do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || true)
  [ "$code" = "200" ] && break
done
echo "server up ($code)"

echo "warming routes"
for path in / /about /how-it-works /for-researchers /faq /contact /privacy /terms /accessibility /waitlist /researchers/interest /opportunities /signin /dashboard /applications /saved /profile /notifications /researcher /researcher/opportunities /researcher/opportunities/new /researcher/applicants /admin /admin/users /admin/researchers /admin/opportunities /admin/applications /admin/institutions /admin/taxonomies /admin/system /api/health /robots.txt /sitemap.xml; do
  curl -s -o /dev/null -m 120 "http://localhost:3000$path" || true
done
echo "routes warm"

RB_DEV_LOG=$(cygpath -w "$LOG_PATH" 2>/dev/null || echo "$LOG_PATH") node scripts/e2e.mjs
