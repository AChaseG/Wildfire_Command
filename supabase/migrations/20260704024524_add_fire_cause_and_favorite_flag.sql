/*
# Add fire cause and favorite location flag

## Summary
Adds a `cause` column to the `wildfires` table so incident detail can report the
cause of ignition, and an `is_favorite` boolean to `key_locations` so locations
added via the new map "favorite" button render with a distinct star icon.

## Modified Tables
- `wildfires`
  - `cause` (text, nullable) — cause of the fire (e.g. "Lightning", "Human - campfire",
    "Under investigation"). Null means unknown / not yet determined.
- `key_locations`
  - `is_favorite` (boolean, not null, default false) — true when the location was
    dropped as a favorite from the map; rendered with a star icon.

## Security
- No RLS changes. Existing single-tenant anon+authenticated policies still apply.

## Notes
1. Both columns are additive and nullable / defaulted, so no existing data is lost.
2. Idempotent: guarded with IF NOT EXISTS checks.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wildfires' AND column_name = 'cause'
  ) THEN
    ALTER TABLE wildfires ADD COLUMN cause text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'key_locations' AND column_name = 'is_favorite'
  ) THEN
    ALTER TABLE key_locations ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
  END IF;
END $$;
