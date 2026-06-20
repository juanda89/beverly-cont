import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import { computeTotals } from '../lib/tax/engine'
import { formatCOP, formatFecha } from '../lib/format'
import { ESTADO_LABELS, type EstadoFactura } from '../lib/types'
import { Badge, Button, Card, EmptyState, PageHeader, Select } from '../components/ui'

const FILTROS: { value: 'todas' | EstadoFactura; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'borrador', label: 'Borradores' },
  { value: 'emitida', label: 'Emitidas' },
  { value: 'pagada', label: 'Pagadas' },
  { value: 'anulada', label: 'Anuladas' },
]

export default function Facturas() {
  const { facturas, config, clienteById } = useAppData()
  const [filtro, setFiltro] = useState<'todas' | EstadoFactura>('todas')

  const filtradas = [...facturas]
    .filter((f) => filtro === 'todas' || f.estado === filtro)
    .sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : b.numero.localeCompare(a.numero)))

  return (
    <div>
      <PageHeader
        title="Facturas"
        subtitle="Gestiona y consulta tus facturas de venta"
        actions={
          <Link to="/facturas/nueva">
            <Button>+ Nueva factura</Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Select
          className="w-48"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as 'todas' | EstadoFactura)}
        >
          {FILTROS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <span className="text-sm text-slate-400">{filtradas.length} factura(s)</span>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          title="No hay facturas"
          description="Crea una factura nueva para empezar."
          action={
            <Link to="/facturas/nueva">
              <Button>+ Nueva factura</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Número</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map((f) => {
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
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/facturas/${f.id}`} className="font-medium text-brand-600 hover:underline">
                        {f.numero}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {cliente?.razonSocial ?? <span className="text-slate-400">Cliente eliminado</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatFecha(f.fecha)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={f.estado}>{ESTADO_LABELS[f.estado]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">
                      {formatCOP(t.totalBruto)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{formatCOP(t.totalNeto)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
