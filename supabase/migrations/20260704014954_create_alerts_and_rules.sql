/*
# Create alerts and alert_rules tables (single-tenant, no auth)

1. Overview
This migration adds a Dataminr-style alerting system on top of the existing
wildfires data. There are two new tables:

- `alert_rules`: user-defined rules that generate alerts when wildfire data
  matches certain conditions (severity threshold, AQI threshold, containment
  threshold, status, or keyword). Rules are evaluated client-side against the
  current wildfire dataset; matching fires produce alerts.
- `alerts`: the generated alert instances. Each alert references the fire and
  rule that produced it, has a severity tier (flash / urgent / high / medium /
  low), a category, an AI-style summary, source attribution, and an
  acknowledged flag so users can dismiss alerts they've reviewed.

The app has no sign-in screen, so both tables are intentionally public/shared
and readable/writable by the anon key.

2. New Tables

- `alert_rules`
  - `id` (uuid, primary key)
  - `name` (text, not null) — user-given rule name
  - `enabled` (boolean, default true)
  -severity_min` (text) — minimum wildfire severity to match: 'low' | 'moderate' | 'high' | 'extreme'
  - `aqi_min` (int) — minimum AQI to match (null = no AQI filter)
  - `containment_max` (int) — maximum containment % to match (null = no filter)
  - `status` (text) — wildfire status to match (null = any)
  - `keyword` (text) — case-insensitive substring to match against fire name/summary
  - `alert_severity` (text, not null) — the tier assigned to generated alerts:
    'flash' | 'urgent' | 'high' | 'medium' | 'low'
  - `category` (text, not null) — alert category: 'wildfire' | 'air_quality' |
    'evacuation' | 'weather' | 'containment' | 'general'
  - `created_at` (timestamptz, default now())

- `alerts`
  - `id` (uuid, primary key)
  - `rule_id` (uuid, FK to alert_rules, on delete set null)
  - `fire_id` (uuid, FK to wildfires, on delete cascade)
  - `severity` (text, not null) — 'flash' | 'urgent' | 'high' | 'medium' | 'low'
  - `category` (text, not null)
  - `headline` (text, not null) — short alert title
  - `summary` (text, not null) — AI-style multi-sentence summary
  - `source` (text, not null) — e.g. 'NASA FIRMS', 'PurpleAir', 'Wildfire.gov'
  - `latitude` (numeric)
  - `longitude` (numeric)
  - `acknowledged` (boolean, default false)
  - `acknowledged_at` (timestamptz, nullable)
  - `generated_at` (timestamptz, not null, default now())
  - `created_at` (timestamptz, not null, default now())

3. Indexes
- `alerts_unacknowledged_idx` on (acknowledged, generated_at desc) for the
  unread alerts badge and the default feed sort.
- `alerts_severity_idx` on (severity).
- `alert_rules_enabled_idx` on (enabled).

4. Security
- RLS enabled on both tables.
- Both tables are intentionally public/shared (no sign-in screen), so all CRUD
  policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.
  This is the documented single-tenant pattern.

5. Notes
- `alert_rules.severity_min` uses the same four tiers as `wildfires.severity`.
- Generated alerts store a snapshot of the fire's location at generation time
  so the map can plot alerts even if the fire later moves or is deleted.
- The `acknowledged` flag lets users dismiss alerts; acknowledged alerts stay
  in the feed but are visually de-emphasized and excluded from the badge count.
*/

CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  severity_min text CHECK (severity_min IS NULL OR severity_min IN ('low', 'moderate', 'high', 'extreme')),
  aqi_min int,
  containment_max int CHECK (containment_max IS NULL OR (containment_max >= 0 AND containment_max <= 100)),
  status text CHECK (status IS NULL OR status IN ('active', 'contained', 'controlled', 'out')),
  keyword text,
  alert_severity text NOT NULL CHECK (alert_severity IN ('flash', 'urgent', 'high', 'medium', 'low')),
  category text NOT NULL CHECK (category IN ('wildfire', 'air_quality', 'evacuation', 'weather', 'containment', 'general')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_rules_enabled_idx ON alert_rules(enabled);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
  fire_id uuid REFERENCES wildfires(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('flash', 'urgent', 'high', 'medium', 'low')),
  category text NOT NULL CHECK (category IN ('wildfire', 'air_quality', 'evacuation', 'weather', 'containment', 'general')),
  headline text NOT NULL,
  summary text NOT NULL,
  source text NOT NULL,
  latitude numeric,
  longitude numeric,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_unacknowledged_idx ON alerts(acknowledged, generated_at DESC);
CREATE INDEX IF NOT EXISTS alerts_severity_idx ON alerts(severity);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- alert_rules policies (single-tenant, intentionally public)
DROP POLICY IF EXISTS "anon_select_alert_rules" ON alert_rules;
CREATE POLICY "anon_select_alert_rules" ON alert_rules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_alert_rules" ON alert_rules;
CREATE POLICY "anon_insert_alert_rules" ON alert_rules FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_alert_rules" ON alert_rules;
CREATE POLICY "anon_update_alert_rules" ON alert_rules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_alert_rules" ON alert_rules;
CREATE POLICY "anon_delete_alert_rules" ON alert_rules FOR DELETE
  TO anon, authenticated USING (true);

-- alerts policies (single-tenant, intentionally public)
DROP POLICY IF EXISTS "anon_select_alerts" ON alerts;
CREATE POLICY "anon_select_alerts" ON alerts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_alerts" ON alerts;
CREATE POLICY "anon_insert_alerts" ON alerts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_alerts" ON alerts;
CREATE POLICY "anon_update_alerts" ON alerts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_alerts" ON alerts;
CREATE POLICY "anon_delete_alerts" ON alerts FOR DELETE
  TO anon, authenticated USING (true);
