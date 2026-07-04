/*
# Add Key Locations Table

## Summary
Creates a `key_locations` table so users can save named points of interest on the map
(e.g. "Home", "Office", "Evacuation Assembly Point"). The app automatically measures
and displays the distance from any selected fire incident to every saved key location.

## New Tables
- `key_locations`
  - `id` (uuid, primary key)
  - `name` (text, not null) — display name shown on map and in lists
  - `description` (text) — optional notes
  - `latitude` (float8, not null)
  - `longitude` (float8, not null)
  - `color` (text, default '#f0a020') — marker color
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled.
- Single-tenant (no sign-in), so anon + authenticated can do full CRUD.
  Data is intentionally shared/public within this single-tenant tool.

## Notes
1. No user_id column — this is a single-tenant, no-auth application.
2. Anon key frontend can read and write freely.
*/

CREATE TABLE IF NOT EXISTS key_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  latitude    float8 NOT NULL,
  longitude   float8 NOT NULL,
  color       text NOT NULL DEFAULT '#f0a020',
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE key_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_key_locations" ON key_locations;
CREATE POLICY "anon_select_key_locations" ON key_locations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_key_locations" ON key_locations;
CREATE POLICY "anon_insert_key_locations" ON key_locations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_key_locations" ON key_locations;
CREATE POLICY "anon_update_key_locations" ON key_locations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_key_locations" ON key_locations;
CREATE POLICY "anon_delete_key_locations" ON key_locations FOR DELETE
  TO anon, authenticated USING (true);
