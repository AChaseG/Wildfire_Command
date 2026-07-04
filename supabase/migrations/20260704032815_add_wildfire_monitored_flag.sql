/*
# Add incident monitoring flag

1. Modified Tables
- `wildfires`
- Adds `monitored` (boolean, not null, default false): when true, the app
  relays a message to the configured external notification target (Slack)
  every time a new update is posted for the incident.

2. Security
- No RLS change; existing wildfires policies continue to apply.

3. Notes
1. Idempotent: the column is only added if it does not already exist.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wildfires' AND column_name = 'monitored'
  ) THEN
    ALTER TABLE wildfires ADD COLUMN monitored boolean NOT NULL DEFAULT false;
  END IF;
END $$;