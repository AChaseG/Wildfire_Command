/*
# Add data source attribution to wildfire incidents

## Summary
Adds provenance to each incident so the UI can show which feed the data was
pulled from. Two nullable text columns are added and existing rows are
backfilled with a sensible authoritative source based on the incident's region.

## Modified Tables
- `wildfires`
  - `source` (text) — human-readable name of the originating data feed
    (e.g. "Wildfire.gov (EGP)", "Copernicus EMS", "GDACS").
  - `source_url` (text) — link to that feed, shown as a clickable attribution.

## Backfill (existing rows only, where source IS NULL)
1. US / Canada incidents (lon between -170 and -50, lat > 15) -> Wildfire.gov (EGP).
2. European incidents (lat 34..72, lon -12..45) -> Copernicus EMS.
3. All other regions -> GDACS.

## Security
- No RLS or policy changes. Additive, nullable columns only; no data loss.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wildfires' AND column_name = 'source'
  ) THEN
    ALTER TABLE wildfires ADD COLUMN source text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wildfires' AND column_name = 'source_url'
  ) THEN
    ALTER TABLE wildfires ADD COLUMN source_url text;
  END IF;
END $$;

UPDATE wildfires
SET source = 'Wildfire.gov (EGP)',
    source_url = 'https://www.wildfire.gov/application/egp'
WHERE source IS NULL
  AND longitude BETWEEN -170 AND -50
  AND latitude > 15;

UPDATE wildfires
SET source = 'Copernicus EMS',
    source_url = 'https://emergency.copernicus.eu/'
WHERE source IS NULL
  AND latitude BETWEEN 34 AND 72
  AND longitude BETWEEN -12 AND 45;

UPDATE wildfires
SET source = 'GDACS',
    source_url = 'https://gdacs.org'
WHERE source IS NULL;