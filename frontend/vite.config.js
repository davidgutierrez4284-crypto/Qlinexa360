import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Pretty URLs → MPA HTML (misma semántica que S3/CloudFront en PROD; ver deploy-frontend-s3.ps1). */
function attachLegalStaticUrlRewrite(server) {
  server.middlewares.use((req, _res, next) => {
    const raw = req.url || ''
    const pathOnly = raw.split('?')[0]
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
    if (pathOnly === '/benefits' || pathOnly === '/benefits/') {
      req.url = '/benefits/index.html' + query
    }
    if (pathOnly === '/aviso-privacidad' || pathOnly === '/aviso-privacidad/') {
      req.url = '/aviso-privacidad/index.html' + query
    }
    if (pathOnly === '/terminos' || pathOnly === '/terminos/') {
      req.url = '/terminos/index.html' + query
    }
    next()
  })
}

function legalStaticPrettyUrlsPlugin() {
  return {
    name: 'legal-static-pretty-urls',
    configureServer: attachLegalStaticUrlRewrite,
    configurePreviewServer: attachLegalStaticUrlRewrite,
  }
}

/**
 * Build multipágina: no existe archivo físico /register en dist → 404 en vite preview y en hosts
 * estáticos sin fallback SPA. Peticiones HTML a rutas como /register deben servir index.html
 * conservando la query (?type=, ?ref=, etc.).
 */
function spaHtmlFallbackPlugin() {
  const isLegalPath = (pathOnly) =>
    pathOnly === '/benefits' ||
    pathOnly.startsWith('/benefits/') ||
    pathOnly === '/aviso-privacidad' ||
    pathOnly.startsWith('/aviso-privacidad/') ||
    pathOnly === '/terminos' ||
    pathOnly.startsWith('/terminos/')

  const attach = (server) => {
    server.middlewares.use((req, _res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      const raw = req.url || ''
      const pathOnly = raw.split('?')[0]
      const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : ''
      if (pathOnly.startsWith('/api')) return next()
      if (pathOnly.startsWith('/uploads')) return next()
      if (pathOnly.startsWith('/@') || pathOnly.startsWith('/node_modules')) return next()
      if (pathOnly.startsWith('/src/')) return next()
      if (isLegalPath(pathOnly)) return next()
      if (
        /\.(js|mjs|ts|tsx|jsx|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|map|json|txt|xml|webmanifest)$/i.test(
          pathOnly
        )
      ) {
        return next()
      }
      const accept = (req.headers && req.headers.accept) || ''
      if (!accept.includes('text/html')) return next()
      if (pathOnly === '/' || pathOnly === '/index.html') return next()
      req.url = '/index.html' + query
      next()
    })
  }
  return {
    name: 'spa-html-fallback',
    enforce: 'pre',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const startUrl = isProd ? 'https://www.qlinexa360.com/' : '/';
  const scope = isProd ? 'https://www.qlinexa360.com/' : '/';

  const plugins = [spaHtmlFallbackPlugin(), legalStaticPrettyUrlsPlugin(), react()];

  if (isProd) {
    plugins.push(
      VitePWA({
        injectRegister: 'auto',
        registerType: 'autoUpdate',
        // Sin esto, el SW sirve index.html en caché para navegaciones y /aviso-privacidad etc. quedan como SPA en el navegador.
        workbox: {
          // El bundle principal supera los 2 MiB por defecto; subimos el límite para precachearlo.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [
            /^\/benefits(\/|$)/,
            /^\/aviso-privacidad(\/|$)/,
            /^\/terminos(\/|$)/,
          ],
        },
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
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          benefits: path.resolve(__dirname, 'benefits/index.html'),
          avisoPrivacidad: path.resolve(__dirname, 'aviso-privacidad/index.html'),
          terminos: path.resolve(__dirname, 'terminos/index.html'),
        },
      },
    },
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
