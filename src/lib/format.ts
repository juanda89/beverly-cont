// Utilidades de formato para moneda y números (Colombia)

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 2,
})

/** Formatea un valor en pesos colombianos: $ 1.234.567 */
export function formatCOP(value: number): string {
  if (!isFinite(value)) return '$ 0'
  return copFormatter.format(Math.round(value))
}

/** Formatea un número con separador de miles es-CO */
export function formatNumber(value: number): string {
  if (!isFinite(value)) return '0'
  return numberFormatter.format(value)
}

/** Convierte un string ingresado por el usuario (con puntos/comas) a número. */
export function parseNumber(input: string): number {
  if (typeof input === 'number') return input
  if (!input) return 0
  // quita todo lo que no sea dígito, coma, punto o signo
  const cleaned = String(input)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // puntos de miles
    .replace(',', '.') // coma decimal -> punto
  const n = parseFloat(cleaned)
  return isFinite(n) ? n : 0
}

/** Formato de fecha legible: 19 jun 2026 */
export function formatFecha(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Fecha de hoy en formato YYYY-MM-DD */
export function hoyISO(): string {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}
