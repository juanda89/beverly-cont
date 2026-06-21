import type { VercelRequest, VercelResponse } from '@vercel/node'

// Recibe un adjunto (lo manda n8n), corre el OCR (vía /api/ocr) y devuelve la
// FILA lista para que el nodo Google Sheets la escriba (autoMapInputData → las
// claves coinciden con los encabezados de la hoja).

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }
  try {
    const { dataBase64, mimeType } = (req.body || {}) as { dataBase64?: string; mimeType?: string }
    if (!dataBase64 || !mimeType) {
      res.status(400).json({ error: 'Falta dataBase64 o mimeType' })
      return
    }
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    const host = req.headers.host
    const ocrRes = await fetch(`${proto}://${host}/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataBase64, mimeType }),
    })
    const ocr = (await ocrRes.json()) as { consolidado?: Record<string, unknown>; error?: string }
    if (!ocrRes.ok || !ocr.consolidado) {
      res.status(502).json({ error: ocr.error || 'OCR falló' })
      return
    }
    const c = ocr.consolidado as Record<string, any>
    const now = new Date().toISOString()
    const fila = {
      ID: c.cufe || `cap-${Date.now()}`,
      Fuente: 'Correo',
      Estado: c.estado === 'ok' ? 'OK' : 'Revisión manual',
      CUFE: c.cufe || '',
      Tipo: c.tipoDocumento || '',
      Prefijo: c.prefijo || '',
      'Número': c.numero || '',
      Emisor: c.emisorNombre || '',
      'NIT emisor': c.emisorNit || '',
      Adquirente: c.adquirenteNombre || '',
      'NIT adquirente': c.adquirenteNit || '',
      'Fecha emisión': c.fechaEmision || '',
      'Fecha recepción': now.slice(0, 10),
      Moneda: c.moneda || 'COP',
      Subtotal: c.subtotal ?? 0,
      IVA: c.iva ?? 0,
      'Otros impuestos': c.otrosImpuestos ?? 0,
      Total: c.total ?? 0,
      'Estado DIAN': '',
      'Concordancia OCR': c.concordanciaOcr ? 'Sí' : 'No',
      Creado: now,
      Actualizado: now,
    }
    res.status(200).json(fila)
  } catch (e) {
    res.status(500).json({ error: String((e as Error)?.message || e) })
  }
}
