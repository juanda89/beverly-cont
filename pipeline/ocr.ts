// Extracción OCR doble vía OpenRouter (PRD §8) + conciliación.
// Server-side only: usa la API key; NUNCA importar desde el frontend.

import { consolidar, type LecturaModelo } from './conciliacion.ts'

// Modelos confirmados disponibles en OpenRouter (2026-06). Configurables por env.
export const DEFAULT_MODEL_A = 'qwen/qwen3-vl-235b-a22b-instruct' // OCR de documentos
export const DEFAULT_MODEL_B = 'google/gemini-2.5-flash' // multimodal Google

const PROMPT = `Eres un extractor de datos de facturas electrónicas colombianas (DIAN).
Analiza el documento y devuelve SOLO un objeto JSON válido (sin markdown, sin texto extra) con EXACTAMENTE estas claves:
{
  "tipoDocumento": uno de "factura_venta" | "nota_credito" | "nota_debito" | "documento_soporte",
  "prefijo": string,
  "numero": string,
  "cufe": string,            // CUFE/CUDE (puede tener ~96 caracteres)
  "emisorNombre": string,
  "emisorNit": string,       // solo dígitos, sin DV ni puntos
  "adquirenteNombre": string,
  "adquirenteNit": string,   // solo dígitos
  "fechaEmision": string,    // formato YYYY-MM-DD
  "subtotal": number,        // sin separadores de miles
  "iva": number,
  "otrosImpuestos": number,
  "total": number,
  "moneda": string           // ej. "COP"
}
Si un dato no aparece, usa null. No inventes valores.`

type Part = Record<string, unknown>

function buildContent(dataBase64: string, mimeType: string): { parts: Part[]; isPdf: boolean } {
  const isPdf = mimeType === 'application/pdf'
  const parts: Part[] = [{ type: 'text', text: PROMPT }]
  if (isPdf) {
    parts.push({
      type: 'file',
      file: { filename: 'factura.pdf', file_data: `data:application/pdf;base64,${dataBase64}` },
    })
  } else {
    parts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${dataBase64}` } })
  }
  return { parts, isPdf }
}

function parseJsonLoose(text: string): LecturaModelo {
  if (!text) return {}
  try {
    return JSON.parse(text) as LecturaModelo
  } catch {
    const m = /\{[\s\S]*\}/.exec(text)
    if (m) {
      try {
        return JSON.parse(m[0]) as LecturaModelo
      } catch {
        /* fallthrough */
      }
    }
    return {}
  }
}

function toNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'number') return v
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return isFinite(n) ? n : undefined
}

function normalizarLectura(raw: LecturaModelo): LecturaModelo {
  return {
    tipoDocumento: raw.tipoDocumento || undefined,
    prefijo: raw.prefijo ?? undefined,
    numero: raw.numero != null ? String(raw.numero) : undefined,
    cufe: raw.cufe ?? undefined,
    emisorNombre: raw.emisorNombre ?? undefined,
    emisorNit: raw.emisorNit != null ? String(raw.emisorNit).replace(/[^\d]/g, '') : undefined,
    adquirenteNombre: raw.adquirenteNombre ?? undefined,
    adquirenteNit: raw.adquirenteNit != null ? String(raw.adquirenteNit).replace(/[^\d]/g, '') : undefined,
    fechaEmision: raw.fechaEmision ?? undefined,
    subtotal: toNum(raw.subtotal),
    iva: toNum(raw.iva),
    otrosImpuestos: toNum(raw.otrosImpuestos),
    total: toNum(raw.total),
    moneda: raw.moneda ?? 'COP',
  }
}

async function callModel(
  model: string,
  dataBase64: string,
  mimeType: string,
  apiKey: string,
): Promise<LecturaModelo> {
  const { parts, isPdf } = buildContent(dataBase64, mimeType)
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: parts }],
    temperature: 0,
    response_format: { type: 'json_object' },
  }
  if (isPdf) body.plugins = [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }]

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://recepcion-co.vercel.app',
      'X-Title': 'Recepcion CO',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenRouter ${model}: HTTP ${res.status} ${t.slice(0, 300)}`)
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = json.choices?.[0]?.message?.content ?? ''
  return normalizarLectura(parseJsonLoose(content))
}

export interface ResultadoOCR {
  modeloA: LecturaModelo
  modeloB: LecturaModelo
  consolidado: ReturnType<typeof consolidar>
  modelos: { a: string; b: string }
}

/** Extrae los datos de una factura con dos modelos y los concilia. */
export async function extraerFactura(
  dataBase64: string,
  mimeType: string,
  apiKey: string,
  opts?: { modelA?: string; modelB?: string },
): Promise<ResultadoOCR> {
  const modelA = opts?.modelA || process.env.OCR_MODEL_A || DEFAULT_MODEL_A
  const modelB = opts?.modelB || process.env.OCR_MODEL_B || DEFAULT_MODEL_B

  const [a, b] = await Promise.all([
    callModel(modelA, dataBase64, mimeType, apiKey),
    callModel(modelB, dataBase64, mimeType, apiKey),
  ])

  return { modeloA: a, modeloB: b, consolidado: consolidar(a, b), modelos: { a: modelA, b: modelB } }
}
