#!/usr/bin/env bash
#
# One-command "go live" for Wildfire Command v2. Links the Supabase project,
# applies migrations, deploys the ingest function, sets optional API keys,
# schedules ingestion (every 10 min), and builds the frontend. Idempotent.
#
# Auth: the Supabase CLI reads SUPABASE_ACCESS_TOKEN from the environment
# (create one at https://supabase.com/dashboard/account/tokens) so nothing
# secret is passed on the command line.
#
# Required env:
#   SUPABASE_ACCESS_TOKEN   Supabase personal access token
#   PROJECT_REF             Project Settings -> General -> Reference ID
#   SUPABASE_DB_PASSWORD    database password (Project Settings -> Database)
#   SUPABASE_DB_URL         Postgres connection string (for the cron schedule)
#   ANON_KEY                anon public key (used by the scheduled cron call)
# Optional env:
#   FIRMS_MAP_KEY           enables NASA FIRMS hotspot ingestion
#   PURPLEAIR_API_KEY       enables PurpleAir AQI enrichment
#
# Usage (from the v2 directory):
#   SUPABASE_ACCESS_TOKEN=... PROJECT_REF=... SUPABASE_DB_PASSWORD=... \
#   SUPABASE_DB_URL=... ANON_KEY=... ./scripts/go-live.sh
#
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"
: "${PROJECT_REF:?set PROJECT_REF}"
: "${SUPABASE_DB_PASSWORD:?set SUPABASE_DB_PASSWORD}"
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL}"
: "${ANON_KEY:?set ANON_KEY}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Linking project $PROJECT_REF..."
supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"

echo "==> Applying migrations..."
supabase db push

if [ -n "${FIRMS_MAP_KEY:-}" ]; then
  echo "==> Setting FIRMS_MAP_KEY secret..."
  supabase secrets set "FIRMS_MAP_KEY=$FIRMS_MAP_KEY" --project-ref "$PROJECT_REF"
fi
if [ -n "${PURPLEAIR_API_KEY:-}" ]; then
  echo "==> Setting PURPLEAIR_API_KEY secret..."
  supabase secrets set "PURPLEAIR_API_KEY=$PURPLEAIR_API_KEY" --project-ref "$PROJECT_REF"
fi

echo "==> Deploying + scheduling the ingest pipeline..."
./scripts/deploy-ingest.sh

echo "==> Building the frontend..."
npm ci
npm run build

echo ""
echo "==> Backend is live. Final step: host the built ./dist with these env vars:"
echo "      VITE_SUPABASE_URL=https://$PROJECT_REF.supabase.co"
echo "      VITE_SUPABASE_ANON_KEY=$ANON_KEY"
echo "    (optionally VITE_MAP_STYLE=<keyless vector style URL> for a basemap)"
echo "    e.g. 'vercel --prod' or 'netlify deploy --prod --dir=dist'."
