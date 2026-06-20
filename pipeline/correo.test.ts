// Tests deterministas (sin API) del pipeline de correo.
// Correr: node pipeline/correo.test.ts
import { zipSync, strToU8 } from 'fflate'
import { parseUbl } from './xml.ts'
import { procesarAdjuntos } from './adjuntos.ts'
import type { Adjunto } from './tipos.ts'

let fallos = 0
function check(nombre: string, cond: boolean, detalle?: unknown) {
  console.log(`${cond ? '✓' : '✗'} ${nombre}${cond ? '' : '  → ' + JSON.stringify(detalle)}`)
  if (!cond) fallos++
}

// --- parseUbl ---
const UBL = `<?xml version="1.0"?>
<Invoice xmlns:cbc="urn:cbc" xmlns:cac="urn:cac">
  <cbc:ID>FE-4821</cbc:ID>
  <cbc:UUID>8a7f3c2e9b1d4056cufe</cbc:UUID>
  <cbc:IssueDate>2026-06-16</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party><cac:PartyTaxScheme>
    <cbc:RegistrationName>Suministros Office S.A.S.</cbc:RegistrationName>
    <cbc:CompanyID>900456789</cbc:CompanyID>
  </cac:PartyTaxScheme></cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party><cac:PartyTaxScheme>
    <cbc:RegistrationName>Distribuciones El Roble S.A.S.</cbc:RegistrationName>
    <cbc:CompanyID>901234567</cbc:CompanyID>
  </cac:PartyTaxScheme></cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount>161500</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount>850000</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount>1011500</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount>1011500</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`

const u = parseUbl(UBL)!
check('UBL: tipo', u.tipoDocumento === 'factura_venta', u.tipoDocumento)
check('UBL: numero', u.numero === 'FE-4821', u.numero)
check('UBL: cufe', u.cufe === '8a7f3c2e9b1d4056cufe', u.cufe)
check('UBL: fecha', u.fechaEmision === '2026-06-16', u.fechaEmision)
check('UBL: emisor', u.emisorNombre === 'Suministros Office S.A.S.', u.emisorNombre)
check('UBL: emisorNit', u.emisorNit === '900456789', u.emisorNit)
check('UBL: adquirenteNit', u.adquirenteNit === '901234567', u.adquirenteNit)
check('UBL: subtotal', u.subtotal === 850000, u.subtotal)
check('UBL: iva', u.iva === 161500, u.iva)
check('UBL: total', u.total === 1011500, u.total)

// UBL envuelto en CDATA (AttachedDocument)
const ATTACHED = `<AttachedDocument><cac:Attachment><cac:ExternalReference>
<cbc:Description><![CDATA[${UBL}]]></cbc:Description>
</cac:ExternalReference></cac:Attachment></AttachedDocument>`
check('UBL: desempaqueta CDATA', parseUbl(ATTACHED)?.cufe === '8a7f3c2e9b1d4056cufe', parseUbl(ATTACHED)?.cufe)

// --- procesarAdjuntos: ZIP + routing + dedup ---
const pngBytes = strToU8('PNGFAKEBYTES-123')
const zipped = zipSync({ 'factura/FE-4821.png': pngBytes, 'sobre.txt': strToU8('hola') })
const zipB64 = Buffer.from(zipped).toString('base64')

const docsZip = procesarAdjuntos([{ filename: 'envio.zip', mimeType: 'application/zip', dataBase64: zipB64 }])
check('ZIP: extrae la imagen y descarta el txt', docsZip.length === 1 && docsZip[0].tipo === 'imagen', docsZip)
check('ZIP: nombre del archivo interno', docsZip[0]?.filename === 'FE-4821.png', docsZip[0]?.filename)

// Dedup: mismo archivo dos veces → un solo documento
const png: Adjunto = { filename: 'a.png', mimeType: 'image/png', dataBase64: Buffer.from(pngBytes).toString('base64') }
const docsDup = procesarAdjuntos([png, { ...png, filename: 'b.png' }])
check('Dedup por hash', docsDup.length === 1, docsDup.length)

// XML como adjunto se enruta a 'xml'
const docsXml = procesarAdjuntos([{ filename: 'fe.xml', mimeType: 'application/xml', dataBase64: Buffer.from(UBL).toString('base64') }])
check('Routing XML', docsXml.length === 1 && docsXml[0].tipo === 'xml', docsXml[0]?.tipo)

console.log(fallos === 0 ? '\n✅ Todos los tests pasaron' : `\n❌ ${fallos} fallaron`)
process.exit(fallos === 0 ? 0 : 1)
