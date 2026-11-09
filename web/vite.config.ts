import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// The `shared/` folder (KPI formulas, suggestion rules) lives outside `web/`
// because the Supabase background jobs import the same files.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  server: { fs: { allow: ['..'] } },
  test: { include: ['src/**/*.test.ts', '../shared/**/*.test.ts'] },
})
