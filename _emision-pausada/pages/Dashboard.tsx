import { Link } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import { computeTotals } from '../lib/tax/engine'
import { formatCOP, formatFecha } from '../lib/format'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'
import { ESTADO_LABELS } from '../lib/types'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </Card>
  )
}

export default function Dashboard() {
  const { facturas, clientes, config, clienteById } = useAppData()

  const vigentes = facturas.filter((f) => f.estado !== 'anulada')
  let totalBruto = 0
  let totalRetenciones = 0
  let totalNeto = 0
  for (const f of vigentes) {
    const t = computeTotals(
      {
        items: f.items,
        retefuenteConceptId: f.retefuenteConceptId,
        aplicaReteIva: f.aplicaReteIva,
        reteIcaPorMil: f.reteIcaPorMil,
      },
      config,
    )
    totalBruto += t.totalBruto
    totalRetenciones += t.totalRetenciones
    totalNeto += t.totalNeto
  }

  const recientes = [...facturas]
    .sort((a, b) => (b.fecha > a.fecha ? 1 : -1))
    .slice(0, 6)

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle="Resumen de tu actividad de facturación"
        actions={
          <Link to="/facturas/nueva">
            <Button>+ Nueva factura</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Facturas" value={String(facturas.length)} hint={`${vigentes.length} vigentes`} />
        <Stat label="Total facturado" value={formatCOP(totalBruto)} hint="Subtotal + IVA" />
        <Stat label="Retenciones" value={formatCOP(totalRetenciones)} hint="Retefuente + reteIVA + reteICA" />
        <Stat label="Neto a recibir" value={formatCOP(totalNeto)} hint="Después de retenciones" />
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Facturas recientes</h2>
          <Link to="/facturas" className="text-sm font-medium text-brand-600 hover:underline">
            Ver todas
          </Link>
        </div>

        {recientes.length === 0 ? (
          <EmptyState
            title="Aún no tienes facturas"
            description={
              clientes.length === 0
                ? 'Primero registra un cliente y luego crea tu primera factura.'
                : 'Crea tu primera factura para empezar.'
            }
            action={
              <Link to={clientes.length === 0 ? '/clientes' : '/facturas/nueva'}>
                <Button>{clientes.length === 0 ? '+ Registrar cliente' : '+ Nueva factura'}</Button>
              </Link>
            }
          />
        ) : (
          <Card className="divide-y divide-slate-100">
            {recientes.map((f) => {
              const cliente = clienteById(f.clienteId)
              const t = computeTotals(
                {
                  items: f.items,
                  retefuenteConceptId: f.retefuenteConceptId,
                  aplicaReteIva: f.aplicaReteIva,
                  reteIcaPorMil: f.reteIcaPorMil,
                },
                config,
              )
              return (
                <Link
                  key={f.id}
                  to={`/facturas/${f.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{f.numero}</span>
                      <Badge tone={f.estado}>{ESTADO_LABELS[f.estado]}</Badge>
                    </div>
                    <div className="truncate text-sm text-slate-500">
                      {cliente?.razonSocial ?? 'Cliente eliminado'} · {formatFecha(f.fecha)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{formatCOP(t.totalBruto)}</div>
                    <div className="text-xs text-slate-400">Neto {formatCOP(t.totalNeto)}</div>
                  </div>
                </Link>
              )
            })}
          </Card>
        )}
      </div>
    </div>
  )
}
