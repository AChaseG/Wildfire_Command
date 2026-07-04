/*
# Enable realtime for alerts

## Summary
Adds the `alerts` table to the `supabase_realtime` publication so the frontend
receives live INSERT/UPDATE/DELETE events. This powers global, automatic
population of alerts across the app as background source scans insert new rows.

## Notes
1. Idempotent: only adds the table if it is not already a member of the publication.
2. No schema/data changes.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
  END IF;
END $$;
