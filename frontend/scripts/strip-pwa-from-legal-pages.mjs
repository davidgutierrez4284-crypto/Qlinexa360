/**
 * Ejecutar después de `vite build` (incl. vite-plugin-pwa).
 * Las páginas legales deben ser HTML puro para view-source / verificación OAuth.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(__dirname, '..', 'dist')
const files = [
  path.join(dist, 'benefits', 'index.html'),
  path.join(dist, 'aviso-privacidad', 'index.html'),
  path.join(dist, 'terminos', 'index.html'),
]

for (const file of files) {
  if (!fs.existsSync(file)) continue
  let html = fs.readFileSync(file, 'utf8')
  html = html.replace(/<link rel="manifest" href="[^"]*">\s*/g, '')
  html = html.replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>\s*/g, '')
  fs.writeFileSync(file, html)
}
