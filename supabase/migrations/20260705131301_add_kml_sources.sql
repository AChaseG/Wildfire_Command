/*
# Add KML file support to data_sources

1. Overview
Extends the existing `data_sources` table so a source can be either a
remote URL feed (the existing behavior) or an uploaded KML file whose raw
XML is stored inline. KML sources render as overlays (perimeters, evacuation
zones, points of interest) on the main map and can be toggled on/off.

2. Modified Table
- `data_sources`
  - `source_kind` (text, not null, default 'url') — 'url' | 'kml'
  - `kml_content` (text, nullable) — raw KML XML for uploaded KML sources
  - `visible` (boolean, not null, default true) — whether a KML overlay is drawn on the map

3. Security
- No policy changes. The table already has RLS enabled; direct anon writes are
  blocked and all mutations flow through the db-write edge function gateway.

4. Notes
- Idempotent: uses ADD COLUMN IF NOT EXISTS and a guarded CHECK constraint so
  re-running is safe. No data is dropped or altered.
- The `url` column stays NOT NULL at the DB level; the gateway/app supply a
  placeholder ("kml://<filename>") for KML rows to satisfy it without a
  destructive schema change.
*/

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'url',
  ADD COLUMN IF NOT EXISTS kml_content text,
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'data_sources_source_kind_check'
  ) THEN
    ALTER TABLE data_sources
      ADD CONSTRAINT data_sources_source_kind_check
      CHECK (source_kind IN ('url', 'kml'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS data_sources_source_kind_idx ON data_sources(source_kind);
