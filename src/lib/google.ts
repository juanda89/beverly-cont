// Integración con Google desde el navegador (Google Identity Services + Drive
// API), scope drive.file. El contador está presente, así que el access token
// vive en memoria (no se persiste). El Client ID es público; el secreto no se
// usa en este flujo.

const SCOPE = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

interface TokenClient {
  callback: (resp: { access_token?: string; error?: string }) => void
  requestAccessToken: (opts?: { prompt?: string }) => void
}
declare global {
  interface Window {
    google?: {
      accounts: { oauth2: { initTokenClient: (cfg: Record<string, unknown>) => TokenClient } }
    }
  }
}

let scriptPromise: Promise<void> | null = null
let tokenClient: TokenClient | null = null
let accessToken: string | null = null

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

async function initClient(clientId: string): Promise<void> {
  await loadScript()
  if (tokenClient) return
  tokenClient = window.google!.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: () => {},
  })
}

function pedirToken(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    tokenClient!.callback = (resp) => {
      if (resp.error || !resp.access_token) reject(new Error(resp.error || 'Conexión cancelada'))
      else {
        accessToken = resp.access_token
        resolve(resp.access_token)
      }
    }
    tokenClient!.requestAccessToken({ prompt })
  })
}

/** Lanza el consentimiento de Google y devuelve un access token. */
export async function conectar(clientId: string): Promise<string> {
  await initClient(clientId)
  return pedirToken('consent')
}

/** Devuelve un token válido; si no hay, lo pide en silencio (sin re-consentir). */
export async function ensureToken(clientId: string): Promise<string> {
  await initClient(clientId)
  return accessToken || pedirToken('')
}

export function getToken(): string | null {
  return accessToken
}

async function gfetch(url: string, token: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) throw new Error(`Google API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

export async function getEmail(token: string): Promise<string> {
  const j = await gfetch('https://www.googleapis.com/oauth2/v3/userinfo', token)
  return j.email
}

/** Crea (o reutiliza) la carpeta raíz del contador. Devuelve su id. */
export async function ensureCarpeta(token: string, nombre: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${nombre.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  )
  const found = await gfetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, token)
  if (found.files?.length) return found.files[0].id
  const created = await gfetch('https://www.googleapis.com/drive/v3/files', token, {
    method: 'POST',
    body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder' }),
  })
  return created.id
}

const ENCABEZADOS = [
  'ID', 'Fuente', 'Estado', 'CUFE', 'Tipo', 'Prefijo', 'Número', 'Emisor', 'NIT emisor',
  'Adquirente', 'NIT adquirente', 'Fecha emisión', 'Fecha recepción', 'Moneda',
  'Subtotal', 'IVA', 'Otros impuestos', 'Total', 'Estado DIAN', 'Concordancia OCR',
  'Creado', 'Actualizado',
]

/** Crea la hoja de cálculo de un cliente dentro de la carpeta, con encabezados. */
export async function crearSheetCliente(token: string, folderId: string, nombre: string): Promise<string> {
  const ss = await gfetch('https://sheets.googleapis.com/v4/spreadsheets', token, {
    method: 'POST',
    body: JSON.stringify({ properties: { title: nombre }, sheets: [{ properties: { title: 'Facturas' } }] }),
  })
  const id = ss.spreadsheetId as string
  // mover a la carpeta del contador
  await gfetch(`https://www.googleapis.com/drive/v3/files/${id}?addParents=${folderId}&fields=id`, token, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
  // escribir encabezados
  await gfetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Facturas!A1?valueInputOption=RAW`,
    token,
    { method: 'PUT', body: JSON.stringify({ values: [ENCABEZADOS] }) },
  )
  return id
}
