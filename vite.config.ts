import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { extraerFactura } from './pipeline/ocr.ts'

// En producción el OCR corre como función serverless de Vercel (api/ocr.ts).
// En dev, Vite no ejecuta esas funciones, así que montamos el mismo handler
// como middleware para poder probar /api/ocr en local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'dev-api-ocr',
        configureServer(server) {
          server.middlewares.use('/api/ocr', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end('Método no permitido')
              return
            }
            res.setHeader('Content-Type', 'application/json')
            try {
              const chunks: Buffer[] = []
              for await (const c of req) chunks.push(c as Buffer)
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
              const apiKey = env.OPENROUTER_API_KEY
              if (!apiKey) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: 'Falta OPENROUTER_API_KEY en .env' }))
                return
              }
              const result = await extraerFactura(body.dataBase64, body.mimeType, apiKey)
              res.end(JSON.stringify(result))
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
