import type { FacturaRecibida, Proyecto } from '../types'
import { LocalStorageAdapter } from './local'
import { SheetsAdapter } from './sheets'

// Interfaz común de persistencia. La app solo conoce esta interfaz; el backend
// concreto (navegador local o Google Sheets/Drive) es intercambiable.
//
// Modelo PRD §11.1: 1 carpeta por contador + 1 hoja por proyecto/cliente.
// En el MVP demoable usamos el adaptador local; el de Sheets se conecta luego.
export interface DataStore {
  readonly kind: 'local' | 'sheets'
  listProyectos(): Promise<Proyecto[]>
  saveProyecto(p: Proyecto): Promise<Proyecto>
  deleteProyecto(id: string): Promise<void>
  listFacturas(): Promise<FacturaRecibida[]>
  saveFactura(f: FacturaRecibida): Promise<FacturaRecibida>
  deleteFactura(id: string): Promise<void>
}

const SHEETS_URL_KEY = 'recepcion.sheetsUrl'

export function getSheetsUrl(): string | null {
  try {
    return localStorage.getItem(SHEETS_URL_KEY)
  } catch {
    return null
  }
}

export function setSheetsUrl(url: string | null): void {
  try {
    if (url) localStorage.setItem(SHEETS_URL_KEY, url)
    else localStorage.removeItem(SHEETS_URL_KEY)
  } catch {
    /* ignore */
  }
}

export function createStore(): DataStore {
  const url = getSheetsUrl()
  if (url) return new SheetsAdapter(url)
  return new LocalStorageAdapter()
}
