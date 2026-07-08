#!/usr/bin/env bash
#
# One-command deploy for the v2 ingestion pipeline. Deploys the `ingest`
# orchestrator (which bundles the shared connectors) and installs a pg_cron job
# that runs it every 10 minutes. Safe to re-run: the schedule is replaced.
#
# Requirements: supabase CLI (logged in), psql, and these three values from your
# Supabase dashboard:
#   PROJECT_REF     Project Settings -> General -> Reference ID
#   ANON_KEY        Project Settings -> API -> anon public key
#   SUPABASE_DB_URL Project Settings -> Database -> Connection string (URI)
#
# Usage (from the v2 directory):
#   PROJECT_REF=abcd ANON_KEY=eyJ... \
#   SUPABASE_DB_URL='postgresql://postgres:PW@db.abcd.supabase.co:5432/postgres' \
#   ./scripts/deploy-ingest.sh
#
set -euo pipefail

: "${PROJECT_REF:?set PROJECT_REF to the Supabase project ref}"
: "${ANON_KEY:?set ANON_KEY to the anon public key}"
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL to the Postgres connection string}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "==> Deploying edge function 'ingest'..."
supabase functions deploy ingest --project-ref "$PROJECT_REF"

echo "==> Installing 10-minute pg_cron schedule..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v ref="$PROJECT_REF" -v anon="$ANON_KEY" <<'SQL'
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'wildfire-ingest-10min';

select cron.schedule(
  'wildfire-ingest-10min',
  '*/10 * * * *',
  format(
    'select net.http_post(url := %L, headers := %L::jsonb);',
    'https://' || :'ref' || '.supabase.co/functions/v1/ingest',
    '{"Authorization":"Bearer ' || :'anon' || '","Content-Type":"application/json"}'
  )
);
SQL

echo "==> Done. 'ingest' is live and runs every 10 minutes."
echo "    Recent runs: select * from ingest_runs order by started_at desc limit 10;"
