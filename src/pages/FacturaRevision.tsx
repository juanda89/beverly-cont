import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import { formatCOP, formatFecha } from '../lib/format'
import {
  CAMPO_LABELS,
  ESTADO_DIAN_LABELS,
  ESTADO_LABELS,
  FUENTE_LABELS,
  TIPO_DOC_FE_LABELS,
  type FacturaRecibida,
  type LecturaModelo,
} from '../lib/types'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'

const MONEY_FIELDS = new Set(['subtotal', 'iva', 'otrosImpuestos', 'total'])
const COMPARE_KEYS: (keyof LecturaModelo)[] = [
  'tipoDocumento', 'prefijo', 'numero', 'cufe', 'emisorNombre', 'emisorNit',
  'adquirenteNombre', 'adquirenteNit', 'fechaEmision', 'subtotal', 'iva', 'otrosImpuestos', 'total', 'moneda',
]

function fmt(key: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (MONEY_FIELDS.has(key) && typeof value === 'number') return formatCOP(value)
  return String(value)
}

export default function FacturaRevision() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { facturas, proyectoById, saveFactura, deleteFactura } = useAppData()

  const factura = facturas.find((f) => f.id === id)
  if (!factura) {
    return (
      <EmptyState title="Factura no encontrada" action={<Link to="/proyectos"><Button>Volver</Button></Link>} />
    )
  }

  const proyecto = proyectoById(factura.proyectoId)
  const enRevision = factura.estado === 'revision_manual' && factura.modeloA && factura.modeloB
  const discrepa = new Set(factura.camposDiscrepancia ?? [])

  async function aceptarLectura(lectura: LecturaModelo) {
    const patch: Partial<FacturaRecibida> = {}
    for (const k of COMPARE_KEYS) {
      const v = lectura[k]
      if (v !== undefined && v !== '') (patch as Record<string, unknown>)[k] = v
    }
    await saveFactura({
      ...factura!,
      ...patch,
      estado: 'ok',
      concordanciaOcr: true,
      camposDiscrepancia: [],
      actualizadoEn: new Date().toISOString(),
    })
  }

  return (
    <div>
      <PageHeader
        title={factura.emisorNombre}
        subtitle={`${proyecto?.nombre ?? ''} · ${factura.prefijo ?? ''} ${factura.numero}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)}>← Volver</Button>
            <button
              className="ml-1 text-xs text-slate-400 hover:text-red-500"
              onClick={() => {
                if (confirm('¿Eliminar este registro?')) void deleteFactura(factura.id).then(() => navigate(-1))
              }}
            >
              Eliminar
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={factura.estado}>{ESTADO_LABELS[factura.estado]}</Badge>
        <Badge tone={factura.fuente}>Fuente: {FUENTE_LABELS[factura.fuente]}</Badge>
        {factura.estadoDian && (
          <Badge tone={factura.estadoDian}>DIAN: {ESTADO_DIAN_LABELS[factura.estadoDian]}</Badge>
        )}
      </div>

      {/* Panel de revisión A vs B */}
      {enRevision && (
        <Card className="mb-6 border-amber-200 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <h2 className="font-semibold text-amber-700">Los dos modelos no coinciden — revisa y confirma</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4 font-medium">Campo</th>
                  <th className="py-2 pr-4 font-medium">Modelo A (DeepSeek-OCR)</th>
                  <th className="py-2 font-medium">Modelo B (Gemini)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARE_KEYS.filter((k) => factura.modeloA![k] !== undefined || factura.modeloB![k] !== undefined).map((k) => {
                  const a = factura.modeloA![k]
                  const b = factura.modeloB![k]
                  const conflict = discrepa.has(k) || (a !== undefined && b !== undefined && String(a) !== String(b))
                  return (
                    <tr key={k} className={conflict ? 'bg-amber-50' : ''}>
                      <td className="py-2 pr-4 text-slate-500">{CAMPO_LABELS[k] ?? k}</td>
                      <td className={`py-2 pr-4 ${conflict ? 'font-semibold text-amber-700' : 'text-slate-700'}`}>{fmt(k, a)}</td>
                      <td className={`py-2 ${conflict ? 'font-semibold text-amber-700' : 'text-slate-700'}`}>{fmt(k, b)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void aceptarLectura(factura.modeloA!)}>Aceptar lectura A</Button>
            <Button onClick={() => void aceptarLectura(factura.modeloB!)}>Aceptar lectura B</Button>
            <Button variant="secondary" onClick={() => void aceptarLectura({})}>Marcar como OK sin cambios</Button>
          </div>
        </Card>
      )}

      {/* Datos del documento */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Datos del documento</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Dato label="Tipo de documento" value={TIPO_DOC_FE_LABELS[factura.tipoDocumento]} />
            <Dato label="Prefijo / Número" value={`${factura.prefijo ?? ''} ${factura.numero}`} />
            <Dato label="Fecha de emisión" value={formatFecha(factura.fechaEmision)} />
            <Dato label="Fecha de recepción" value={formatFecha(factura.fechaRecepcion)} />
            <Dato label="Emisor" value={`${factura.emisorNombre} (NIT ${factura.emisorNit})`} className="col-span-2" />
            <Dato label="Adquirente" value={factura.adquirenteNombre ? `${factura.adquirenteNombre} (NIT ${factura.adquirenteNit ?? '—'})` : '—'} className="col-span-2" />
            <Dato label="CUFE / CUDE" value={factura.cufe} className="col-span-2" mono />
          </dl>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
              <Linea label="Subtotal" value={formatCOP(factura.subtotal)} />
              <Linea label="IVA" value={formatCOP(factura.iva)} />
              {factura.otrosImpuestos > 0 && <Linea label="Otros impuestos" value={formatCOP(factura.otrosImpuestos)} />}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-900">
                <span>Total</span>
                <span>{formatCOP(factura.total)}</span>
              </div>
            </dl>
          </div>
        </Card>

        {/* Archivos + carga contable */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Documentos</h2>
            <div className="space-y-2">
              <Archivo label="Archivo original (correo)" href={factura.archivoOrigen} />
              <Archivo label="PDF de detalle (DIAN)" href={factura.pdfDian} />
              <Archivo label="XML (validez legal)" href={factura.xml} />
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-1 font-semibold text-slate-900">Carga contable</h2>
            <p className="mb-3 text-xs text-slate-400">Disponible en la Fase 2.</p>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" disabled>Cargar a Alegra</Button>
              <Button variant="secondary" disabled>Cargar a Qenta</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Dato({ label, value, className = '', mono }: { label: string; value: string; className?: string; mono?: boolean }) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-slate-800 ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

function Linea({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  )
}

function Archivo({ label, href }: { label: string; href?: string }) {
  if (!href) {
    return (
      <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-400">
        {label}<span className="text-xs">No disponible</span>
      </div>
    )
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700 hover:bg-brand-100">
      {label}<span>↗</span>
    </a>
  )
}
