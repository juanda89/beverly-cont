import type { VercelRequest, VercelResponse } from '@vercel/node'
import { extraerFactura } from '../pipeline/ocr.ts'

// Permite hasta 60s (las dos llamadas a los modelos pueden tardar).
export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { dataBase64, mimeType } = (req.body || {}) as { dataBase64?: string; mimeType?: string }
    if (!dataBase64 || !mimeType) {
      res.status(400).json({ error: 'Falta dataBase64 o mimeType' })
      return
    }
    const result = await extraerFactura(dataBase64, mimeType, apiKey)
    res.status(200).json(result)
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
