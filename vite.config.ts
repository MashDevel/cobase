import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3040,
    strictPort: true,
  },
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@xterm')) return 'xterm'
          if (id.includes('react') || id.includes('react-dom')) return 'react-vendor'
          if (id.includes('zustand')) return 'state'
          if (id.includes('lucide-react')) return 'icons'
          return 'vendor'
        },
      },
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
})
