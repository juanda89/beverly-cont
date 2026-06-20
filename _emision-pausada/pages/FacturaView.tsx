import { useNavigate, useParams, Link } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import { computeTotals } from '../lib/tax/engine'
import { formatCOP, formatFecha, formatNumber } from '../lib/format'
import { ESTADO_LABELS, RESPONSABILIDAD_LABELS, type EstadoFactura } from '../lib/types'
import { getEmisor } from '../lib/emisor'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'

export default function FacturaView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { facturas, config, clienteById, saveFactura, deleteFactura } = useAppData()
  const emisor = getEmisor()

  const factura = facturas.find((f) => f.id === id)
  if (!factura) {
    return (
      <EmptyState
        title="Factura no encontrada"
        action={
          <Link to="/facturas">
            <Button>Volver a facturas</Button>
          </Link>
        }
      />
    )
  }

  const cliente = clienteById(factura.clienteId)
  const t = computeTotals(
    {
      items: factura.items,
      retefuenteConceptId: factura.retefuenteConceptId,
      aplicaReteIva: factura.aplicaReteIva,
      reteIcaPorMil: factura.reteIcaPorMil,
    },
    config,
  )

  async function setEstado(estado: EstadoFactura) {
    await saveFactura({ ...factura!, estado })
  }

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={`Factura ${factura.numero}`}
          subtitle={cliente?.razonSocial}
          actions={
            <>
              <Button variant="secondary" onClick={() => navigate('/facturas')}>
                ← Volver
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/facturas/${factura.id}/editar`)}>
                Editar
              </Button>
              <Button onClick={() => window.print()}>🖨 Imprimir / PDF</Button>
            </>
          }
        />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Estado:</span>
          {(['borrador', 'emitida', 'pagada', 'anulada'] as const).map((e) => (
            <button
              key={e}
              onClick={() => void setEstado(e)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                factura.estado === e
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {ESTADO_LABELS[e]}
            </button>
          ))}
          <button
            onClick={() => {
              if (confirm(`¿Eliminar la factura ${factura.numero}?`)) {
                void deleteFactura(factura.id).then(() => navigate('/facturas'))
              }
            }}
            className="ml-auto text-xs text-slate-400 hover:text-red-500"
          >
            Eliminar factura
          </button>
        </div>
      </div>

      {/* Documento imprimible */}
      <Card className="print-area mx-auto max-w-3xl p-8">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="text-lg font-bold text-slate-900">
              {emisor.razonSocial || 'Tu empresa'}
            </div>
            {emisor.nit && (
              <div className="text-sm text-slate-500">
                {emisor.tipoDocumento} {emisor.nit}
                {emisor.dv ? `-${emisor.dv}` : ''}
              </div>
            )}
            {emisor.regimen && <div className="text-sm text-slate-500">{emisor.regimen}</div>}
            {(emisor.direccion || emisor.ciudad) && (
              <div className="text-sm text-slate-500">
                {[emisor.direccion, emisor.ciudad].filter(Boolean).join(', ')}
              </div>
            )}
            {(emisor.telefono || emisor.email) && (
              <div className="text-sm text-slate-500">
                {[emisor.telefono, emisor.email].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-slate-400">Factura de venta</div>
            <div className="text-xl font-bold text-slate-900">{factura.numero}</div>
            <div className="mt-1 text-sm text-slate-500">Fecha: {formatFecha(factura.fecha)}</div>
            {factura.fechaVencimiento && (
              <div className="text-sm text-slate-500">Vence: {formatFecha(factura.fechaVencimiento)}</div>
            )}
            <div className="mt-2 no-print">
              <Badge tone={factura.estado}>{ESTADO_LABELS[factura.estado]}</Badge>
            </div>
          </div>
        </div>

        {/* Cliente */}
        <div className="py-6">
          <div className="text-xs uppercase tracking-wide text-slate-400">Cliente</div>
          {cliente ? (
            <div className="mt-1">
              <div className="font-semibold text-slate-900">{cliente.razonSocial}</div>
              <div className="text-sm text-slate-500">
                {cliente.tipoDocumento} {cliente.documento}
                {cliente.dv ? `-${cliente.dv}` : ''} · {RESPONSABILIDAD_LABELS[cliente.responsabilidad]}
              </div>
              {(cliente.direccion || cliente.ciudad) && (
                <div className="text-sm text-slate-500">
                  {[cliente.direccion, cliente.ciudad].filter(Boolean).join(', ')}
                </div>
              )}
              {cliente.email && <div className="text-sm text-slate-500">{cliente.email}</div>}
            </div>
          ) : (
            <div className="mt-1 text-sm text-slate-400">Cliente eliminado</div>
          )}
        </div>

        {/* Ítems */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 font-medium">Descripción</th>
              <th className="py-2 text-right font-medium">Cant.</th>
              <th className="py-2 text-right font-medium">Vr. unitario</th>
              <th className="py-2 text-right font-medium">IVA</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {factura.items.map((it) => (
              <tr key={it.id}>
                <td className="py-2.5 pr-2 text-slate-700">{it.descripcion || '—'}</td>
                <td className="py-2.5 text-right text-slate-600">{formatNumber(it.cantidad)}</td>
                <td className="py-2.5 text-right text-slate-600">{formatCOP(it.valorUnitario)}</td>
                <td className="py-2.5 text-right text-slate-500">{(it.ivaRate * 100).toFixed(0)}%</td>
                <td className="py-2.5 text-right font-medium text-slate-900">
                  {formatCOP(it.cantidad * it.valorUnitario)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <Linea label="Subtotal" value={formatCOP(t.subtotal)} />
            {t.ivaPorTarifa
              .filter((i) => i.rate > 0)
              .map((i) => (
                <Linea key={i.rate} label={`IVA ${(i.rate * 100).toFixed(0)}%`} value={formatCOP(i.iva)} />
              ))}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-medium text-slate-900">
              <span>Total bruto</span>
              <span>{formatCOP(t.totalBruto)}</span>
            </div>
            {t.retefuente > 0 && <Linea label="(−) Retefuente" value={`- ${formatCOP(t.retefuente)}`} red />}
            {t.reteIva > 0 && <Linea label="(−) ReteIVA" value={`- ${formatCOP(t.reteIva)}`} red />}
            {t.reteIca > 0 && <Linea label="(−) ReteICA" value={`- ${formatCOP(t.reteIca)}`} red />}
            <div className="flex justify-between border-t-2 border-slate-300 pt-2 text-base font-bold text-slate-900">
              <span>Neto a pagar</span>
              <span>{formatCOP(t.totalNeto)}</span>
            </div>
          </div>
        </div>

        {factura.notas && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Notas</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{factura.notas}</p>
          </div>
        )}

        {emisor.resolucion && (
          <p className="mt-6 text-center text-xs text-slate-400">{emisor.resolucion}</p>
        )}
      </Card>
    </div>
  )
}

function Linea({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={red ? 'text-red-600' : 'text-slate-700'}>{value}</span>
    </div>
  )
}
