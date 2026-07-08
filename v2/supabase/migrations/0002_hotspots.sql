-- Wildfire Command v2 — satellite thermal detections (NASA FIRMS).
-- Separate from `fires`: these are ephemeral points (thousands per pass) with no
-- name or containment, rendered as a heatmap layer. Public read; writes via the
-- service role only, same posture as the rest of the schema.

create table if not exists hotspots (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'NASA FIRMS',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  brightness_k double precision,
  confidence text,
  frp double precision,
  detected_at timestamptz not null,
  satellite text,
  created_at timestamptz not null default now(),
  unique (latitude, longitude, detected_at, satellite)
);

create index if not exists hotspots_detected_idx on hotspots (detected_at desc);

alter table hotspots enable row level security;
create policy "public read hotspots" on hotspots
  for select to anon, authenticated using (true);
