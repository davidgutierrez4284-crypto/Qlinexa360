/**
 * Comprueba que /benefits, /aviso-privacidad y /terminos devuelven HTML estático (MPA),
 * no la shell de la SPA (<div id="root">).
 *
 * Uso:
 *   npm run validate:legal
 *     → requiere `npm run dev` en otra terminal (http://127.0.0.1:5173).
 *
 *   npm run validate:legal:preview
 *     → hace build, levanta vite preview en 4173, valida y cierra el preview.
 *
 * Variable opcional: LEGAL_VALIDATE_URL=http://127.0.0.1:XXXX
 *
 * --- Checklist manual (Google OAuth / políticas públicas) ---
 * Con el frontend en marcha (dev o producción), sin iniciar sesión:
 * 1. Abrir /benefits → debe mostrarse la página de beneficios (no redirige a /login).
 * 2. Abrir /aviso-privacidad y /terminos → HTML en el navegador (no PDF ni descarga forzada).
 * 3. En /benefits, comprobar enlaces visibles a /aviso-privacidad y /terminos (header, franja legal, footer).
 * 4. Repetir 1–3 con barra final en la URL (/benefits/, /aviso-privacidad/, /terminos/) si el hosting la usa.
 * 5. Confirmar en DevTools → Network que la respuesta es text/html y el cuerpo no es solo <div id="root">.
 */
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, '..')

const PREVIEW_PORT = 4173
const args = process.argv.slice(2)
const selfPreview = args.includes('--preview')

let baseUrl = process.env.LEGAL_VALIDATE_URL || 'http://127.0.0.1:5173'

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchText(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text }
  } finally {
    clearTimeout(t)
  }
}

async function waitForServer(urlPrefix, maxMs = 120000) {
  const testUrl = `${urlPrefix.replace(/\/$/, '')}/terminos`
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const { ok, status } = await fetchText(testUrl)
      if (ok && status === 200) return
    } catch {
      // conexión rechazada o abort
    }
    await sleep(400)
  }
  throw new Error(`No respondió a tiempo: ${testUrl} (${maxMs} ms)`)
}

function killProcessTree(child, label) {
  if (!child?.pid) return
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' })
    } else {
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
    }
  } catch {
    // ignore
  }
  console.log(label)
}

async function checkLegalPage(pathname, asciiMarkers) {
  const url = `${baseUrl.replace(/\/$/, '')}${pathname}`
  let body
  try {
    const r = await fetchText(url)
    body = r.text
    if (!r.ok) {
      console.error(`\n✖ ${url}\n  HTTP ${r.status}`)
      return false
    }
  } catch (e) {
    console.error(`\n✖ ${url}\n  ${e.message || e}`)
    if (String(e.cause || e).includes('ECONNREFUSED') || e.name === 'AbortError') {
      console.error('\n  ¿Está el servidor encendido?')
      if (!selfPreview) {
        console.error('  En otra terminal: cd frontend && npm run dev\n')
      }
    }
    return false
  }

  if (body.includes('<div id="root">') || body.includes('<div id="root"')) {
    console.error(`\n✖ ${url}\n  Parece la SPA (encontrado id="root"), no el HTML estático legal.`)
    return false
  }

  for (const m of asciiMarkers) {
    if (!body.includes(m)) {
      console.error(`\n✖ ${url}\n  Falta el marcador: ${JSON.stringify(m)}`)
      return false
    }
  }

  console.log(`✓ ${url}`)
  return true
}

async function main() {
  let previewChild = null

  if (selfPreview) {
    console.log('Modo --preview: compilando frontend…')
    execSync('npm run build', { cwd: frontendRoot, stdio: 'inherit' })
    baseUrl = `http://127.0.0.1:${PREVIEW_PORT}`
    console.log(`\nLevantando vite preview en ${baseUrl} …`)

    previewChild = spawn(
      'npm',
      ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'],
      { cwd: frontendRoot, shell: true, stdio: 'ignore', detached: false }
    )

    previewChild.on('error', (err) => {
      console.error('No se pudo iniciar preview:', err.message)
    })

    try {
      await waitForServer(baseUrl)
    } catch (e) {
      killProcessTree(previewChild, '\nPreview detenido.')
      console.error(e.message || e)
      process.exit(1)
    }
  } else {
    console.log(`Comprobando ${baseUrl} (define LEGAL_VALIDATE_URL si usas otro puerto/host)\n`)
    console.log('Si falla por conexión: en otra terminal ejecuta  cd frontend  →  npm run dev\n')
  }

  const benefitsMarkers = [
    'href="/aviso-privacidad"',
    'href="/terminos"',
    'Beneficios de Qlinexa360',
  ]
  const okBenefits = await checkLegalPage('/benefits', benefitsMarkers)
  const okBenefitsSlash = await checkLegalPage('/benefits/', benefitsMarkers)
  const avisoMarkers = ['<article class="card">', 'legal@qlinexa360.com']
  const ok1 = await checkLegalPage('/aviso-privacidad', avisoMarkers)
  const ok1Slash = await checkLegalPage('/aviso-privacidad/', avisoMarkers)
  const terminosMarkers = ['<article class="card">', 'Mayo 2026']
  const ok2 = await checkLegalPage('/terminos', terminosMarkers)
  const ok2Slash = await checkLegalPage('/terminos/', terminosMarkers)

  if (previewChild) {
    killProcessTree(previewChild, '\nPreview detenido.')
  }

  if (!okBenefits || !okBenefitsSlash || !ok1 || !ok1Slash || !ok2 || !ok2Slash) {
    process.exit(1)
  }
  console.log('\nListo: /benefits y páginas legales sirven HTML estático (sin shell SPA).')
  console.log('Rutas validadas (con y sin barra final): /benefits, /aviso-privacidad, /terminos.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
