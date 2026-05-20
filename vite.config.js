import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // generateSW is simpler and more reliable than injectManifest for deployment
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        cleanupOutdatedCaches: true,
        // Don't cache Supabase API calls
        runtimeCaching: [],
      },
      manifest: {
        name: 'LevelUp',
        short_name: 'LevelUp',
        description: 'Turn your life into a game',
        theme_color: '#185FA5',
        background_color: '#0F0F0F',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
