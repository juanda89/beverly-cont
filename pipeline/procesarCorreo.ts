// Orquestador de captura por correo (PRD §6.3): clasifica → procesa adjuntos →
// extrae (XML autoritativo o OCR doble) → concilia → deduplica por CUFE.

import type { CorreoEntrante } from './tipos.ts'
import { clasificarCorreo, type Clasificacion } from './clasificador.ts'
import { procesarAdjuntos } from './adjuntos.ts'
import { parseUbl } from './xml.ts'
import { extraerFactura } from './ocr.ts'
import { consolidar } from './conciliacion.ts'

export type FacturaCapturada = ReturnType<typeof consolidar> & {
  fuenteDoc: 'xml' | 'ocr'
  origenArchivo: string
  hash: string
}

export interface ResultadoCorreo {
  clasificacion: Clasificacion
  facturas: FacturaCapturada[]
}

export async function procesarCorreo(
  correo: CorreoEntrante,
  apiKey: string,
): Promise<ResultadoCorreo> {
  const clasificacion = await clasificarCorreo(correo, apiKey)
  if (!clasificacion.esFactura) return { clasificacion, facturas: [] }

  const docs = procesarAdjuntos(correo.adjuntos)
  const facturas: FacturaCapturada[] = []

  // 1) XML — fuente con validez legal (no requiere OCR)
  for (const d of docs.filter((x) => x.tipo === 'xml')) {
    const xml = Buffer.from(d.dataBase64, 'base64').toString('utf8')
    const lectura = parseUbl(xml)
    if (lectura && (lectura.cufe || lectura.total)) {
      facturas.push({
        ...consolidar(lectura, lectura),
        fuenteDoc: 'xml',
        origenArchivo: d.filename,
        hash: d.hash,
      })
    }
  }

  // 2) PDF / imagen — OCR doble + conciliación
  for (const d of docs.filter((x) => x.tipo === 'pdf' || x.tipo === 'imagen')) {
    const r = await extraerFactura(d.dataBase64, d.mimeType, apiKey)
    facturas.push({
      ...r.consolidado,
      fuenteDoc: 'ocr',
      origenArchivo: d.filename,
      hash: d.hash,
    })
  }

  return { clasificacion, facturas: dedupPorCufe(facturas) }
}

/** Deduplica por CUFE; si hay XML y OCR del mismo CUFE, gana el XML. */
function dedupPorCufe(fs: FacturaCapturada[]): FacturaCapturada[] {
  const porCufe = new Map<string, FacturaCapturada>()
  const sinCufe: FacturaCapturada[] = []
  for (const f of fs) {
    const cufe = (f.cufe || '').trim()
    if (!cufe) {
      sinCufe.push(f)
      continue
    }
    const prev = porCufe.get(cufe)
    if (!prev || (prev.fuenteDoc === 'ocr' && f.fuenteDoc === 'xml')) porCufe.set(cufe, f)
  }
  return [...porCufe.values(), ...sinCufe]
}
