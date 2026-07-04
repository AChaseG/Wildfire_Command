/*
# Create notification settings (single-tenant)

1. New Tables
- `notification_settings` (single shared row, keyed by id = 'default')
- `id` (text, primary key, always 'default')
- `slack_webhook_url` (text, nullable): Slack incoming webhook the app posts
  monitored-incident updates to.
- `enabled` (boolean, not null, default false): master switch for sending
  external notifications for monitored incidents.
- `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `notification_settings`.
- App has no sign-in, so allow anon + authenticated to read/insert/update the
  single shared configuration row. Delete is intentionally not exposed.

3. Notes
1. A single default row is seeded so the frontend can always update in place.
2. Idempotent: safe to re-run.
*/

CREATE TABLE IF NOT EXISTS notification_settings (
  id text PRIMARY KEY DEFAULT 'default',
  slack_webhook_url text,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO notification_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_select_notification_settings" ON notification_settings;
CREATE POLICY "anon_select_notification_settings" ON notification_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notification_settings" ON notification_settings;
CREATE POLICY "anon_insert_notification_settings" ON notification_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notification_settings" ON notification_settings;
CREATE POLICY "anon_update_notification_settings" ON notification_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);