import type { FacturaRecibida, Proyecto } from '../types'
import type { DataStore } from './index'

// Adaptador de almacenamiento en el navegador (localStorage).
// Modo de desarrollo / demo sin backend.

const K_PROYECTOS = 'recepcion.proyectos'
const K_FACTURAS = 'recepcion.facturas'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export class LocalStorageAdapter implements DataStore {
  readonly kind = 'local' as const

  async listProyectos(): Promise<Proyecto[]> {
    return read<Proyecto[]>(K_PROYECTOS, [])
  }

  async saveProyecto(p: Proyecto): Promise<Proyecto> {
    const all = await this.listProyectos()
    const idx = all.findIndex((x) => x.id === p.id)
    if (idx >= 0) all[idx] = p
    else all.push(p)
    write(K_PROYECTOS, all)
    return p
  }

  async deleteProyecto(id: string): Promise<void> {
    const all = (await this.listProyectos()).filter((x) => x.id !== id)
    write(K_PROYECTOS, all)
    // arrastra sus facturas
    const fs = (await this.listFacturas()).filter((f) => f.proyectoId !== id)
    write(K_FACTURAS, fs)
  }

  async listFacturas(): Promise<FacturaRecibida[]> {
    return read<FacturaRecibida[]>(K_FACTURAS, [])
  }

  async saveFactura(f: FacturaRecibida): Promise<FacturaRecibida> {
    const all = await this.listFacturas()
    const idx = all.findIndex((x) => x.id === f.id)
    if (idx >= 0) all[idx] = f
    else all.push(f)
    write(K_FACTURAS, all)
    return f
  }

  async deleteFactura(id: string): Promise<void> {
    const all = (await this.listFacturas()).filter((x) => x.id !== id)
    write(K_FACTURAS, all)
  }
}
