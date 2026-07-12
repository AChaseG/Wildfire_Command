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

## Run in a Codespace

The repo ships a `.devcontainer`, so you can view the app live with no local
setup: on GitHub, **Code → Codespaces → New with options…**, pick the branch
with `v2/`, and create it. The container installs deps, auto-starts the Vite dev
server, and forwards port **5173** with a preview. It runs in **live** mode by
default, so you'll see real WFIGS incidents on the CARTO basemap.

## UI

A three-pane console (`src/App.tsx`): an incident list with search + status
filters, a **MapLibre GL** map (`src/map/FireMap.tsx`) rendering fires as
severity-colored WebGL circle layers with a selected-feature highlight, and an
incident detail panel with a per-incident, dated updates feed. Data is fetched
with TanStack Query (`src/data/`).

The Updates feed builds incident history with no backend required. On every
fetch the app snapshots each fire and diffs it against the last snapshot stored
in the browser (`lib/fireHistory.ts` + pure `domain/history.ts`), appending
observed deltas — containment climbing, size growing, status/severity changes —
to a per-fire log in localStorage that accrues over time. Ordering:

1. the backend's ingested change log, when running with Supabase (richest);
2. otherwise the **browser-recorded** change history plus a discovery anchor;
3. before any change has been seen, a timeline derived from the latest snapshot
   (`domain/timeline.ts`).

The client-side history is per-browser and only accrues while the app is open —
it can't back-fill changes from before you first viewed a fire. For a
continuous, shared log, run the Supabase backend.

### Data modes

The app runs in one of three modes (`src/data/fires.ts`):

- **live** (default, no backend): the browser fetches NIFC WFIGS directly from
  the public ArcGIS feature service and reuses the connector's pure `parseWfigs`.
  Deploys as a pure static site (e.g. GitHub Pages) with live incident data and
  zero infrastructure. Trade-off: no update history, hotspots, or AQI (those need
  a backend/keys).
- **supabase** (`VITE_SUPABASE_URL` set): reads the project's tables — adds the
  ingested history, FIRMS hotspots, AQI enrichment, and realtime.
- **demo** (`VITE_DATA_MODE=demo`): bundled fixtures, for offline development.

A basemap picker offers keyless styles — Dark, Light, Streets (CARTO) and
Satellite (Esri imagery) — falling back to a self-contained inline style if a
remote style can't load. `VITE_MAP_STYLE` adds a "Custom" style and makes it the
default.

Polish: light/dark theme and imperial/metric units (context-based, persisted to
localStorage, defaulting to the OS preference); a measure tool that sums
great-circle distance along clicked points using the domain `haversineKm`; and
**saved places with proximity alerts**.

A **Settings** modal (gear in the top bar) collects preferences (theme, units,
default basemap), notification controls (permission, alert sound + volume with a
Web-Audio chime), a Tutorial, FAQ, What's-new changelog, an About/data-sources
section, and a "clear saved places" reset.

### Places & alerts

Save named locations by **street address** (geocoded via OpenStreetMap
Nominatim) or by dropping a pin on the map, rename them inline, and give each a
per-place **alert radius**. Places appear on the map as a **star** in a
user-chosen color (rendered as an HTML marker, so it survives basemap switches). When alerts are enabled on a place, an active fire
entering that radius triggers an **OS browser notification** (via the
Notifications API), de-duped so each fire announces once. Proximity detection is
a pure, tested domain function (`domain/places.ts`), and everything persists in
localStorage.

A selected incident's detail panel lists the distance to each saved place
(nearest first, in the active unit), flagging any the fire is within the alert
radius of, and a **Sources** section (`domain/sources.ts`) with two tiers:

- **Data sources** — what produced the values shown: NIFC WFIGS (linked
  directly to that incident's record by IrwinID), plus Open-Meteo and PurpleAir
  when wind/AQI enrichment is present.
- **Related sources** — authoritative cross-references deep-linked by location:
  WildCAD/WildWeb (interagency dispatch CAD logs), InciWeb (official incident
  updates and closures), and a NASA FIRMS map centered on the incident.

Limitation: browser notifications only fire while a tab is open. Truly external
alerts when the app is closed (email/SMS/push) require a backend + push service —
that's the Supabase path, where the same `SavedPlace` model can drive a
server-side proximity check.

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
