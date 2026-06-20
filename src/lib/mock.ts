import type { FacturaRecibida, Proyecto } from './types'

// Datos de demostración para el MVP de recepción (sin backend real todavía).
// Se siembran en el almacén local la primera vez que se abre la app.

export const MOCK_PROYECTOS: Proyecto[] = [
  {
    id: 'p1',
    nombre: 'Distribuciones El Roble S.A.S.',
    tipoDocumento: 'NIT',
    identificacion: '901234567',
    dv: '8',
    gmailConectado: true,
    gmailCuenta: 'contabilidad@elroble.co',
    dianProveedor: '',
    creadoEn: '2026-05-02T10:00:00Z',
  },
  {
    id: 'p2',
    nombre: 'Inversiones Maracay Ltda.',
    tipoDocumento: 'NIT',
    identificacion: '830111222',
    dv: '3',
    gmailConectado: true,
    gmailCuenta: 'facturas.maracay@gmail.com',
    dianProveedor: '',
    creadoEn: '2026-05-10T10:00:00Z',
  },
  {
    id: 'p3',
    nombre: 'Cafetería Aroma',
    tipoDocumento: 'NIT',
    identificacion: '901555444',
    dv: '1',
    gmailConectado: false,
    creadoEn: '2026-06-17T10:00:00Z',
  },
]

const cufe = (s: string) => (s + '0'.repeat(96)).slice(0, 96)

function base(
  f: Partial<FacturaRecibida> & Pick<FacturaRecibida, 'id' | 'proyectoId' | 'numero' | 'emisorNombre' | 'emisorNit' | 'fechaEmision' | 'total'>,
): FacturaRecibida {
  const subtotal = f.subtotal ?? Math.round(f.total / 1.19)
  return {
    fuente: 'correo',
    estado: 'ok',
    cufe: cufe(f.id),
    tipoDocumento: 'factura_venta',
    prefijo: 'FE',
    adquirenteNombre: 'Distribuciones El Roble S.A.S.',
    adquirenteNit: '901234567',
    moneda: 'COP',
    subtotal,
    iva: f.total - subtotal,
    otrosImpuestos: 0,
    estadoDian: 'aceptada',
    concordanciaOcr: true,
    fechaRecepcion: f.fechaEmision,
    creadoEn: f.fechaEmision + 'T12:00:00Z',
    actualizadoEn: f.fechaEmision + 'T12:00:00Z',
    ...f,
  } as FacturaRecibida
}

export const MOCK_FACTURAS: FacturaRecibida[] = [
  base({ id: 'f1', proyectoId: 'p1', numero: '47821', emisorNombre: 'Comunicaciones Claro S.A.', emisorNit: '800153993', fechaEmision: '2026-06-15', total: 238000, fuente: 'correo' }),
  base({ id: 'f2', proyectoId: 'p1', numero: '90551', emisorNombre: 'Empresas Públicas de Medellín E.S.P.', emisorNit: '890904996', fechaEmision: '2026-06-10', total: 412500, fuente: 'dian' }),
  // Discrepancia en TOTAL → revisión manual
  base({
    id: 'f3', proyectoId: 'p1', numero: '10293', emisorNombre: 'Papelería Nacional Ltda.', emisorNit: '860005289',
    fechaEmision: '2026-06-12', total: 1190000, fuente: 'correo', estado: 'revision_manual',
    concordanciaOcr: false, camposDiscrepancia: ['total'], estadoDian: 'en_proceso',
    modeloA: { numero: '10293', cufe: cufe('f3'), emisorNit: '860005289', total: 1190000, fechaEmision: '2026-06-12' },
    modeloB: { numero: '10293', cufe: cufe('f3'), emisorNit: '860005289', total: 1990000, fechaEmision: '2026-06-12' },
  }),
  base({ id: 'f4', proyectoId: 'p1', numero: '33120', emisorNombre: 'Servientrega S.A.', emisorNit: '860512330', fechaEmision: '2026-06-08', total: 96000, fuente: 'correo' }),
  base({ id: 'f5', proyectoId: 'p1', numero: '5510', emisorNombre: 'Distribuidora La 14 S.A.', emisorNit: '805000000', fechaEmision: '2026-06-05', total: 150000, fuente: 'dian', tipoDocumento: 'nota_credito' }),

  base({ id: 'f6', proyectoId: 'p2', numero: 'GC-88120', emisorNombre: 'Google Cloud Colombia S.A.S.', emisorNit: '901090000', fechaEmision: '2026-06-14', total: 1547800, fuente: 'correo', adquirenteNombre: 'Inversiones Maracay Ltda.', adquirenteNit: '830111222' }),
  base({ id: 'f7', proyectoId: 'p2', numero: '2025-441', emisorNombre: 'Arrendamientos Bogotá S.A.S.', emisorNit: '830055111', fechaEmision: '2026-06-11', total: 3500000, fuente: 'dian', adquirenteNombre: 'Inversiones Maracay Ltda.', adquirenteNit: '830111222' }),
  // Discrepancia en NIT del emisor → revisión manual
  base({
    id: 'f8', proyectoId: 'p2', numero: '77410', emisorNombre: 'Suministros Industriales SAS', emisorNit: '901222333',
    fechaEmision: '2026-06-09', total: 845000, fuente: 'correo', estado: 'revision_manual',
    concordanciaOcr: false, camposDiscrepancia: ['emisorNit'], estadoDian: 'aceptada',
    adquirenteNombre: 'Inversiones Maracay Ltda.', adquirenteNit: '830111222',
    modeloA: { numero: '77410', emisorNit: '901222333', emisorNombre: 'Suministros Industriales SAS', total: 845000 },
    modeloB: { numero: '77410', emisorNit: '901222338', emisorNombre: 'Suministros Industriales S.A.S.', total: 845000 },
  }),
]
