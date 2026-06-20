// Extractor de facturas electrónicas en XML UBL 2.1 (DIAN). Best-effort por
// regex: el XML es la fuente con validez legal, así que cuando viene se usa
// directamente en vez del OCR.

import type { LecturaModelo } from './conciliacion.ts'

function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

/** Si el XML envuelve un Invoice/CreditNote en CDATA (AttachedDocument), lo extrae. */
function unwrap(xml: string): string {
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(xml)
  if (cdata && /<(\w+:)?(Invoice|CreditNote|DebitNote)/.test(cdata[1])) return cdata[1]
  // a veces viene escapado sin CDATA
  if (/&lt;(\w+:)?(Invoice|CreditNote)/.test(xml)) return decode(xml)
  return xml
}

function tag(xml: string, name: string): string | undefined {
  const m = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i').exec(xml)
  return m ? decode(m[1].trim()) : undefined
}

function block(xml: string, name: string): string | undefined {
  const m = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i').exec(xml)
  return m ? m[1] : undefined
}

function num(v?: string): number | undefined {
  if (!v) return undefined
  const n = parseFloat(v.replace(/[^\d.-]/g, ''))
  return isFinite(n) ? n : undefined
}

/** Devuelve los datos de la factura desde el XML, o null si no parece UBL. */
export function parseUbl(xmlRaw: string): LecturaModelo | null {
  const xml = unwrap(xmlRaw)
  if (!/<(?:\w+:)?(Invoice|CreditNote|DebitNote)\b/i.test(xml)) return null

  const tipoDocumento = /<(?:\w+:)?CreditNote\b/i.test(xml)
    ? 'nota_credito'
    : /<(?:\w+:)?DebitNote\b/i.test(xml)
      ? 'nota_debito'
      : 'factura_venta'

  // número de factura: primer cbc:ID antes del primer Party
  const beforeParty = xml.split(/<(?:\w+:)?AccountingSupplierParty/i)[0]
  const numero = tag(beforeParty, 'ID')

  const supplier = block(xml, 'AccountingSupplierParty') ?? ''
  const customer = block(xml, 'AccountingCustomerParty') ?? ''
  const totals = block(xml, 'LegalMonetaryTotal') ?? xml
  const taxBlock = block(xml, 'TaxTotal') ?? ''

  return {
    tipoDocumento,
    numero,
    cufe: tag(xml, 'UUID'),
    fechaEmision: tag(xml, 'IssueDate'),
    emisorNombre: tag(supplier, 'RegistrationName') ?? tag(supplier, 'Name'),
    emisorNit: (tag(supplier, 'CompanyID') ?? '').replace(/[^\d]/g, '') || undefined,
    adquirenteNombre: tag(customer, 'RegistrationName') ?? tag(customer, 'Name'),
    adquirenteNit: (tag(customer, 'CompanyID') ?? '').replace(/[^\d]/g, '') || undefined,
    subtotal: num(tag(totals, 'LineExtensionAmount') ?? tag(totals, 'TaxExclusiveAmount')),
    iva: num(tag(taxBlock, 'TaxAmount')),
    otrosImpuestos: 0,
    total: num(tag(totals, 'PayableAmount') ?? tag(totals, 'TaxInclusiveAmount')),
    moneda: tag(xml, 'DocumentCurrencyCode') ?? 'COP',
  }
}
