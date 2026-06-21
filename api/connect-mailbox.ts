import type { VercelRequest, VercelResponse } from '@vercel/node'

// Conecta un buzón: crea la credencial IMAP en n8n con el correo + app password
// del contador (nunca se loguea ni se persiste de nuestro lado). Si es el correo
// de facturas y el proyecto ya tiene su Google Sheets, además crea y activa un
// workflow de captura: IMAP → /api/capture (OCR) → Google Sheets (append).

const APP_URL = process.env.APP_URL || 'https://beverly-cont.vercel.app'
const GSHEETS_CRED_ID = process.env.N8N_GSHEETS_CRED_ID || 'hGxsL47CSLAz1Zkw'
const GSHEETS_CRED_NAME = process.env.N8N_GSHEETS_CRED_NAME || 'Google Sheets account 2'

async function n8n(base: string, key: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`n8n ${path}: HTTP ${res.status} ${JSON.stringify(json).slice(0, 200)}`)
  return json as any
}

function workflowCaptura(nombre: string, imapCredId: string, imapCredName: string, spreadsheetId: string) {
  return {
    name: `Recepción · ${nombre} · captura facturas`,
    nodes: [
      {
        id: crypto.randomUUID(),
        name: 'Correo entrante',
        type: 'n8n-nodes-base.emailReadImap',
        typeVersion: 2,
        position: [0, 0],
        parameters: { format: 'resolved', options: {} },
        credentials: { imap: { id: imapCredId, name: imapCredName } },
      },
      {
        id: crypto.randomUUID(),
        name: 'OCR',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [260, 0],
        parameters: {
          method: 'POST',
          url: `${APP_URL}/api/capture`,
          sendBody: true,
          specifyBody: 'json',
          jsonBody:
            '={{ JSON.stringify({ dataBase64: $binary.attachment_0.data, mimeType: $binary.attachment_0.mimeType }) }}',
          options: {},
        },
      },
      {
        id: crypto.randomUUID(),
        name: 'Guardar en Sheets',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.7,
        position: [520, 0],
        parameters: {
          resource: 'sheet',
          operation: 'append',
          documentId: { __rl: true, value: spreadsheetId, mode: 'id' },
          sheetName: { __rl: true, value: 'Facturas', mode: 'name' },
          columns: { mappingMode: 'autoMapInputData', value: null },
          options: { cellFormat: 'RAW', useAppend: true },
        },
        credentials: { googleSheetsOAuth2Api: { id: GSHEETS_CRED_ID, name: GSHEETS_CRED_NAME } },
      },
    ],
    connections: {
      'Correo entrante': { main: [[{ node: 'OCR', type: 'main', index: 0 }]] },
      OCR: { main: [[{ node: 'Guardar en Sheets', type: 'main', index: 0 }]] },
    },
    settings: {},
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }
  const base = process.env.N8N_BASE_URL
  const key = process.env.N8N_API_KEY
  if (!base || !key) {
    res.status(500).json({ error: 'Falta configuración de n8n (N8N_BASE_URL / N8N_API_KEY)' })
    return
  }
  try {
    const { proyectoNombre, proyectoId, tipo, email, appPassword, spreadsheetId } = (req.body || {}) as {
      proyectoNombre?: string
      proyectoId?: string
      tipo?: 'facturas' | 'dian'
      email?: string
      appPassword?: string
      spreadsheetId?: string
    }
    if (!email || !appPassword) {
      res.status(400).json({ error: 'Falta el correo o la contraseña de aplicación' })
      return
    }
    const etiqueta = tipo === 'dian' ? 'token DIAN' : 'facturas'
    const credName = `Recepción · ${proyectoNombre || proyectoId || 'proyecto'} · ${etiqueta}`
    const cred = await n8n(base, key, 'POST', '/credentials', {
      name: credName,
      type: 'imap',
      data: { user: email, password: appPassword, host: 'imap.gmail.com', port: 993, secure: true },
    })

    let workflowId: string | undefined
    let activado = false
    let aviso: string | undefined
    if (tipo === 'facturas' && spreadsheetId) {
      const wf = await n8n(base, key, 'POST', '/workflows', workflowCaptura(proyectoNombre || 'Proyecto', cred.id, credName, spreadsheetId))
      workflowId = wf.id
      try {
        const act = await n8n(base, key, 'POST', `/workflows/${workflowId}/activate`)
        activado = !!act.active
      } catch (e) {
        aviso = `Workflow creado pero no se activó automáticamente: ${(e as Error).message}`
      }
    }

    res.status(200).json({ ok: true, credentialId: cred.id, workflowId, activado, aviso })
  } catch (e) {
    res.status(500).json({ error: String((e as Error)?.message || e) })
  }
}
