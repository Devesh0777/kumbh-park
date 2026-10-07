import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// MapLibre resolves its worker as a sibling of its own module URL
// (maplibre-gl/src/util/web_worker.ts → defaultWorkerUrl). Pre-bundling moves the
// library to node_modules/.vite/deps/maplibre-gl.js, where that sibling —
// maplibre-gl-worker.mjs — does not exist, so every worker 404s and the map falls
// back to whatever needs no worker. Excluding it keeps import.meta.url pointing at
// the real dist file, where the worker actually lives.
const MAPLIBRE_WORKER_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

function maplibreWorkerAssets() {
  const distDir = path.resolve(import.meta.dirname, 'node_modules/maplibre-gl/dist')
  let assetsDir = 'assets'
  return {
    name: 'maplibre-worker-assets',
    apply: 'build',
    configResolved(config) {
      assetsDir = config.build.assetsDir
    },
    // The production bundle keeps the same sibling-relative worker lookup, so the
    // worker has to land next to it in dist/ under its original name.
    generateBundle() {
      for (const file of MAPLIBRE_WORKER_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `${assetsDir}/${file}`,
          source: readFileSync(path.join(distDir, file), 'utf8'),
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), maplibreWorkerAssets()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    host: true,
    port: 5173,
  },
})
