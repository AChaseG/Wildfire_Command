/*
# Create fire risk cells cache

## Summary
Adds a `fire_risk_cells` table used to cache a gridded, predictive wildfire-risk
field derived from live fire-weather and fuel-moisture data (temperature,
relative humidity, wind speed, recent precipitation, and soil moisture) fetched
from the Open-Meteo API by the `fetch-fire-risk` edge function. The map heatmap
reads these cells so it reflects conditions that make wildfires likely to start
or spread, rather than being derived from existing incidents.

## New Tables
- `fire_risk_cells`
  - `id` (uuid, primary key)
  - `grid_key` (text, unique) — rounded "lat_lng" key so repeated samples of the
    same grid cell upsert in place instead of duplicating.
  - `latitude` (float8, not null)
  - `longitude` (float8, not null)
  - `risk` (float8, not null) — normalized 0..1 composite fire-weather danger.
  - `temperature` (float8) — deg C.
  - `humidity` (float8) — relative humidity %.
  - `wind_speed` (float8) — km/h.
  - `precipitation` (float8) — mm (recent).
  - `soil_moisture` (float8) — volumetric soil moisture (fuel-moisture proxy).
  - `computed_at` (timestamptz, default now())

## Security
- RLS enabled.
- Single-tenant (no sign-in): anon + authenticated may read and write, since the
  risk field is intentionally shared/public within this tool.

## Notes
1. `grid_key` unique constraint enables ON CONFLICT upserts from the edge function.
2. Index on (latitude, longitude) for viewport queries.
*/

CREATE TABLE IF NOT EXISTS fire_risk_cells (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_key      text UNIQUE NOT NULL,
  latitude      float8 NOT NULL,
  longitude     float8 NOT NULL,
  risk          float8 NOT NULL DEFAULT 0,
  temperature   float8,
  humidity      float8,
  wind_speed    float8,
  precipitation float8,
  soil_moisture float8,
  computed_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fire_risk_cells_lat_lng_idx ON fire_risk_cells (latitude, longitude);

ALTER TABLE fire_risk_cells ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fire_risk_cells" ON fire_risk_cells;
CREATE POLICY "anon_select_fire_risk_cells" ON fire_risk_cells FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fire_risk_cells" ON fire_risk_cells;
CREATE POLICY "anon_insert_fire_risk_cells" ON fire_risk_cells FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fire_risk_cells" ON fire_risk_cells;
CREATE POLICY "anon_update_fire_risk_cells" ON fire_risk_cells FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fire_risk_cells" ON fire_risk_cells;
CREATE POLICY "anon_delete_fire_risk_cells" ON fire_risk_cells FOR DELETE
  TO anon, authenticated USING (true);