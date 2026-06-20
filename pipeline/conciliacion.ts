// Motor de conciliación OCR (PRD §8.3) — lógica pura, sin dependencias.
//
// Compara las lecturas de los dos modelos (DeepSeek-OCR y Gemini), normaliza
// los valores y decide si el registro queda "OK" o en "Revisión manual",
// señalando los campos en conflicto.

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

// Campos que deben coincidir EXACTO (tras normalizar) — §8.3.
const CAMPOS_CLAVE = ['cufe', 'emisorNit', 'numero', 'fechaEmision', 'total'] as const
// Campos de texto largo con comparación tolerante.
const CAMPOS_TOLERANTES = ['emisorNombre', 'adquirenteNombre'] as const

export interface ResultadoConciliacion {
  concordancia: boolean
  camposDiscrepancia: string[]
}

function normalizarTexto(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^\w]/g, '') // quita puntuación/espacios
    .toUpperCase()
}

function normalizarNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Math.round(v)
  const n = parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return isFinite(n) ? Math.round(n) : null
}

function normalizarFecha(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s) return ''
  // DD/MM/YYYY -> YYYY-MM-DD
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return s.slice(0, 10) // asume ISO
}

/** Compara dos lecturas y devuelve los campos en discrepancia. */
export function compararLecturas(a: LecturaModelo, b: LecturaModelo): ResultadoConciliacion {
  const discrepancia: string[] = []

  for (const campo of CAMPOS_CLAVE) {
    const va = a[campo]
    const vb = b[campo]
    // si ambos vacíos, no es discrepancia
    if ((va == null || va === '') && (vb == null || vb === '')) continue
    let iguales: boolean
    if (campo === 'total') {
      iguales = normalizarNumero(va) === normalizarNumero(vb)
    } else if (campo === 'fechaEmision') {
      iguales = normalizarFecha(va) === normalizarFecha(vb)
    } else {
      iguales = normalizarTexto(va) === normalizarTexto(vb)
    }
    if (!iguales) discrepancia.push(campo)
  }

  // Texto largo: tolerante (igualdad tras normalizar, o uno contiene al otro)
  for (const campo of CAMPOS_TOLERANTES) {
    const na = normalizarTexto(a[campo])
    const nb = normalizarTexto(b[campo])
    if (!na || !nb) continue
    const tolerante = na === nb || na.includes(nb) || nb.includes(na)
    if (!tolerante) discrepancia.push(campo)
  }

  return { concordancia: discrepancia.length === 0, camposDiscrepancia: discrepancia }
}

/**
 * Construye el registro consolidado a partir de las dos lecturas.
 * Si concuerdan → estado OK; si no → revisión manual con los campos marcados.
 * Para los campos sin conflicto toma el valor del modelo A (o B si A está vacío).
 */
export function consolidar(a: LecturaModelo, b: LecturaModelo) {
  const { concordancia, camposDiscrepancia } = compararLecturas(a, b)
  const pick = <K extends keyof LecturaModelo>(k: K) => (a[k] ?? b[k])
  return {
    estado: concordancia ? ('ok' as const) : ('revision_manual' as const),
    concordanciaOcr: concordancia,
    camposDiscrepancia,
    modeloA: a,
    modeloB: b,
    // valores consolidados (provisional; en revisión el humano confirma)
    tipoDocumento: pick('tipoDocumento'),
    prefijo: pick('prefijo'),
    numero: pick('numero'),
    cufe: pick('cufe'),
    emisorNombre: pick('emisorNombre'),
    emisorNit: pick('emisorNit'),
    adquirenteNombre: pick('adquirenteNombre'),
    adquirenteNit: pick('adquirenteNit'),
    fechaEmision: normalizarFecha(pick('fechaEmision')),
    subtotal: normalizarNumero(pick('subtotal')) ?? 0,
    iva: normalizarNumero(pick('iva')) ?? 0,
    otrosImpuestos: normalizarNumero(pick('otrosImpuestos')) ?? 0,
    total: normalizarNumero(pick('total')) ?? 0,
    moneda: pick('moneda') ?? 'COP',
  }
}
