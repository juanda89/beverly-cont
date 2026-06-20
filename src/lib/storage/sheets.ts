import type { FacturaRecibida, Proyecto } from '../types'
import type { DataStore } from './index'

// Adaptador de Google Sheets / Drive (Apps Script Web App).
// Pendiente de conexión real (Fase 1): aquí queda la interfaz lista para
// hablar con el Apps Script que provisiona 1 carpeta por contador y 1 hoja
// por proyecto. Para evitar el preflight CORS, los POST usan text/plain.

interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

export class SheetsAdapter implements DataStore {
  readonly kind = 'sheets' as const
  constructor(private readonly url: string) {}

  private async call<T>(action: string, payload?: unknown): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload }),
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} desde Google Sheets`)
    const json = (await res.json()) as ApiResponse<T>
    if (!json.ok) throw new Error(json.error || 'Error en el Apps Script')
    return json.data as T
  }

  listProyectos(): Promise<Proyecto[]> {
    return this.call<Proyecto[]>('listProyectos')
  }
  saveProyecto(p: Proyecto): Promise<Proyecto> {
    return this.call<Proyecto>('saveProyecto', p)
  }
  deleteProyecto(id: string): Promise<void> {
    return this.call<void>('deleteProyecto', { id })
  }
  listFacturas(): Promise<FacturaRecibida[]> {
    return this.call<FacturaRecibida[]>('listFacturas')
  }
  saveFactura(f: FacturaRecibida): Promise<FacturaRecibida> {
    return this.call<FacturaRecibida>('saveFactura', f)
  }
  deleteFactura(id: string): Promise<void> {
    return this.call<void>('deleteFactura', { id })
  }
}
