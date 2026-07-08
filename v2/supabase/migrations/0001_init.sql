-- Wildfire Command v2 — core schema.
--
-- Single-tenant, no sign-in. Read is public; every write goes through the
-- service role inside the ingestion functions, so there are NO anon/authenticated
-- write policies. This is the secure default from day one, rather than v1's
-- approach of opening anon writes and locking them down in a later migration.

create extension if not exists pgcrypto;

create table if not exists fires (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  name text not null,
  cause text,
  severity text not null default 'low' check (severity in ('low', 'moderate', 'high', 'extreme')),
  status text not null default 'active' check (status in ('active', 'contained', 'controlled', 'out')),
  containment_pct int not null default 0 check (containment_pct between 0 and 100),
  acres int not null default 0 check (acres >= 0),
  discovered_at timestamptz not null,
  ended_at timestamptz,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location_description text,
  wind_speed_mph double precision,
  wind_direction_deg double precision,
  aqi int,
  summary text,
  monitored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per incident per source; the ingester upserts on this.
  unique (source, external_id)
);

create index if not exists fires_status_idx on fires (status);
create index if not exists fires_severity_idx on fires (severity);
create index if not exists fires_discovered_idx on fires (discovered_at desc);

create table if not exists fire_updates (
  id uuid primary key default gen_random_uuid(),
  fire_id uuid not null references fires (id) on delete cascade,
  posted_at timestamptz not null default now(),
  kind text not null default 'general'
    check (kind in ('containment', 'evacuation', 'weather', 'air_quality', 'crews', 'general')),
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists fire_updates_fire_idx on fire_updates (fire_id, posted_at desc);

-- Observability for the ingestion pipeline: one row per connector run.
create table if not exists ingest_runs (
  id uuid primary key default gen_random_uuid(),
  connector text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  fetched int not null default 0,
  upserted int not null default 0,
  error text
);

create index if not exists ingest_runs_connector_idx on ingest_runs (connector, started_at desc);

alter table fires enable row level security;
alter table fire_updates enable row level security;
alter table ingest_runs enable row level security;

-- Public read-only. Writes require the service role (which bypasses RLS); no
-- write policy is ever granted to anon/authenticated.
create policy "public read fires" on fires
  for select to anon, authenticated using (true);
create policy "public read fire_updates" on fire_updates
  for select to anon, authenticated using (true);
create policy "public read ingest_runs" on ingest_runs
  for select to anon, authenticated using (true);
