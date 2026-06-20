// Conector de Gmail (lectura). Trae correos no leídos con adjuntos y los
// convierte a CorreoEntrante. Requiere un access token OAuth con scope
// gmail.readonly. La obtención del token (refresh→access) está abajo.
//
// ⏳ Pendiente de credenciales (Google Cloud OAuth). El código está listo;
// se prueba cuando exista el proyecto OAuth + refresh token del buzón.

import type { Adjunto, CorreoEntrante } from './tipos.ts'

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'

interface GmailPart {
  mimeType?: string
  filename?: string
  headers?: { name: string; value: string }[]
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPart[]
}
interface GmailMessage {
  id: string
  payload?: GmailPart
  internalDate?: string
}

function b64urlToB64(s: string): string {
  return s.replace(/-/g, '+').replace(/_/g, '/')
}
function decodeText(dataB64url?: string): string {
  if (!dataB64url) return ''
  return Buffer.from(b64urlToB64(dataB64url), 'base64').toString('utf8')
}
function header(parts: GmailPart | undefined, name: string): string {
  const h = parts?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h?.value ?? ''
}

/** Intercambia un refresh token por un access token (OAuth 2.0). */
export async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`OAuth token: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('OAuth: sin access_token')
  return json.access_token
}

async function api<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Gmail ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

/** Recorre el árbol MIME extrayendo cuerpo de texto y adjuntos. */
function walk(part: GmailPart | undefined, acc: { texto: string[]; adjuntos: { filename: string; mimeType: string; attachmentId: string }[] }) {
  if (!part) return
  if (part.filename && part.body?.attachmentId) {
    acc.adjuntos.push({ filename: part.filename, mimeType: part.mimeType || 'application/octet-stream', attachmentId: part.body.attachmentId })
  } else if (part.mimeType === 'text/plain' && part.body?.data) {
    acc.texto.push(decodeText(part.body.data))
  } else if (part.mimeType === 'text/html' && part.body?.data && acc.texto.length === 0) {
    acc.texto.push(decodeText(part.body.data).replace(/<[^>]+>/g, ' '))
  }
  for (const p of part.parts ?? []) walk(p, acc)
}

async function getCorreo(id: string, accessToken: string): Promise<CorreoEntrante> {
  const msg = await api<GmailMessage>(`/messages/${id}?format=full`, accessToken)
  const acc = { texto: [] as string[], adjuntos: [] as { filename: string; mimeType: string; attachmentId: string }[] }
  walk(msg.payload, acc)

  const adjuntos: Adjunto[] = []
  for (const a of acc.adjuntos) {
    const att = await api<{ data?: string }>(`/messages/${id}/attachments/${a.attachmentId}`, accessToken)
    if (att.data) adjuntos.push({ filename: a.filename, mimeType: a.mimeType, dataBase64: b64urlToB64(att.data) })
  }

  return {
    id,
    remitente: header(msg.payload, 'From'),
    asunto: header(msg.payload, 'Subject'),
    cuerpo: acc.texto.join('\n').slice(0, 4000),
    fecha: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : undefined,
    adjuntos,
  }
}

/** Trae los correos que cumplan el query (por defecto: no leídos con adjunto). */
export async function fetchCorreos(
  accessToken: string,
  opts?: { query?: string; max?: number },
): Promise<CorreoEntrante[]> {
  const q = encodeURIComponent(opts?.query ?? 'is:unread has:attachment newer_than:15d')
  const list = await api<{ messages?: { id: string }[] }>(`/messages?q=${q}&maxResults=${opts?.max ?? 25}`, accessToken)
  const ids = (list.messages ?? []).map((m) => m.id)
  const out: CorreoEntrante[] = []
  for (const id of ids) out.push(await getCorreo(id, accessToken))
  return out
}
