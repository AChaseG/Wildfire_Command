/*
# Add geographic filters to alert_rules + create data_sources table

1. Overview
This migration adds two capabilities:
  a) Geographic alert rule filters: alert rules can now be scoped to either a
     drawn polygon (array of lat/lng points) or a radius around a center point.
     When a rule has a geographic filter, only fires whose coordinates fall
     inside the polygon or within the radius will generate alerts.
  b) A data_sources table: a configurable list of external data sources the
     tool pulls from (GDACS, FEMA, Watch Duty, WA DNR, fire departments, radio
     scanners, etc.). Users can add, enable/disable, and categorize sources
     through the UI.

2. Modified Tables
- `alert_rules`
  - `geo_type` (text, nullable) — 'polygon' or 'radius' (null = no geo filter)
  - `geo_polygon` (jsonb, nullable) — array of {lat, lng} points defining the
    polygon (first and last point should be the same to close it)
  - `geo_center_lat` (numeric, nullable) — center latitude for radius mode
  - `geo_center_lng` (numeric, nullable) — center longitude for radius mode
  - `geo_radius_m` (numeric, nullable) — radius in meters for radius mode

3. New Tables
- `data_sources`
  - `id` (uuid, primary key)
  - `name` (text, not null) — display name
  - `url` (text, not null) — source URL
  - `category` (text, not null) — 'official' | 'fire_dept' | 'radio' | 'social' | 'volunteer' | 'news'
  - `description` (text) — what the source provides
  - `enabled` (boolean, default true)
  - `is_default` (boolean, default false) — true for built-in sources that can't be deleted
  - `created_at` (timestamptz, default now())

4. Indexes
- `data_sources_enabled_idx` on (enabled)
- `data_sources_category_idx` on (category)

5. Security
- RLS enabled on data_sources.
- Single-tenant (no sign-in), so all CRUD uses `TO anon, authenticated` with
  `USING (true)` / `WITH CHECK (true)`.

6. Notes
- `geo_polygon` is stored as jsonb (array of {lat, lng} objects) rather than a
  PostGIS geometry for simplicity — the polygon is small (drawn on a mini map)
  and point-in-polygon is evaluated client-side.
- `is_default` marks the 11 built-in sources so the UI can prevent deletion
  while still allowing enable/disable toggles.
*/

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS geo_type text CHECK (geo_type IS NULL OR geo_type IN ('polygon', 'radius')),
  ADD COLUMN IF NOT EXISTS geo_polygon jsonb,
  ADD COLUMN IF NOT EXISTS geo_center_lat numeric,
  ADD COLUMN IF NOT EXISTS geo_center_lng numeric,
  ADD COLUMN IF NOT EXISTS geo_radius_m numeric;

CREATE TABLE IF NOT EXISTS data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  category text NOT NULL CHECK (category IN ('official', 'fire_dept', 'radio', 'social', 'volunteer', 'news')),
  description text,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_sources_enabled_idx ON data_sources(enabled);
CREATE INDEX IF NOT EXISTS data_sources_category_idx ON data_sources(category);

ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_data_sources" ON data_sources;
CREATE POLICY "anon_select_data_sources" ON data_sources FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_data_sources" ON data_sources;
CREATE POLICY "anon_insert_data_sources" ON data_sources FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_data_sources" ON data_sources;
CREATE POLICY "anon_update_data_sources" ON data_sources FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_data_sources" ON data_sources;
CREATE POLICY "anon_delete_data_sources" ON data_sources FOR DELETE
  TO anon, authenticated USING (true);
