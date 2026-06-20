// Test del motor de conciliación. Correr: node pipeline/conciliacion.test.ts
import { compararLecturas, consolidar, type LecturaModelo } from './conciliacion.ts'

let fallos = 0
function check(nombre: string, cond: boolean, detalle?: unknown) {
  const ok = cond
  console.log(`${ok ? '✓' : '✗'} ${nombre}${ok ? '' : '  → ' + JSON.stringify(detalle)}`)
  if (!ok) fallos++
}

// 1. Lecturas idénticas → concuerdan
const a1: LecturaModelo = { cufe: 'ABC', emisorNit: '900123', numero: '101', fechaEmision: '2026-06-12', total: 1190000, emisorNombre: 'Papelería Nacional SAS' }
const r1 = compararLecturas(a1, { ...a1 })
check('idénticas concuerdan', r1.concordancia && r1.camposDiscrepancia.length === 0, r1)

// 2. Total distinto → discrepancia ['total']
const r2 = compararLecturas(a1, { ...a1, total: 1990000 })
check('total distinto marca total', !r2.concordancia && r2.camposDiscrepancia.join() === 'total', r2)

// 3. NIT emisor distinto → ['emisorNit']
const r3 = compararLecturas(a1, { ...a1, emisorNit: '900128' })
check('nit distinto marca emisorNit', !r3.concordancia && r3.camposDiscrepancia.join() === 'emisorNit', r3)

// 4. Razón social con formato distinto (SAS vs S.A.S.) → tolerante, sin discrepancia
const r4 = compararLecturas(a1, { ...a1, emisorNombre: 'Papelería Nacional S.A.S.' })
check('razón social tolerante a puntuación', r4.concordancia, r4)

// 5. Fecha en formato distinto (DD/MM/YYYY) → normaliza, sin discrepancia
const r5 = compararLecturas(a1, { ...a1, fechaEmision: '12/06/2026' })
check('fecha tolerante a formato', r5.concordancia, r5)

// 6. Acentos en emisor → normaliza sin discrepancia
const r6 = compararLecturas({ emisorNombre: 'PAPELERIA' }, { emisorNombre: 'Papelería' })
check('acentos normalizados', r6.concordancia, r6)

// 7. consolidar() arma el registro con estado correcto
const c1 = consolidar(a1, { ...a1, total: 1990000 })
check('consolidar marca revisión y toma total de A', c1.estado === 'revision_manual' && c1.total === 1190000, c1)
const c2 = consolidar(a1, { ...a1 })
check('consolidar OK cuando concuerda', c2.estado === 'ok' && c2.concordanciaOcr === true, c2)

console.log(fallos === 0 ? '\n✅ Todos los tests pasaron' : `\n❌ ${fallos} test(s) fallaron`)
process.exit(fallos === 0 ? 0 : 1)
