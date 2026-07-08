# Wildfire Command v2

A ground-up rebuild of Wildfire Command on **Vite + TypeScript + MapLibre GL**,
built on the same ideas and data sources as the original but with a typed
domain core, a schema-first database, secure-by-default ingestion, and CI.

It lives in `v2/` alongside the original app so the two can be compared.

## Why this shape

- **TypeScript end-to-end**, with DB types (`src/types/database.ts`) shared into
  a typed Supabase client — a column rename becomes a compile error, not a
  runtime surprise.
- **A pure `src/domain/` layer** — severity, status resolution, units, geo — as
  small, fully unit-tested functions instead of logic spread across components.
- **Secure-by-default schema** — public read, writes only via the service role;
  no anon write policies to lock down later.
- **MapLibre GL** (WebGL vector maps) for the map, landing in a later slice —
  built to render thousands of hotspots and fire perimeters smoothly.

## Build slices

| Slice | Scope | Status |
| ----- | ----- | ------ |
| 1 | Foundation: TS scaffold, schema, domain layer (tested), CI | ✅ |
| 2 | Ingestion orchestrator + WFIGS connector on a pg_cron schedule | ✅ |
| 3 | Core UI: MapLibre map, incident list, incident detail | ✅ |
| 4 | FIRMS hotspots + wind/AQI enrichment + realtime + alerts feed | ✅ |
| 5 | Polish: theming, units, key locations, measure tool | ✅ |

## Develop

```bash
cd v2
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev        # start the app
npm test           # run the domain unit tests
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
```

## UI

A three-pane console (`src/App.tsx`): an incident list with search + status
filters, a **MapLibre GL** map (`src/map/FireMap.tsx`) rendering fires as
severity-colored WebGL circle layers with a selected-feature highlight, and an
incident detail panel with the per-incident updates feed. Data is fetched with
TanStack Query (`src/data/`); with no Supabase project configured the app runs
on fixtures ("demo data") so it is fully explorable offline.

The map defaults to a self-contained inline style; set `VITE_MAP_STYLE` to a
keyless vector style (e.g. OpenFreeMap or MapTiler) for a full basemap in
production.

Polish (slice 5): light/dark theme and imperial/metric units (context-based,
persisted to localStorage, defaulting to the OS preference); locally-saved key
locations dropped by clicking the map in "place" mode; and a measure tool that
sums great-circle distance along clicked points using the domain `haversineKm`.

## Ingestion

A single `ingest` edge function (`supabase/functions/ingest/`) runs a registry
of typed **connectors**. Each connector targets a fixed, trusted source (no
caller-supplied URLs, so no SSRF surface) and returns rows ready to upsert; the
orchestrator persists them with the service role, logs every change to
`fire_updates`, and records each run in `ingest_runs`. Adding a source is a new
module in `_shared/connectors/` plus one line in the orchestrator's registry.

Connector parsing is kept **pure** (e.g. `parseWfigs`) so it is unit-tested with
fixtures and no network. A parity test asserts the connector's Deno-side
`severityFromAcres` stays in step with the browser domain's copy.

Deploy the pipeline and schedule it (every 10 min) with one command:

```bash
cd v2
PROJECT_REF=… ANON_KEY=… SUPABASE_DB_URL=… ./scripts/deploy-ingest.sh
```

## Database

Schema lives in `supabase/migrations/`. Apply it with `supabase db push`
(from a project linked via `supabase link`). Regenerate `src/types/database.ts`
after schema changes with `supabase gen types typescript --local`.
