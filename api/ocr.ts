import type { VercelRequest, VercelResponse } from '@vercel/node'

// Permite hasta 60s (las dos llamadas a los modelos pueden tardar).
export const config = { maxDuration: 60 }

// Import dinámico con string estático: esbuild lo empaqueta (bundle), y si la
// resolución falla en runtime el error queda capturable y se devuelve.
async function cargarExtraer() {
  const mod = await import('../pipeline/ocr.ts')
  return mod.extraerFactura
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Diagnóstico: GET confirma que el módulo carga (sin gastar OCR ni key).
  if (req.method === 'GET') {
    try {
      await cargarExtraer()
      res.status(200).json({ ok: true, loaded: true })
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e as Error)?.stack || e).slice(0, 600) })
    }
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Falta OPENROUTER_API_KEY en el servidor' })
    return
  }
  try {
    const extraerFactura = await cargarExtraer()
    const { dataBase64, mimeType } = (req.body || {}) as { dataBase64?: string; mimeType?: string }
    if (!dataBase64 || !mimeType) {
      res.status(400).json({ error: 'Falta dataBase64 o mimeType' })
      return
    }
    res.status(200).json(await extraerFactura(dataBase64, mimeType, apiKey))
  } catch (e) {
    res.status(500).json({ error: String((e as Error)?.message || e) })
  }
}
