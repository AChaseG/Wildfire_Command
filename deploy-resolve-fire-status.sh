#!/usr/bin/env bash
#
# One-command deploy for the wildfire auto-resolve feature (Option B: fully
# server-side, no frontend/Slack involvement). Deploys the resolve-fire-status
# edge function and installs a pg_cron job that invokes it every 2 minutes.
# Safe to re-run: the schedule is replaced, not duplicated.
#
# Requirements: supabase CLI (logged in), psql, and these three values.
# Find them in your Supabase dashboard:
#   PROJECT_REF     Project Settings -> General -> Reference ID
#   ANON_KEY        Project Settings -> API -> anon public key
#   SUPABASE_DB_URL Project Settings -> Database -> Connection string (URI)
#
# Usage (from the repo root):
#   PROJECT_REF=abcd ANON_KEY=eyJ... \
#   SUPABASE_DB_URL='postgresql://postgres:PW@db.abcd.supabase.co:5432/postgres' \
#   ./deploy-resolve-fire-status.sh
#
set -euo pipefail

: "${PROJECT_REF:?set PROJECT_REF to your Supabase project ref}"
: "${ANON_KEY:?set ANON_KEY to the anon public key}"
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL to the Postgres connection string}"

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "==> Deploying edge function 'resolve-fire-status'..."
supabase functions deploy resolve-fire-status --project-ref "$PROJECT_REF"

echo "==> Installing 2-minute pg_cron schedule..."
# Values are passed as psql variables (:'ref' / :'anon') so nothing is
# interpolated by the shell; the command string is assembled with format(%L)
# so it is safely quoted when stored in cron.job.
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -v ref="$PROJECT_REF" -v anon="$ANON_KEY" <<'SQL'
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop any prior copy so re-runs don't stack duplicates (no-op if absent).
select cron.unschedule(jobid) from cron.job where jobname = 'resolve-fire-status-2min';

select cron.schedule(
  'resolve-fire-status-2min',
  '*/2 * * * *',
  format(
    'select net.http_post(url := %L, headers := %L::jsonb);',
    'https://' || :'ref' || '.supabase.co/functions/v1/resolve-fire-status',
    '{"Authorization":"Bearer ' || :'anon' || '","Content-Type":"application/json"}'
  )
);
SQL

echo "==> Done. 'resolve-fire-status' is live and runs every 2 minutes."
echo "    Inspect the job: select * from cron.job where jobname = 'resolve-fire-status-2min';"
echo "    Recent runs:     select * from cron.job_run_details order by start_time desc limit 5;"
