import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { extraerFactura } from './pipeline/ocr.ts'

// En producción el OCR y la conexión de buzones corren como funciones
// serverless de Vercel (api/*.ts). En dev, Vite no las ejecuta, así que las
// replicamos como middleware para poder probarlas en local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  async function readBody(req: any): Promise<any> {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'dev-api',
        configureServer(server) {
          // OCR doble
          server.middlewares.use('/api/ocr', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end('Método no permitido'); return }
            res.setHeader('Content-Type', 'application/json')
            try {
              const body = await readBody(req)
              if (!env.OPENROUTER_API_KEY) { res.statusCode = 500; res.end(JSON.stringify({ error: 'Falta OPENROUTER_API_KEY en .env' })); return }
              res.end(JSON.stringify(await extraerFactura(body.dataBase64, body.mimeType, env.OPENROUTER_API_KEY)))
            } catch (e) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
            }
          })

          // Conectar buzón → crea credencial IMAP en n8n
          server.middlewares.use('/api/connect-mailbox', async (req, res) => {
            if (req.method !== 'POST') { res.statusCode = 405; res.end('Método no permitido'); return }
            res.setHeader('Content-Type', 'application/json')
            try {
              const body = await readBody(req)
              const base = env.N8N_BASE_URL, key = env.N8N_API_KEY
              if (!base || !key) { res.statusCode = 500; res.end(JSON.stringify({ error: 'Falta config n8n en .env' })); return }
              if (!body.email || !body.appPassword) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Falta correo o clave' })); return }
              const etiqueta = body.tipo === 'dian' ? 'token DIAN' : 'facturas'
              const r = await fetch(`${base}/api/v1/credentials`, {
                method: 'POST',
                headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: `Recepción · ${body.proyectoNombre || body.proyectoId} · ${etiqueta}`,
                  type: 'imap',
                  data: { user: body.email, password: body.appPassword, host: 'imap.gmail.com', port: 993, secure: true },
                }),
              })
              if (!r.ok) { res.statusCode = 500; res.end(JSON.stringify({ error: `n8n HTTP ${r.status}` })); return }
              const cred = await r.json()
              res.end(JSON.stringify({ ok: true, credentialId: cred.id, email: body.email }))
            } catch (e) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
            }
          })
        },
      },
    ],
    server: { port: 5173, host: true },
  }
})
