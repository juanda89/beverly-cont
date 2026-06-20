// Tipos compartidos del pipeline de captura (server-side).

export interface Adjunto {
  filename: string
  mimeType: string
  dataBase64: string
}

export interface CorreoEntrante {
  id: string // id del mensaje en Gmail
  remitente: string
  asunto: string
  cuerpo: string // texto plano (puede venir truncado)
  fecha?: string
  adjuntos: Adjunto[]
}

/** Documento individual ya enrutado a partir de un adjunto. */
export type TipoDoc = 'pdf' | 'imagen' | 'xml' | 'desconocido'

export interface Documento {
  filename: string
  mimeType: string
  dataBase64: string
  tipo: TipoDoc
  hash: string // sha256 para deduplicar
}
