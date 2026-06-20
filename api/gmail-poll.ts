import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAccessToken, fetchCorreos } from '../pipeline/gmail.ts'
import { procesarCorreo, type FacturaCapturada } from '../pipeline/procesarCorreo.ts'

export const config = { maxDuration: 60 }

// Polling del buzón → captura facturas → upsert por CUFE en Sheets.
// ⏳ Requiere credenciales (Fase 0): GOOGLE_CLIENT_ID/SECRET, GMAIL_REFRESH_TOKEN,
// SHEETS_WEBAPP_URL, OPENROUTER_API_KEY. Puede dispararse por Vercel Cron,
// un cron externo, o manualmente (protegido por CRON_SECRET).

interface ProyectoLite {
  id: string
  identificacion: string
}

function mapFactura(f: FacturaCapturada, proyectoId: string) {
  const now = new Date().toISOString()
  return {
    id: `cap-${f.hash.slice(0, 16)}`,
    proyectoId,
    fuente: 'correo',
    estado: f.estado,
    cufe: f.cufe || '',
    tipoDocumento: f.tipoDocumento || 'factura_venta',
    prefijo: f.prefijo || '',
    numero: f.numero || '',
    emisorNombre: f.emisorNombre || '',
    emisorNit: f.emisorNit || '',
    adquirenteNombre: f.adquirenteNombre || '',
    adquirenteNit: f.adquirenteNit || '',
    fechaEmision: f.fechaEmision || '',
    fechaRecepcion: now.slice(0, 10),
    moneda: f.moneda || 'COP',
    subtotal: f.subtotal ?? 0,
    iva: f.iva ?? 0,
    otrosImpuestos: f.otrosImpuestos ?? 0,
    total: f.total ?? 0,
    estadoDian: '',
    concordanciaOcr: f.concordanciaOcr,
    camposDiscrepancia: f.camposDiscrepancia,
    modeloA: f.modeloA,
    modeloB: f.modeloB,
    archivoOrigen: f.origenArchivo,
    creadoEn: now,
    actualizadoEn: now,
  }
}

async function sheets(url: string, action: string, payload: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, payload }),
    redirect: 'follow',
  })
  const json = (await res.json()) as { ok: boolean; data?: unknown; error?: string }
  if (!json.ok) throw new Error(json.error || 'Sheets error')
  return json.data
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const env = process.env
  if (env.CRON_SECRET && req.query.secret !== env.CRON_SECRET) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }
  const faltan = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'SHEETS_WEBAPP_URL', 'OPENROUTER_API_KEY'].filter((k) => !env[k])
  if (faltan.length) {
    res.status(503).json({ error: 'Faltan credenciales (Fase 0)', faltan })
    return
  }
  try {
    const token = await getAccessToken(env.GMAIL_REFRESH_TOKEN!, env.GOOGLE_CLIENT_ID!, env.GOOGLE_CLIENT_SECRET!)
    const correos = await fetchCorreos(token)

    // Mapa NIT empresa → proyecto, para enrutar (buzón único, multi-cliente).
    const proyectos = (await sheets(env.SHEETS_WEBAPP_URL!, 'listProyectos', undefined)) as ProyectoLite[]
    const porNit = new Map(proyectos.map((p) => [String(p.identificacion).replace(/[^\d]/g, ''), p.id]))

    const resumen: { correo: string; facturas: number; guardadas: number; sinProyecto: number }[] = []
    for (const correo of correos) {
      const { facturas } = await procesarCorreo(correo, env.OPENROUTER_API_KEY!)
      let guardadas = 0
      let sinProyecto = 0
      for (const f of facturas) {
        const proyectoId = porNit.get((f.adquirenteNit || '').replace(/[^\d]/g, ''))
        if (!proyectoId) { sinProyecto++; continue }
        await sheets(env.SHEETS_WEBAPP_URL!, 'upsertFacturaByCufe', { proyectoId, factura: mapFactura(f, proyectoId) })
        guardadas++
      }
      resumen.push({ correo: correo.asunto, facturas: facturas.length, guardadas, sinProyecto })
    }
    res.status(200).json({ ok: true, correos: correos.length, resumen })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
