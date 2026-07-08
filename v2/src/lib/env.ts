interface Env {
  supabaseUrl: string
  supabaseAnonKey: string
}

export const env: Env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
}
