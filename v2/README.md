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
| 1 | Foundation: TS scaffold, schema, domain layer (tested), CI | ✅ this branch |
| 2 | Ingestion orchestrator + WFIGS connector on a pg_cron schedule | planned |
| 3 | Core UI: MapLibre map, incident list, incident detail | planned |
| 4 | Remaining connectors (FIRMS, PurpleAir, wind) + alerts/updates | planned |
| 5 | Polish: theming, key locations, measure tool | planned |

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

## Database

Schema lives in `supabase/migrations/`. Apply it with `supabase db push`
(from a project linked via `supabase link`). Regenerate `src/types/database.ts`
after schema changes with `supabase gen types typescript --local`.
