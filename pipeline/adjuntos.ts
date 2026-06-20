// Procesa los adjuntos de un correo (PRD RF-204/205): descomprime ZIP, enruta
// por tipo (PDF/imagen/XML) y deduplica por hash.

import { unzipSync } from 'fflate'
import { createHash } from 'node:crypto'
import type { Adjunto, Documento, TipoDoc } from './tipos.ts'

const sha256 = (buf: Uint8Array): string => createHash('sha256').update(buf).digest('hex')

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  xml: 'application/xml',
}

function ext(filename: string): string {
  return (filename.toLowerCase().split('.').pop() || '').trim()
}

function tipoDe(filename: string, mimeType: string): TipoDoc {
  const e = ext(filename)
  if (mimeType === 'application/pdf' || e === 'pdf') return 'pdf'
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(e)) return 'imagen'
  if (mimeType.includes('xml') || e === 'xml') return 'xml'
  return 'desconocido'
}

const esZip = (filename: string, mimeType: string): boolean =>
  mimeType.includes('zip') || filename.toLowerCase().endsWith('.zip')

/** Aplana los adjuntos a documentos individuales, deduplicados por hash. */
export function procesarAdjuntos(adjuntos: Adjunto[]): Documento[] {
  const out: Documento[] = []
  const vistos = new Set<string>()

  const add = (filename: string, mimeType: string, buf: Uint8Array) => {
    const hash = sha256(buf)
    if (vistos.has(hash)) return
    const tipo = tipoDe(filename, mimeType)
    if (tipo === 'desconocido') return
    vistos.add(hash)
    out.push({ filename, mimeType, dataBase64: Buffer.from(buf).toString('base64'), tipo, hash })
  }

  for (const a of adjuntos) {
    const buf = new Uint8Array(Buffer.from(a.dataBase64, 'base64'))
    if (esZip(a.filename, a.mimeType)) {
      try {
        const files = unzipSync(buf)
        for (const [name, data] of Object.entries(files)) {
          if (name.endsWith('/')) continue
          const base = name.split('/').pop() || name
          add(base, EXT_MIME[ext(base)] || 'application/octet-stream', data)
        }
      } catch {
        /* zip corrupto: se ignora */
      }
    } else {
      add(a.filename, a.mimeType, buf)
    }
  }
  return out
}
