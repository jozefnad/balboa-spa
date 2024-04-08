import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa' 

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Balboa BWA',
        short_name: 'BalboaBWA',
        theme_color: '#ffffff',
        icons: [
          {
            src: './src/assets/hottubbing.webp',
            sizes: '512x512',
            type: 'image/webp',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      }
    })
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