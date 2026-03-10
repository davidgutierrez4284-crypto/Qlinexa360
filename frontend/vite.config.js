import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const startUrl = isProd ? 'https://www.qlinexa360.com/' : '/';
  const scope = isProd ? 'https://www.qlinexa360.com/' : '/';

  const plugins = [react()];

  if (isProd) {
    plugins.push(
      VitePWA({
        injectRegister: 'auto',
        registerType: 'autoUpdate',
        manifest: {
          name: 'Qlinexa360',
          short_name: 'Qlinexa360',
          description: 'Plataforma de salud digital Qlinexa360',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: startUrl,
          scope,
                  icons: [
          { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
        },
      })
    );
  }

  return {
    plugins,
    server: {
      open: true, // Abre el navegador automáticamente
      port: 5173, // Puerto explícito para el frontend
      proxy: {
        '/api': 'http://127.0.0.1:3000',
        '/uploads': 'http://127.0.0.1:3000',
      },
    },
  }
})
