// Integración con Google desde el navegador (Google Identity Services + Drive
// API), scope drive.file. El contador está presente, así que el access token
// vive en memoria (no se persiste). El Client ID es público; el secreto no se
// usa en este flujo.

const SCOPE = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ')

// Tipos mínimos de GIS (evita depender de @types).
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

/** Lanza el consentimiento de Google y devuelve un access token. */
export async function conectar(clientId: string): Promise<string> {
  await initClient(clientId)
  return new Promise((resolve, reject) => {
    tokenClient!.callback = (resp) => {
      if (resp.error || !resp.access_token) reject(new Error(resp.error || 'Conexión cancelada'))
      else {
        accessToken = resp.access_token
        resolve(resp.access_token)
      }
    }
    tokenClient!.requestAccessToken({ prompt: 'consent' })
  })
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

/** Crea una hoja de cálculo para un cliente dentro de la carpeta. Devuelve su id. */
export async function crearSheetCliente(token: string, folderId: string, nombre: string): Promise<string> {
  const ss = await gfetch('https://sheets.googleapis.com/v4/spreadsheets', token, {
    method: 'POST',
    body: JSON.stringify({ properties: { title: nombre } }),
  })
  const id = ss.spreadsheetId as string
  // mover a la carpeta del contador
  await gfetch(`https://www.googleapis.com/drive/v3/files/${id}?addParents=${folderId}&fields=id`, token, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
  return id
}
