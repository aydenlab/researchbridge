#!/usr/bin/env bash
#
# Configures a Railway service for ResearchBridge.
#
# Run `railway login` and `railway link` first, then:
#
#   bash scripts/railway-setup.sh
#
# Pass secrets as environment variables rather than editing this file, so
# nothing sensitive is ever written to the repository:
#
#   ADMIN_EMAILS=you@example.com ANTHROPIC_API_KEY=sk-... bash scripts/railway-setup.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v railway >/dev/null 2>&1; then
  echo "The Railway CLI is not installed. Install it with: npm i -g @railway/cli"
  exit 1
fi

if ! railway whoami >/dev/null 2>&1; then
  echo "Not signed in to Railway. Run: railway login"
  exit 1
fi

echo "Signed in as: $(railway whoami)"
echo "Linked service:"
railway status || true
echo

DB_SERVICE="${DB_SERVICE:-Postgres}"
APP_URL="${APP_URL:-}"
ADMIN_EMAILS="${ADMIN_EMAILS:-}"
SESSION_SECRET="${SESSION_SECRET:-$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))")}"

if [ -z "$APP_URL" ]; then
  echo "APP_URL is required, for example:"
  echo "  APP_URL=https://researchbridge.up.railway.app bash scripts/railway-setup.sh"
  exit 1
fi

if [ -z "$ADMIN_EMAILS" ]; then
  echo "ADMIN_EMAILS is required so the first administrator can sign in on an empty database."
  exit 1
fi

echo "Setting variables on the linked service."

railway variables \
  --set "DATABASE_URL=\${{${DB_SERVICE}.DATABASE_URL}}" \
  --set "APP_URL=${APP_URL}" \
  --set "SESSION_SECRET=${SESSION_SECRET}" \
  --set "ADMIN_EMAILS=${ADMIN_EMAILS}" \
  --set "NODE_ENV=production" \
  --set "EMAIL_FROM=ResearchBridge <hello@myresearchbridge.com>" \
  --set "FILE_STORAGE_PROVIDER=local" \
  --set "AI_ANALYSIS_ENABLED=true" \
  --set "VIDEO_RESPONSES_ENABLED=false" \
  --set "WAITLIST_ENABLED=true" \
  --set "PUBLIC_SIGNUP_ENABLED=true" \
  --set "RESEARCHER_SIGNUP_ENABLED=true"

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  railway variables --set "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" --set "ANTHROPIC_MODEL=${ANTHROPIC_MODEL:-claude-sonnet-5}"
  echo "Anthropic credentials set."
else
  echo "ANTHROPIC_API_KEY not provided. The evidence layer stays off until it is set."
fi

if [ -n "${EMAIL_API_KEY:-}" ]; then
  railway variables --set "EMAIL_PROVIDER=resend" --set "EMAIL_API_KEY=${EMAIL_API_KEY}"
  echo "Email provider set to resend."
else
  railway variables --set "EMAIL_PROVIDER=console"
  echo "EMAIL_API_KEY not provided. Verification codes will be written to the server log only."
fi

echo
echo "Done. Redeploy, then open ${APP_URL}/api/ready to confirm the database is reachable and migrated."
