// Tipos de dominio — facturación / gestión Colombia

export type TipoDocumento = 'NIT' | 'CC' | 'CE' | 'PASAPORTE'

export type Responsabilidad =
  | 'responsable_iva' // antes "régimen común"
  | 'no_responsable_iva' // antes "régimen simplificado"
  | 'gran_contribuyente'
  | 'regimen_simple'

export interface Cliente {
  id: string
  tipoDocumento: TipoDocumento
  documento: string
  dv?: string // dígito de verificación (NIT)
  razonSocial: string
  email?: string
  telefono?: string
  direccion?: string
  ciudad?: string
  declaranteRenta: boolean
  autorretenedor: boolean
  responsabilidad: Responsabilidad
  createdAt: string
}

export type EstadoFactura = 'borrador' | 'emitida' | 'pagada' | 'anulada'

export interface ItemFactura {
  id: string
  descripcion: string
  cantidad: number
  valorUnitario: number
  ivaRate: number // 0 | 0.05 | 0.19
}

export interface Factura {
  id: string
  numero: string // consecutivo
  clienteId: string
  fecha: string // ISO (YYYY-MM-DD)
  fechaVencimiento?: string
  items: ItemFactura[]
  // parámetros de retención aplicados a esta factura
  retefuenteConceptId?: string | null
  aplicaReteIva: boolean
  reteIcaPorMil: number // tarifa x mil (0 = no aplica)
  notas?: string
  estado: EstadoFactura
  createdAt: string
}

export const RESPONSABILIDAD_LABELS: Record<Responsabilidad, string> = {
  responsable_iva: 'Responsable de IVA',
  no_responsable_iva: 'No responsable de IVA',
  gran_contribuyente: 'Gran contribuyente',
  regimen_simple: 'Régimen simple de tributación',
}

export const ESTADO_LABELS: Record<EstadoFactura, string> = {
  borrador: 'Borrador',
  emitida: 'Emitida',
  pagada: 'Pagada',
  anulada: 'Anulada',
}
