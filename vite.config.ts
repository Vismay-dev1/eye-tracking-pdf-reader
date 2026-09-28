import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
