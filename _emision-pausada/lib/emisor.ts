// Datos de la empresa emisora (quien factura). Se guardan localmente en el
// navegador; rara vez cambian y no dependen del backend de datos.

export interface Emisor {
  razonSocial: string
  tipoDocumento: 'NIT' | 'CC'
  nit: string
  dv?: string
  regimen: string
  direccion: string
  ciudad: string
  telefono: string
  email: string
  /** Texto de resolución de numeración DIAN / leyenda legal. */
  resolucion?: string
}

const KEY = 'facturador.emisor'

export const EMISOR_VACIO: Emisor = {
  razonSocial: '',
  tipoDocumento: 'NIT',
  nit: '',
  dv: '',
  regimen: 'Responsable de IVA',
  direccion: '',
  ciudad: '',
  telefono: '',
  email: '',
  resolucion: '',
}

export function getEmisor(): Emisor {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMISOR_VACIO, ...(JSON.parse(raw) as Emisor) } : EMISOR_VACIO
  } catch {
    return EMISOR_VACIO
  }
}

export function setEmisor(e: Emisor): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(e))
  } catch {
    /* ignore */
  }
}
