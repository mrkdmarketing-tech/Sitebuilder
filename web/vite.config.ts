import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// The `shared/` folder (KPI formulas, suggestion rules) lives outside `web/`
// because the Supabase background jobs import the same files.

// Each build gets an id, written into the app and into /version.json. An open
// page compares the two and offers a reload when a newer version is live
// (web/src/app/UpdateBanner.tsx).
const BUILD_ID = new Date().toISOString()

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId: BUILD_ID }) })
      },
    },
  ],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  server: { fs: { allow: ['..'] } },
  test: { include: ['src/**/*.test.ts', '../shared/**/*.test.ts'] },
})
