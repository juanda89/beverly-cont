// Clasificador económico (PRD §8.1, §8.4): decide si un correo trae factura
// ANTES de gastar OCR. Usa un modelo barato y solo metadatos del correo.

import type { CorreoEntrante } from './tipos.ts'

export const DEFAULT_CLASIFICADOR = 'google/gemini-2.5-flash-lite'

export interface Clasificacion {
  esFactura: boolean
  confianza: number // 0..1
  motivo: string
}

export async function clasificarCorreo(
  correo: CorreoEntrante,
  apiKey: string,
  opts?: { model?: string },
): Promise<Clasificacion> {
  const model = opts?.model || process.env.CLASIFICADOR_MODEL || DEFAULT_CLASIFICADOR
  const adjuntos =
    correo.adjuntos.map((a) => `${a.filename} (${a.mimeType})`).join(', ') || 'ninguno'

  const prompt = `Eres un clasificador de correos para un contador colombiano.
Decide si este correo contiene una FACTURA ELECTRÓNICA (factura de venta, nota crédito, nota débito o documento soporte), ya sea como adjunto (PDF, imagen, XML o ZIP) o descrita en el cuerpo.
Responde SOLO un JSON: {"esFactura": boolean, "confianza": number entre 0 y 1, "motivo": "razón corta"}.

Asunto: ${correo.asunto}
Remitente: ${correo.remitente}
Adjuntos: ${adjuntos}
Cuerpo: ${(correo.cuerpo || '').slice(0, 1500)}`

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    throw new Error(`Clasificador ${model}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const text = json.choices?.[0]?.message?.content ?? '{}'
  let parsed: Partial<Clasificacion> = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    const m = /\{[\s\S]*\}/.exec(text)
    if (m) try { parsed = JSON.parse(m[0]) } catch { /* ignore */ }
  }
  return {
    esFactura: !!parsed.esFactura,
    confianza: typeof parsed.confianza === 'number' ? parsed.confianza : 0,
    motivo: parsed.motivo || '',
  }
}
