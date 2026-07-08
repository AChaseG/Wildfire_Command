// Mirrors supabase/migrations. In a live project this file is generated with
//   supabase gen types typescript --local > src/types/database.ts
// It is hand-kept here so the domain layer is typed before the DB exists.

export interface FireRow {
  id: string
  source: string
  external_id: string | null
  name: string
  cause: string | null
  severity: string
  status: string
  containment_pct: number
  acres: number
  discovered_at: string
  ended_at: string | null
  latitude: number
  longitude: number
  location_description: string | null
  wind_speed_mph: number | null
  wind_direction_deg: number | null
  aqi: number | null
  summary: string | null
  monitored: boolean
  created_at: string
  updated_at: string
}

export interface FireUpdateRow {
  id: string
  fire_id: string
  posted_at: string
  kind: string
  title: string
  body: string
  created_at: string
}

export interface IngestRunRow {
  id: string
  connector: string
  started_at: string
  finished_at: string | null
  status: string
  fetched: number
  upserted: number
  error: string | null
}

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row> }

export interface Database {
  public: {
    Tables: {
      fires: Table<FireRow>
      fire_updates: Table<FireUpdateRow>
      ingest_runs: Table<IngestRunRow>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
