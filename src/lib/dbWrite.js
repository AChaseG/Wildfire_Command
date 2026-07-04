// Routes all client mutations through the validated db-write edge function.
// Direct anonymous writes are blocked by RLS, so this gateway (service role,
// column-allowlisted, filter-enforced) is the only write path from the browser.
// Returns a supabase-like { data, error } shape.
export async function mutate(body) {
  try {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/db-write`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )
    const payload = await resp.json().catch(() => null)
    if (!resp.ok || !payload || payload.error) {
      return { data: null, error: { message: payload?.error || `Request failed (${resp.status})` } }
    }
    return { data: payload.data ?? null, error: null }
  } catch (err) {
    return { data: null, error: { message: err.message } }
  }
}
