/*
# Create wildfires and fire_updates tables (single-tenant, no auth)

1. Overview
This migration creates the data model for a wildfire tracking application.
It stores active and historical wildfire incidents along with a feed of
time-ordered updates for each fire. The app has no sign-in screen, so the
data is intentionally public/shared and readable/writable by the anon key.

2. New Tables
- `wildfires`
  - `id` (uuid, primary key)
  - `name` (text, not null) — human-readable fire name, e.g. "Smith River Fire"
  - `severity` (text, not null) — one of 'low', 'moderate', 'high', 'extreme'
  - `status` (text, not null) — one of 'active', 'contained', 'controlled', 'out'
  - `containment_pct` (int, default 0) — 0–100 percent contained
  - `air_quality` (int) — US EPA AQI value at the fire location
  - `wind_speed` (numeric) — wind speed in mph
  - `wind_direction` (text) — cardinal direction, e.g. 'NW'
  - `acreage_burned` (int) — acres burned so far
  - `started_at` (timestamptz, not null) — when the fire started
  - `ended_at` (timestamptz, nullable) — when the fire was declared out
  - `latitude` (numeric, not null)
  - `longitude` (numeric, not null)
  - `location_description` (text) — e.g. "Chelan County, WA"
  - `summary` (text) — short narrative description
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

- `fire_updates`
  - `id` (uuid, primary key)
  - `fire_id` (uuid, FK to wildfires, on delete cascade)
  - `posted_at` (timestamptz, not null) — when the update was issued
  - `title` (text, not null) — short headline for the update
  - `content` (text, not null) — full update body
  - `category` (text, not null) — one of 'containment', 'evacuation', 'weather', 'air_quality', 'containment', 'crews', 'general'
  - `created_at` (timestamptz, default now())

3. Indexes
- `wildfires_status_idx` on `wildfires(status)` for filtering active fires.
- `wildfires_severity_idx` on `wildfires(severity)`.
- `fire_updates_fire_id_posted_at_idx` on `fire_updates(fire_id, posted_at desc)` for
  efficiently fetching the most recent updates for a selected fire.

4. Security
- Enable RLS on both tables.
- Both tables are intentionally public/shared (no sign-in screen), so all
  CRUD policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.
  This is the documented single-tenant pattern, not an ownership shortcut.

5. Notes
- `ended_at` is nullable because active fires have no end time yet.
- `air_quality`, `wind_speed`, and `wind_direction` are stored as static
  snapshots reflecting the most recent reading at the fire location.
- The `updated_at` column is maintained by the application; no trigger is
  added in this migration to keep the schema minimal.
*/

CREATE TABLE IF NOT EXISTS wildfires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'moderate', 'high', 'extreme')),
  status text NOT NULL CHECK (status IN ('active', 'contained', 'controlled', 'out')),
  containment_pct int NOT NULL DEFAULT 0 CHECK (containment_pct >= 0 AND containment_pct <= 100),
  air_quality int,
  wind_speed numeric,
  wind_direction text,
  acreage_burned int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  location_description text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wildfires_status_idx ON wildfires(status);
CREATE INDEX IF NOT EXISTS wildfires_severity_idx ON wildfires(severity);

CREATE TABLE IF NOT EXISTS fire_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fire_id uuid NOT NULL REFERENCES wildfires(id) ON DELETE CASCADE,
  posted_at timestamptz NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL CHECK (category IN ('containment', 'evacuation', 'weather', 'air_quality', 'crews', 'general')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fire_updates_fire_id_posted_at_idx
  ON fire_updates(fire_id, posted_at DESC);

ALTER TABLE wildfires ENABLE ROW LEVEL SECURITY;
ALTER TABLE fire_updates ENABLE ROW LEVEL SECURITY;

-- wildfires policies (single-tenant, intentionally public)
DROP POLICY IF EXISTS "anon_select_wildfires" ON wildfires;
CREATE POLICY "anon_select_wildfires" ON wildfires FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wildfires" ON wildfires;
CREATE POLICY "anon_insert_wildfires" ON wildfires FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wildfires" ON wildfires;
CREATE POLICY "anon_update_wildfires" ON wildfires FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wildfires" ON wildfires;
CREATE POLICY "anon_delete_wildfires" ON wildfires FOR DELETE
  TO anon, authenticated USING (true);

-- fire_updates policies (single-tenant, intentionally public)
DROP POLICY IF EXISTS "anon_select_fire_updates" ON fire_updates;
CREATE POLICY "anon_select_fire_updates" ON fire_updates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fire_updates" ON fire_updates;
CREATE POLICY "anon_insert_fire_updates" ON fire_updates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fire_updates" ON fire_updates;
CREATE POLICY "anon_update_fire_updates" ON fire_updates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fire_updates" ON fire_updates;
CREATE POLICY "anon_delete_fire_updates" ON fire_updates FOR DELETE
  TO anon, authenticated USING (true);
