// Dominio — Captura y conciliación de facturas RECIBIDAS (PRD v1.0)

export type TipoDocEmpresa = 'NIT' | 'CC' | 'CE'

/** Proyecto = una empresa cliente que el contador atiende. */
export interface Proyecto {
  id: string
  nombre: string
  tipoDocumento: TipoDocEmpresa
  identificacion: string // NIT de la empresa (para la DIAN)
  dv?: string
  // Conexión de correo (Gmail) — solo lectura
  gmailConectado: boolean
  gmailCuenta?: string
  // DIAN
  dianProveedor?: string // proveedor API (Opción A) si aplica
  creadoEn: string
}

export type Fuente = 'correo' | 'dian'

export type EstadoFactura =
  | 'ok'
  | 'revision_manual'
  | 'cargada_alegra'
  | 'cargada_qenta'

export type TipoDocumentoFE =
  | 'factura_venta'
  | 'nota_credito'
  | 'nota_debito'
  | 'documento_soporte'

export type EstadoDian = 'aceptada' | 'rechazada' | 'en_proceso' | ''

/** Lectura estructurada que devuelve un modelo OCR. */
export interface LecturaModelo {
  tipoDocumento?: string
  prefijo?: string
  numero?: string
  cufe?: string
  emisorNombre?: string
  emisorNit?: string
  adquirenteNombre?: string
  adquirenteNit?: string
  fechaEmision?: string
  subtotal?: number
  iva?: number
  otrosImpuestos?: number
  total?: number
  moneda?: string
}

/** Una factura recibida (fila de la tabla consolidada, §11.2). */
export interface FacturaRecibida {
  id: string // id_registro
  proyectoId: string
  fuente: Fuente
  estado: EstadoFactura
  cufe: string // cufe_cude — clave de conciliación
  tipoDocumento: TipoDocumentoFE
  prefijo?: string
  numero: string
  emisorNombre: string
  emisorNit: string
  adquirenteNombre?: string
  adquirenteNit?: string
  fechaEmision: string // YYYY-MM-DD
  fechaRecepcion?: string
  moneda: string
  subtotal: number
  iva: number
  otrosImpuestos: number
  total: number
  estadoDian?: EstadoDian
  // Conciliación OCR
  concordanciaOcr: boolean
  camposDiscrepancia?: string[]
  modeloA?: LecturaModelo
  modeloB?: LecturaModelo
  // Enlaces a archivos
  archivoOrigen?: string
  pdfDian?: string
  xml?: string
  // Carga contable (Fase 2)
  cargadaAlegra?: string
  cargadaQenta?: string
  creadoEn: string
  actualizadoEn: string
}

// --- Etiquetas para la UI ---

export const FUENTE_LABELS: Record<Fuente, string> = {
  correo: 'Correo',
  dian: 'DIAN',
}

export const ESTADO_LABELS: Record<EstadoFactura, string> = {
  ok: 'OK',
  revision_manual: 'Revisión manual',
  cargada_alegra: 'Cargada en Alegra',
  cargada_qenta: 'Cargada en Qenta',
}

export const TIPO_DOC_FE_LABELS: Record<TipoDocumentoFE, string> = {
  factura_venta: 'Factura de venta',
  nota_credito: 'Nota crédito',
  nota_debito: 'Nota débito',
  documento_soporte: 'Documento soporte',
}

export const ESTADO_DIAN_LABELS: Record<Exclude<EstadoDian, ''>, string> = {
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  en_proceso: 'En proceso',
}

/** Etiqueta legible de cada campo (para resaltar discrepancias). */
export const CAMPO_LABELS: Record<string, string> = {
  cufe: 'CUFE',
  numero: 'Número',
  prefijo: 'Prefijo',
  tipoDocumento: 'Tipo de documento',
  emisorNombre: 'Emisor',
  emisorNit: 'NIT emisor',
  adquirenteNombre: 'Adquirente',
  adquirenteNit: 'NIT adquirente',
  fechaEmision: 'Fecha de emisión',
  subtotal: 'Subtotal',
  iva: 'IVA',
  otrosImpuestos: 'Otros impuestos',
  total: 'Total',
  moneda: 'Moneda',
}
