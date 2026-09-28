import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the built site works under any subpath — including a
  // GitHub Pages project site (https://<user>.github.io/<repo>/) and custom
  // domains alike. Without this, bundled asset URLs resolve to the domain root
  // and 404, leaving a blank page.
  base: './',
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0 so the live preview / LAN can reach it
    port: 5173,
    strictPort: false,
    allowedHosts: true, // accept the sandbox preview proxy host
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          tensorflow: [
            '@tensorflow/tfjs-core',
            '@tensorflow/tfjs-backend-webgl',
            '@tensorflow/tfjs-converter',
            '@tensorflow-models/face-landmarks-detection',
          ],
          pdfjs: ['pdfjs-dist'],
        },
      },
    },
  },
})
