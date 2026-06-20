import type { TaxConfig } from './engine'

// ⚠️ Parámetros por defecto. Son EDITABLES desde la pantalla de Configuración.
// El contador es responsable de verificar el UVT y las tarifas vigentes cada año.
//
// UVT de referencia (último valor confirmado): 2025 = $49.799.
// Actualiza el valor y el año en Configuración para el periodo en curso.

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  uvt: 49799,
  anioUvt: 2025,

  ivaRates: [
    { value: 0, label: 'Excluido / Exento (0%)' },
    { value: 0.05, label: 'IVA 5%' },
    { value: 0.19, label: 'IVA 19%' },
  ],

  retefuenteConcepts: [
    {
      id: 'compras_generales',
      label: 'Compras generales',
      baseUvt: 27,
      rate: 0.025,
      nota: 'Declarantes 2,5% · no declarantes 3,5%',
    },
    {
      id: 'servicios_generales',
      label: 'Servicios generales',
      baseUvt: 4,
      rate: 0.04,
      nota: 'Declarantes 4% · no declarantes 6%',
    },
    {
      id: 'honorarios_juridica',
      label: 'Honorarios y comisiones (persona jurídica)',
      baseUvt: 0,
      rate: 0.11,
    },
    {
      id: 'honorarios_natural',
      label: 'Honorarios y comisiones (persona natural)',
      baseUvt: 0,
      rate: 0.1,
      nota: '11% si los pagos del año superan 3.300 UVT',
    },
    {
      id: 'arrendamiento_inmueble',
      label: 'Arrendamiento de bienes inmuebles',
      baseUvt: 27,
      rate: 0.035,
    },
    {
      id: 'arrendamiento_mueble',
      label: 'Arrendamiento de bienes muebles',
      baseUvt: 0,
      rate: 0.04,
    },
    {
      id: 'transporte_carga',
      label: 'Servicio de transporte de carga',
      baseUvt: 4,
      rate: 0.01,
    },
    {
      id: 'transporte_pasajeros',
      label: 'Transporte de pasajeros (terrestre)',
      baseUvt: 27,
      rate: 0.035,
    },
    {
      id: 'aseo_vigilancia',
      label: 'Aseo y vigilancia',
      baseUvt: 4,
      rate: 0.02,
      nota: 'Sobre AIU (mínimo 10% del valor)',
    },
    {
      id: 'compras_agricolas',
      label: 'Compras de productos agrícolas sin procesar',
      baseUvt: 92,
      rate: 0.015,
    },
  ],

  reteIvaRate: 0.15,
  reteIvaBaseUvt: 4,

  reteIcaPresets: [
    { ciudad: 'Sin reteICA', porMil: 0 },
    { ciudad: 'Bogotá — Servicios (9,66‰)', porMil: 9.66 },
    { ciudad: 'Bogotá — Comercio (11,04‰)', porMil: 11.04 },
    { ciudad: 'Bogotá — Industrial (4,14‰)', porMil: 4.14 },
    { ciudad: 'Medellín — general (7‰)', porMil: 7 },
    { ciudad: 'Cali — general (11‰)', porMil: 11 },
  ],
}
