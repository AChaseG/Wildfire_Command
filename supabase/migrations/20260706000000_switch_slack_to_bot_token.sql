/*
# Switch Slack notifications from Incoming Webhook to Bot token + Web API

Incoming Webhooks store a secret URL that the app previously kept in this table
(client-readable) and passed through the browser. We now post via the Slack Web
API (`chat.postMessage`) using a bot token held server-side as the
`SLACK_BOT_TOKEN` edge-function secret, so the only thing configured here is the
destination channel id — which is not a secret.

1. Changes
- Add `slack_channel_id` (text, nullable): the Slack channel the bot posts to
  (e.g. "C0123ABCD"). The bot must be invited to this channel.
- Drop `slack_webhook_url`: the webhook path is removed. Any previously stored
  webhook URL is intentionally discarded — it is no longer used and should be
  revoked in Slack.

2. Notes
- Idempotent: safe to re-run.
- RLS is unchanged; the column remains SELECT-only for anon/authenticated and is
  written only through the db-write gateway (service role).
*/

ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS slack_channel_id text;
ALTER TABLE notification_settings DROP COLUMN IF EXISTS slack_webhook_url;
