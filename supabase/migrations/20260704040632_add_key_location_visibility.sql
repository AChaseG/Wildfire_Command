/*
# Add visibility flag to key locations

## Summary
Adds a `visible` boolean to the `key_locations` table so users can toggle
whether a saved location (including favorites) is drawn on the map without
having to delete it.

## Modified Tables
- `key_locations`
  - `visible` (boolean, not null, default true) — when false the marker is
    hidden from the map. Existing rows default to visible.

## Security
- No RLS changes. Existing single-tenant anon+authenticated policies still apply.

## Notes
1. Additive, defaulted column, so no existing data is lost.
2. Idempotent: guarded with an IF NOT EXISTS check.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'key_locations' AND column_name = 'visible'
  ) THEN
    ALTER TABLE key_locations ADD COLUMN visible boolean NOT NULL DEFAULT true;
  END IF;
END $$;