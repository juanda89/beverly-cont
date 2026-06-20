import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import { formatCOP, hoyISO } from '../lib/format'
import {
  CAMPO_LABELS,
  ESTADO_LABELS,
  type FacturaRecibida,
  type LecturaModelo,
  type TipoDocumentoFE,
} from '../lib/types'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'

interface ResultadoOCR {
  modeloA: LecturaModelo
  modeloB: LecturaModelo
  consolidado: LecturaModelo & {
    estado: 'ok' | 'revision_manual'
    concordanciaOcr: boolean
    camposDiscrepancia: string[]
  }
  modelos: { a: string; b: string }
}

const MONEY = new Set(['subtotal', 'iva', 'otrosImpuestos', 'total'])
const CLAVES: (keyof LecturaModelo)[] = [
  'tipoDocumento', 'prefijo', 'numero', 'cufe', 'emisorNombre', 'emisorNit',
  'adquirenteNombre', 'adquirenteNit', 'fechaEmision', 'subtotal', 'iva', 'otrosImpuestos', 'total', 'moneda',
]

function fmt(k: string, v: unknown): string {
  if (v === undefined || v === null || v === '') return '—'
  if (MONEY.has(k) && typeof v === 'number') return formatCOP(v)
  return String(v)
}

export default function SubirFactura() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { proyectoById, saveFactura } = useAppData()
  const inputRef = useRef<HTMLInputElement>(null)

  const proyecto = id ? proyectoById(id) : undefined

  const [preview, setPreview] = useState<string | null>(null)
  const [dataBase64, setDataBase64] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultadoOCR | null>(null)

  if (!proyecto) {
    return <EmptyState title="Proyecto no encontrado" action={<Link to="/"><Button>Volver</Button></Link>} />
  }

  function onFile(file: File) {
    setError(null)
    setResult(null)
    setFileName(file.name)
    setMimeType(file.type)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      setDataBase64(dataUrl.split(',')[1] ?? '')
    }
    reader.readAsDataURL(file)
  }

  async function extraer() {
    if (!dataBase64) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataBase64, mimeType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      setResult(json as ResultadoOCR)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function guardar() {
    if (!result || !proyecto) return
    const c = result.consolidado
    const factura: FacturaRecibida = {
      id: crypto.randomUUID(),
      proyectoId: proyecto.id,
      fuente: 'correo',
      estado: c.estado,
      cufe: c.cufe || '',
      tipoDocumento: (c.tipoDocumento as TipoDocumentoFE) || 'factura_venta',
      prefijo: c.prefijo || '',
      numero: c.numero || '',
      emisorNombre: c.emisorNombre || '',
      emisorNit: c.emisorNit || '',
      adquirenteNombre: c.adquirenteNombre,
      adquirenteNit: c.adquirenteNit,
      fechaEmision: c.fechaEmision || '',
      fechaRecepcion: hoyISO(),
      moneda: c.moneda || 'COP',
      subtotal: c.subtotal ?? 0,
      iva: c.iva ?? 0,
      otrosImpuestos: c.otrosImpuestos ?? 0,
      total: c.total ?? 0,
      estadoDian: '',
      concordanciaOcr: c.concordanciaOcr,
      camposDiscrepancia: c.camposDiscrepancia,
      modeloA: result.modeloA,
      modeloB: result.modeloB,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    }
    await saveFactura(factura)
    navigate(`/facturas/${factura.id}`)
  }

  const disc = new Set(result?.consolidado.camposDiscrepancia ?? [])

  return (
    <div>
      <PageHeader
        title="Subir factura"
        subtitle={proyecto.nombre}
        actions={<Button variant="secondary" onClick={() => navigate(`/proyectos/${proyecto.id}`)}>← Volver al proyecto</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-5">
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-brand-400 hover:bg-brand-50/40"
            >
              <div className="text-3xl">📄</div>
              <p className="mt-2 text-sm font-medium text-slate-700">Arrastra una factura o haz clic para elegir</p>
              <p className="text-xs text-slate-400">PDF, JPG o PNG</p>
              <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
            </div>

            {preview && (
              <div className="mt-4">
                <div className="mb-2 text-xs text-slate-500">{fileName}</div>
                {mimeType === 'application/pdf' ? (
                  <div className="rounded-lg bg-slate-100 px-4 py-6 text-center text-sm text-slate-500">📑 PDF cargado</div>
                ) : (
                  <img src={preview} alt="preview" className="max-h-72 rounded-lg border border-slate-200" />
                )}
                <Button className="mt-3 w-full" onClick={extraer} disabled={loading}>
                  {loading ? 'Leyendo con los dos modelos…' : '✨ Extraer datos'}
                </Button>
              </div>
            )}
          </Card>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="space-y-4">
          {!result && !loading && (
            <Card className="flex h-full items-center justify-center p-10 text-center text-sm text-slate-400">
              Los datos extraídos aparecerán aquí.
            </Card>
          )}
          {loading && <Card className="flex h-full items-center justify-center p-10 text-sm text-slate-400">Consultando los modelos…</Card>}

          {result && (
            <>
              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">Datos extraídos</h2>
                  <Badge tone={result.consolidado.estado}>{ESTADO_LABELS[result.consolidado.estado]}</Badge>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {CLAVES.map((k) => (
                      <tr key={k}>
                        <td className="py-1.5 pr-3 text-slate-500">{CAMPO_LABELS[k] ?? k}</td>
                        <td className={`py-1.5 text-right ${disc.has(k) ? 'font-semibold text-amber-700' : 'text-slate-800'} ${k === 'cufe' ? 'break-all font-mono text-xs' : ''}`}>
                          {fmt(k, result.consolidado[k])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-400">Modelos: {result.modelos.a} · {result.modelos.b}</p>
              </Card>

              {!result.consolidado.concordanciaOcr && (
                <Card className="border-amber-200 p-5">
                  <h3 className="mb-2 text-sm font-semibold text-amber-700">⚠️ Discrepancia entre modelos</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-slate-400">
                        <th className="py-1 pr-3 font-medium">Campo</th><th className="py-1 pr-3 font-medium">Modelo A</th><th className="py-1 font-medium">Modelo B</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...disc].map((k) => (
                        <tr key={k} className="bg-amber-50">
                          <td className="py-1.5 pr-3 text-slate-500">{CAMPO_LABELS[k] ?? k}</td>
                          <td className="py-1.5 pr-3 text-amber-700">{fmt(k, (result.modeloA as Record<string, unknown>)[k])}</td>
                          <td className="py-1.5 text-amber-700">{fmt(k, (result.modeloB as Record<string, unknown>)[k])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}

              <Button className="w-full" onClick={guardar}>Guardar en {proyecto.nombre}</Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
