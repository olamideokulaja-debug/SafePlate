import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tests run with NO Supabase env vars set, so the app falls back to its built-in
// demo data store. That lets every portal render end-to-end without a backend,
// which is exactly what a CI smoke test needs.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
