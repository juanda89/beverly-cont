import type { VercelRequest, VercelResponse } from '@vercel/node'

// Autocontenido a propósito: las funciones serverless de Vercel no resuelven
// imports relativos con extensión .ts, así que la lógica de OCR + conciliación
// vive aquí sin imports cruzados. (La misma lógica está en pipeline/ para dev
// y tests; mantener en sincronía si se cambia el prompt o los modelos.)

export const config = { maxDuration: 60 }

const MODEL_A = process.env.OCR_MODEL_A || 'qwen/qwen3-vl-235b-a22b-instruct'
const MODEL_B = process.env.OCR_MODEL_B || 'google/gemini-2.5-flash'

const PROMPT = `Eres un extractor de datos de facturas electrónicas colombianas (DIAN).
Analiza el documento y devuelve SOLO un objeto JSON válido (sin markdown) con estas claves:
{"tipoDocumento": "factura_venta"|"nota_credito"|"nota_debito"|"documento_soporte",
"prefijo": string, "numero": string, "cufe": string, "emisorNombre": string,
"emisorNit": string (solo dígitos), "adquirenteNombre": string, "adquirenteNit": string,
"fechaEmision": "YYYY-MM-DD", "subtotal": number, "iva": number, "otrosImpuestos": number,
"total": number, "moneda": string}
Si un dato no aparece, usa null. No inventes valores.`

type Lectura = Record<string, unknown>

function parseLoose(text: string): Lectura {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    const m = /\{[\s\S]*\}/.exec(text)
    if (m) try { return JSON.parse(m[0]) } catch { /* */ }
    return {}
  }
}

function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return isFinite(n) ? n : undefined
}

function normalizar(raw: Lectura): Lectura {
  const s = (v: unknown) => (v == null ? undefined : String(v))
  return {
    tipoDocumento: raw.tipoDocumento || undefined,
    prefijo: s(raw.prefijo),
    numero: s(raw.numero),
    cufe: s(raw.cufe),
    emisorNombre: s(raw.emisorNombre),
    emisorNit: raw.emisorNit != null ? String(raw.emisorNit).replace(/[^\d]/g, '') : undefined,
    adquirenteNombre: s(raw.adquirenteNombre),
    adquirenteNit: raw.adquirenteNit != null ? String(raw.adquirenteNit).replace(/[^\d]/g, '') : undefined,
    fechaEmision: s(raw.fechaEmision),
    subtotal: toNum(raw.subtotal),
    iva: toNum(raw.iva),
    otrosImpuestos: toNum(raw.otrosImpuestos),
    total: toNum(raw.total),
    moneda: s(raw.moneda) || 'COP',
  }
}

function normTexto(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]/g, '').toUpperCase()
}
function normFecha(v: unknown): string {
  const t = String(v ?? '').trim()
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return t.slice(0, 10)
}

const CLAVE = ['cufe', 'emisorNit', 'numero', 'fechaEmision', 'total']
const TOLERANTE = ['emisorNombre', 'adquirenteNombre']

function consolidar(a: Lectura, b: Lectura) {
  const disc: string[] = []
  for (const k of CLAVE) {
    const va = a[k], vb = b[k]
    if ((va == null || va === '') && (vb == null || vb === '')) continue
    const iguales = k === 'total' ? toNum(va) === toNum(vb)
      : k === 'fechaEmision' ? normFecha(va) === normFecha(vb)
      : normTexto(va) === normTexto(vb)
    if (!iguales) disc.push(k)
  }
  for (const k of TOLERANTE) {
    const na = normTexto(a[k]), nb = normTexto(b[k])
    if (!na || !nb) continue
    if (!(na === nb || na.includes(nb) || nb.includes(na))) disc.push(k)
  }
  const pick = (k: string) => (a[k] ?? b[k])
  const concordancia = disc.length === 0
  return {
    estado: concordancia ? 'ok' : 'revision_manual',
    concordanciaOcr: concordancia,
    camposDiscrepancia: disc,
    modeloA: a, modeloB: b,
    tipoDocumento: pick('tipoDocumento'), prefijo: pick('prefijo'), numero: pick('numero'),
    cufe: pick('cufe'), emisorNombre: pick('emisorNombre'), emisorNit: pick('emisorNit'),
    adquirenteNombre: pick('adquirenteNombre'), adquirenteNit: pick('adquirenteNit'),
    fechaEmision: normFecha(pick('fechaEmision')),
    subtotal: toNum(pick('subtotal')) ?? 0, iva: toNum(pick('iva')) ?? 0,
    otrosImpuestos: toNum(pick('otrosImpuestos')) ?? 0, total: toNum(pick('total')) ?? 0,
    moneda: pick('moneda') ?? 'COP',
  }
}

async function callModel(model: string, dataBase64: string, mimeType: string, apiKey: string): Promise<Lectura> {
  const isPdf = mimeType === 'application/pdf'
  const parts: Record<string, unknown>[] = [{ type: 'text', text: PROMPT }]
  if (isPdf) parts.push({ type: 'file', file: { filename: 'factura.pdf', file_data: `data:application/pdf;base64,${dataBase64}` } })
  else parts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${dataBase64}` } })

  const body: Record<string, unknown> = {
    model, messages: [{ role: 'user', content: parts }], temperature: 0,
    response_format: { type: 'json_object' },
  }
  if (isPdf) body.plugins = [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }]

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'Recepcion CO' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`OpenRouter ${model}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return normalizar(parseLoose(json.choices?.[0]?.message?.content ?? ''))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Falta OPENROUTER_API_KEY en el servidor' })
    return
  }
  try {
    const { dataBase64, mimeType } = (req.body || {}) as { dataBase64?: string; mimeType?: string }
    if (!dataBase64 || !mimeType) {
      res.status(400).json({ error: 'Falta dataBase64 o mimeType' })
      return
    }
    const [a, b] = await Promise.all([
      callModel(MODEL_A, dataBase64, mimeType, apiKey),
      callModel(MODEL_B, dataBase64, mimeType, apiKey),
    ])
    res.status(200).json({ modeloA: a, modeloB: b, consolidado: consolidar(a, b), modelos: { a: MODEL_A, b: MODEL_B } })
  } catch (e) {
    res.status(500).json({ error: String((e as Error)?.message || e) })
  }
}
