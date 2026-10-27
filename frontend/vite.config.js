import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const serviceWorkerSource = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8')

function serviceWorkerPlugin() {
  const buildId = Date.now().toString(36)

  return {
    name: 'progress-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const precacheUrls = [
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/pwa-icon.svg',
        '/favicon.svg',
        ...Object.keys(bundle)
          .filter((fileName) => fileName !== 'sw.js')
          .map((fileName) => `/${fileName}`),
      ]

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorkerSource
          .replace('__BUILD_ID__', buildId)
          .replace('__PRECACHE_URLS__', JSON.stringify([...new Set(precacheUrls)])),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
})
