/*
  # Add verification metadata to data_sources

  1. Purpose
  When a URL data source is added, the app automatically checks whether data can
  actually be pulled from it (server-side reachability probe). This migration
  stores the outcome of that check so the UI can show each source's status.

  2. Modified Tables
  - `data_sources`
    - `verify_status` (text, nullable) — 'pending' | 'ok' | 'unreachable' | 'error'
      (null = never checked, e.g. KML uploads which need no remote fetch)
    - `verify_checked_at` (timestamptz, nullable) — when the last check ran
    - `verify_detail` (text, nullable) — short human-readable result, e.g.
      "HTTP 200 · text/html · 18 KB" or an error message

  3. Notes
  - No data is removed or altered; only new nullable columns are added.
  - Writes to these columns are performed by the `verify-source` edge function
    using the service role, so no anon write policy changes are required.
*/

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS verify_status text
    CHECK (verify_status IS NULL OR verify_status IN ('pending', 'ok', 'unreachable', 'error')),
  ADD COLUMN IF NOT EXISTS verify_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS verify_detail text;
