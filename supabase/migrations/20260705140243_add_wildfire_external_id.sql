/*
# Add external_id for live incident ingestion (NIFC WFIGS / IRWIN)

## Summary
Adds a stable external identifier to wildfire incidents so a live ingestion
edge function can upsert real incidents (deduped by their upstream ID) without
creating duplicates. The primary source is NIFC WFIGS, keyed by IRWIN ID.

## Modified Tables
- `wildfires`
  - `external_id` (text, nullable, unique) — upstream stable key (e.g. IRWIN ID).
    Nullable so pre-existing seed rows are unaffected; Postgres permits multiple
    NULLs under a unique constraint.

## Indexes / Constraints
- Unique constraint `wildfires_external_id_key` on `external_id` — required for
  ON CONFLICT upserts from the ingestion function.

## Security
- No RLS changes. Additive, nullable column only; no data loss.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wildfires' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE wildfires ADD COLUMN external_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wildfires_external_id_key'
  ) THEN
    ALTER TABLE wildfires ADD CONSTRAINT wildfires_external_id_key UNIQUE (external_id);
  END IF;
END $$;
