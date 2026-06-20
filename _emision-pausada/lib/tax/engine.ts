// Motor tributario Colombia — IVA, retención en la fuente, reteIVA, reteICA.
//
// Diseño: todos los parámetros (UVT, tarifas, conceptos) viven en TaxConfig,
// que es editable por el contador. El motor es una función pura para que sea
// fácil de probar y de auditar.

export interface RetencionConcepto {
  id: string
  label: string
  /** Base mínima en UVT para que aplique la retención. 0 = sin mínimo. */
  baseUvt: number
  /** Tarifa en decimal (ej. 0.025 = 2.5%). */
  rate: number
  /** Nota aclaratoria (declarante/no declarante, etc.). */
  nota?: string
}

export interface ReteIcaPreset {
  ciudad: string
  /** Tarifa por mil (ej. 9.66 => 0.966%). */
  porMil: number
}

export interface TaxConfig {
  /** Valor de la UVT vigente (pesos). Debe verificarse cada año. */
  uvt: number
  /** Año al que corresponde la UVT configurada. */
  anioUvt: number
  /** Tarifas de IVA disponibles para los ítems. */
  ivaRates: { value: number; label: string }[]
  /** Conceptos de retención en la fuente (renta). */
  retefuenteConcepts: RetencionConcepto[]
  /** Tarifa de retención de IVA (decimal). Típico: 0.15 del IVA. */
  reteIvaRate: number
  /** Base mínima en UVT para reteIVA (servicios = 4, compras = 27). */
  reteIvaBaseUvt: number
  /** Presets de tarifa de reteICA por ciudad (por mil). */
  reteIcaPresets: ReteIcaPreset[]
}

export interface ComputeItem {
  cantidad: number
  valorUnitario: number
  ivaRate: number
}

export interface ComputeInput {
  items: ComputeItem[]
  retefuenteConceptId?: string | null
  aplicaReteIva: boolean
  /** Tarifa por mil de reteICA (0 = no aplica). */
  reteIcaPorMil: number
}

export interface IvaPorTarifa {
  rate: number
  base: number
  iva: number
}

export interface InvoiceTotals {
  subtotal: number
  ivaTotal: number
  ivaPorTarifa: IvaPorTarifa[]
  retefuente: number
  /** true si la base superó el mínimo en UVT y por tanto se aplicó. */
  retefuenteAplicada: boolean
  retefuenteConcepto?: RetencionConcepto
  reteIva: number
  reteIca: number
  /** subtotal + IVA (antes de retenciones) */
  totalBruto: number
  totalRetenciones: number
  /** total a pagar = bruto - retenciones */
  totalNeto: number
}

const round = (n: number): number => Math.round(n || 0)

/**
 * Calcula todos los totales de una factura a partir de sus ítems y los
 * parámetros de retención aplicados. Función pura.
 */
export function computeTotals(input: ComputeInput, config: TaxConfig): InvoiceTotals {
  const items = (input.items || []).filter(
    (it) => (it.cantidad || 0) > 0 || (it.valorUnitario || 0) > 0,
  )

  let subtotal = 0
  const ivaMap = new Map<number, { base: number; iva: number }>()

  for (const it of items) {
    const base = (it.cantidad || 0) * (it.valorUnitario || 0)
    subtotal += base
    const rate = it.ivaRate || 0
    const cur = ivaMap.get(rate) || { base: 0, iva: 0 }
    cur.base += base
    cur.iva += base * rate
    ivaMap.set(rate, cur)
  }

  const ivaPorTarifa: IvaPorTarifa[] = [...ivaMap.entries()]
    .map(([rate, v]) => ({ rate, base: round(v.base), iva: round(v.iva) }))
    .sort((a, b) => a.rate - b.rate)

  const ivaTotal = round([...ivaMap.values()].reduce((s, v) => s + v.iva, 0))
  subtotal = round(subtotal)

  // --- Retención en la fuente (renta) ---
  let retefuente = 0
  let retefuenteAplicada = false
  const concepto = config.retefuenteConcepts.find(
    (c) => c.id === input.retefuenteConceptId,
  )
  if (concepto) {
    const minBase = concepto.baseUvt * config.uvt
    if (subtotal >= minBase) {
      retefuente = round(subtotal * concepto.rate)
      retefuenteAplicada = true
    }
  }

  // --- ReteIVA ---
  let reteIva = 0
  if (input.aplicaReteIva && ivaTotal > 0) {
    const minBase = config.reteIvaBaseUvt * config.uvt
    if (subtotal >= minBase) {
      reteIva = round(ivaTotal * config.reteIvaRate)
    }
  }

  // --- ReteICA ---
  let reteIca = 0
  if (input.reteIcaPorMil && input.reteIcaPorMil > 0) {
    reteIca = round(subtotal * (input.reteIcaPorMil / 1000))
  }

  const totalBruto = subtotal + ivaTotal
  const totalRetenciones = retefuente + reteIva + reteIca
  const totalNeto = totalBruto - totalRetenciones

  return {
    subtotal,
    ivaTotal,
    ivaPorTarifa,
    retefuente,
    retefuenteAplicada,
    retefuenteConcepto: concepto,
    reteIva,
    reteIca,
    totalBruto,
    totalRetenciones,
    totalNeto,
  }
}
