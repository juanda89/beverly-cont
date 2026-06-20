import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import { computeTotals } from '../lib/tax/engine'
import { formatCOP, hoyISO } from '../lib/format'
import { ESTADO_LABELS, type EstadoFactura, type Factura, type ItemFactura } from '../lib/types'
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, TextArea } from '../components/ui'

function nuevoItem(): ItemFactura {
  return { id: crypto.randomUUID(), descripcion: '', cantidad: 1, valorUnitario: 0, ivaRate: 0.19 }
}

export default function FacturaEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clientes, facturas, config, saveFactura, nextNumero } = useAppData()

  const existente = id ? facturas.find((f) => f.id === id) : undefined
  const [factura, setFactura] = useState<Factura>(() => {
    if (existente) return { ...existente, items: existente.items.map((i) => ({ ...i })) }
    return {
      id: crypto.randomUUID(),
      numero: nextNumero(),
      clienteId: clientes[0]?.id ?? '',
      fecha: hoyISO(),
      fechaVencimiento: '',
      items: [nuevoItem()],
      retefuenteConceptId: null,
      aplicaReteIva: false,
      reteIcaPorMil: 0,
      notas: '',
      estado: 'borrador',
      createdAt: new Date().toISOString(),
    }
  })
  const [saving, setSaving] = useState(false)

  const totals = useMemo(
    () =>
      computeTotals(
        {
          items: factura.items,
          retefuenteConceptId: factura.retefuenteConceptId,
          aplicaReteIva: factura.aplicaReteIva,
          reteIcaPorMil: factura.reteIcaPorMil,
        },
        config,
      ),
    [factura, config],
  )

  function patch(p: Partial<Factura>) {
    setFactura((f) => ({ ...f, ...p }))
  }
  function patchItem(itemId: string, p: Partial<ItemFactura>) {
    setFactura((f) => ({
      ...f,
      items: f.items.map((it) => (it.id === itemId ? { ...it, ...p } : it)),
    }))
  }
  function addItem() {
    setFactura((f) => ({ ...f, items: [...f.items, nuevoItem()] }))
  }
  function removeItem(itemId: string) {
    setFactura((f) => ({ ...f, items: f.items.filter((it) => it.id !== itemId) }))
  }

  const puedeGuardar = factura.clienteId && factura.numero.trim() && totals.subtotal > 0

  async function handleSave() {
    if (!puedeGuardar) return
    setSaving(true)
    try {
      await saveFactura(factura)
      navigate(`/facturas/${factura.id}`)
    } finally {
      setSaving(false)
    }
  }

  if (clientes.length === 0) {
    return (
      <div>
        <PageHeader title="Nueva factura" />
        <EmptyState
          title="Necesitas un cliente primero"
          description="Registra al menos un cliente para poder facturar."
          action={
            <Link to="/clientes">
              <Button>+ Registrar cliente</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={existente ? `Editar ${factura.numero}` : 'Nueva factura'}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!puedeGuardar || saving}>
              {saving ? 'Guardando…' : 'Guardar factura'}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Número" required>
                <Input value={factura.numero} onChange={(e) => patch({ numero: e.target.value })} />
              </Field>
              <Field label="Estado">
                <Select
                  value={factura.estado}
                  onChange={(e) => patch({ estado: e.target.value as EstadoFactura })}
                >
                  {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cliente" required className="col-span-2">
                <Select
                  value={factura.clienteId}
                  onChange={(e) => patch({ clienteId: e.target.value })}
                >
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.razonSocial} ({c.tipoDocumento} {c.documento})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fecha">
                <Input type="date" value={factura.fecha} onChange={(e) => patch({ fecha: e.target.value })} />
              </Field>
              <Field label="Vencimiento">
                <Input
                  type="date"
                  value={factura.fechaVencimiento ?? ''}
                  onChange={(e) => patch({ fechaVencimiento: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          {/* Ítems */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Ítems</h2>
              <Button variant="secondary" onClick={addItem}>
                + Agregar ítem
              </Button>
            </div>
            <div className="space-y-3">
              <div className="hidden grid-cols-[1fr_70px_120px_120px_32px] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid">
                <span>Descripción</span>
                <span className="text-right">Cant.</span>
                <span className="text-right">Vr. unitario</span>
                <span>IVA</span>
                <span />
              </div>
              {factura.items.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_70px_120px_120px_32px] sm:items-center"
                >
                  <Input
                    className="col-span-2 sm:col-span-1"
                    placeholder="Descripción del producto o servicio"
                    value={it.descripcion}
                    onChange={(e) => patchItem(it.id, { descripcion: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    className="text-right"
                    value={it.cantidad}
                    onChange={(e) => patchItem(it.id, { cantidad: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    className="text-right"
                    value={it.valorUnitario}
                    onChange={(e) =>
                      patchItem(it.id, { valorUnitario: parseFloat(e.target.value) || 0 })
                    }
                  />
                  <Select
                    value={it.ivaRate}
                    onChange={(e) => patchItem(it.id, { ivaRate: parseFloat(e.target.value) })}
                  >
                    {config.ivaRates.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                  <button
                    className="justify-self-end text-slate-400 hover:text-red-500"
                    onClick={() => removeItem(it.id)}
                    title="Eliminar ítem"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Retenciones */}
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Retenciones</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Retención en la fuente (renta)" className="col-span-2">
                <Select
                  value={factura.retefuenteConceptId ?? ''}
                  onChange={(e) => patch({ retefuenteConceptId: e.target.value || null })}
                >
                  <option value="">Ninguna</option>
                  {config.retefuenteConcepts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} — {(c.rate * 100).toFixed(2)}%
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="ReteICA" className="col-span-2 sm:col-span-1">
                <Select
                  value={factura.reteIcaPorMil}
                  onChange={(e) => patch({ reteIcaPorMil: parseFloat(e.target.value) || 0 })}
                >
                  {config.reteIcaPresets.map((p) => (
                    <option key={p.ciudad} value={p.porMil}>
                      {p.ciudad}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="col-span-2 mt-6 flex items-center gap-2 text-sm text-slate-700 sm:col-span-1">
                <input
                  type="checkbox"
                  checked={factura.aplicaReteIva}
                  onChange={(e) => patch({ aplicaReteIva: e.target.checked })}
                />
                Aplicar retención de IVA ({(config.reteIvaRate * 100).toFixed(0)}% del IVA)
              </label>
            </div>
          </Card>

          <Card className="p-5">
            <Field label="Notas / observaciones">
              <TextArea
                rows={3}
                value={factura.notas ?? ''}
                onChange={(e) => patch({ notas: e.target.value })}
              />
            </Field>
          </Card>
        </div>

        {/* Resumen */}
        <div className="lg:col-span-1">
          <Card className="sticky top-8 p-5">
            <h2 className="mb-4 font-semibold text-slate-900">Resumen</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCOP(totals.subtotal)} />
              {totals.ivaPorTarifa
                .filter((i) => i.rate > 0)
                .map((i) => (
                  <Row
                    key={i.rate}
                    label={`IVA ${(i.rate * 100).toFixed(0)}%`}
                    value={formatCOP(i.iva)}
                    muted
                  />
                ))}
              <Row label="Total bruto" value={formatCOP(totals.totalBruto)} strong />
              <div className="my-2 border-t border-dashed border-slate-200" />
              {totals.retefuente > 0 && (
                <Row label="(−) Retefuente" value={`- ${formatCOP(totals.retefuente)}`} tone="red" />
              )}
              {totals.reteIva > 0 && (
                <Row label="(−) ReteIVA" value={`- ${formatCOP(totals.reteIva)}`} tone="red" />
              )}
              {totals.reteIca > 0 && (
                <Row label="(−) ReteICA" value={`- ${formatCOP(totals.reteIca)}`} tone="red" />
              )}
              <div className="my-2 border-t border-slate-200" />
              <div className="flex items-center justify-between pt-1">
                <span className="font-semibold text-slate-900">Neto a recibir</span>
                <span className="text-lg font-bold text-brand-700">{formatCOP(totals.totalNeto)}</span>
              </div>
            </dl>
            {factura.retefuenteConceptId && !totals.retefuenteAplicada && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                La base no supera el mínimo en UVT del concepto, por eso no se aplica retefuente.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
  tone?: 'red'
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={muted ? 'text-slate-400' : 'text-slate-600'}>{label}</dt>
      <dd
        className={`tabular-nums ${
          tone === 'red' ? 'text-red-600' : strong ? 'font-semibold text-slate-900' : 'text-slate-700'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
