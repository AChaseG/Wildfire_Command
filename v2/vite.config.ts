import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vite + Vitest share one config. Domain tests are pure functions, so they run
// in the fast Node environment; UI tests (later slices) can opt into jsdom.
export default defineConfig({
  plugins: [react()],
  // Bind on all interfaces and allow the forwarded Codespaces/dev host so the
  // dev server is reachable through GitHub's port forwarding.
  server: {
    host: true,
    allowedHosts: ['.app.github.dev', '.githubpreview.dev'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
  },
})
