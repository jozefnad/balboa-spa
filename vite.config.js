import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  base: '',
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/chunks/[name].js`,
        assetFileNames: `assets/style/[name].[ext]`,
      }
    }
  }
})