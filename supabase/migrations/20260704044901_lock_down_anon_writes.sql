/*
# Lock down anonymous writes (route mutations through validated gateway)

## Summary
The public client uses the anon key, so the previous `USING (true)` /
`WITH CHECK (true)` INSERT/UPDATE/DELETE policies let anyone with the embedded
key modify or delete any row via the REST API. All client mutations now go
through the `db-write` edge function, which runs with the service role (bypasses
RLS) and enforces a table + operation + column allowlist plus a mandatory row
filter. Server-owned tables (wildfires ingest, fire_updates, fire_risk_cells)
are written only by their edge functions, which also use the service role.

This migration removes every anonymous write policy. SELECT policies are left in
place so the app (and realtime subscriptions) can still read this public data.

## Modified Tables (RLS policies only — no data or column changes)
- `alert_rules`, `alerts`, `data_sources`, `fire_risk_cells`, `fire_updates`,
  `key_locations`, `notification_settings`, `wildfires`:
  - DROP the `anon_insert_*`, `anon_update_*`, and `anon_delete_*` policies.

## Security
1. After this change, the anon/authenticated roles can only SELECT these tables.
2. Writes succeed only via service-role edge functions (`db-write`,
   `fetch-external-alerts`, `scan-social-feeds`, `fetch-fire-risk`), which
   validate and constrain each operation.
3. No table data is modified; this only tightens access control.
*/

-- alert_rules
DROP POLICY IF EXISTS "anon_insert_alert_rules" ON alert_rules;
DROP POLICY IF EXISTS "anon_update_alert_rules" ON alert_rules;
DROP POLICY IF EXISTS "anon_delete_alert_rules" ON alert_rules;

-- alerts
DROP POLICY IF EXISTS "anon_insert_alerts" ON alerts;
DROP POLICY IF EXISTS "anon_update_alerts" ON alerts;
DROP POLICY IF EXISTS "anon_delete_alerts" ON alerts;

-- data_sources
DROP POLICY IF EXISTS "anon_insert_data_sources" ON data_sources;
DROP POLICY IF EXISTS "anon_update_data_sources" ON data_sources;
DROP POLICY IF EXISTS "anon_delete_data_sources" ON data_sources;

-- fire_risk_cells
DROP POLICY IF EXISTS "anon_insert_fire_risk_cells" ON fire_risk_cells;
DROP POLICY IF EXISTS "anon_update_fire_risk_cells" ON fire_risk_cells;
DROP POLICY IF EXISTS "anon_delete_fire_risk_cells" ON fire_risk_cells;

-- fire_updates
DROP POLICY IF EXISTS "anon_insert_fire_updates" ON fire_updates;
DROP POLICY IF EXISTS "anon_update_fire_updates" ON fire_updates;
DROP POLICY IF EXISTS "anon_delete_fire_updates" ON fire_updates;

-- key_locations
DROP POLICY IF EXISTS "anon_insert_key_locations" ON key_locations;
DROP POLICY IF EXISTS "anon_update_key_locations" ON key_locations;
DROP POLICY IF EXISTS "anon_delete_key_locations" ON key_locations;

-- notification_settings
DROP POLICY IF EXISTS "anon_insert_notification_settings" ON notification_settings;
DROP POLICY IF EXISTS "anon_update_notification_settings" ON notification_settings;

-- wildfires
DROP POLICY IF EXISTS "anon_insert_wildfires" ON wildfires;
DROP POLICY IF EXISTS "anon_update_wildfires" ON wildfires;
DROP POLICY IF EXISTS "anon_delete_wildfires" ON wildfires;