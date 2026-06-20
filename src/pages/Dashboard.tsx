import { Link } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import { formatCOP, formatFecha } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader } from '../components/ui'
import { ESTADO_LABELS, FUENTE_LABELS } from '../lib/types'

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'amber' }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${tone === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </Card>
  )
}

export default function Dashboard() {
  const { proyectos, facturas, proyectoById } = useAppData()

  const porRevisar = facturas.filter((f) => f.estado === 'revision_manual')
  const totalRecibido = facturas.reduce((s, f) => s + f.total, 0)
  const desdeCorreo = facturas.filter((f) => f.fuente === 'correo').length
  const desdeDian = facturas.filter((f) => f.fuente === 'dian').length

  return (
    <div>
      <PageHeader title="Inicio" subtitle="Resumen de facturas capturadas y por revisar" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Proyectos" value={String(proyectos.length)} hint={`${proyectos.filter((p) => p.gmailConectado).length} con Gmail`} />
        <Stat label="Facturas capturadas" value={String(facturas.length)} hint={`${desdeCorreo} correo · ${desdeDian} DIAN`} />
        <Stat label="Por revisar" value={String(porRevisar.length)} hint="Discrepancia entre modelos" tone="amber" />
        <Stat label="Total recibido" value={formatCOP(totalRecibido)} hint="Suma de documentos" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Por revisar */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Requiere tu revisión</h2>
          {porRevisar.length === 0 ? (
            <EmptyState title="Nada por revisar 🎉" description="Todas las facturas tienen lectura concordante." />
          ) : (
            <Card className="divide-y divide-slate-100">
              {porRevisar.map((f) => (
                <Link key={f.id} to={`/facturas/${f.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{f.emisorNombre}</div>
                    <div className="text-sm text-slate-500">
                      {proyectoById(f.proyectoId)?.nombre} · {formatFecha(f.fechaEmision)}
                    </div>
                  </div>
                  <Badge tone="revision_manual">{ESTADO_LABELS[f.estado]}</Badge>
                </Link>
              ))}
            </Card>
          )}
        </div>

        {/* Proyectos */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Proyectos</h2>
            <Link to="/proyectos" className="text-sm font-medium text-brand-600 hover:underline">Ver todos</Link>
          </div>
          <Card className="divide-y divide-slate-100">
            {proyectos.map((p) => {
              const fs = facturas.filter((f) => f.proyectoId === p.id)
              return (
                <Link key={p.id} to={`/proyectos/${p.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{p.nombre}</div>
                    <div className="text-sm text-slate-500">NIT {p.identificacion}{p.dv ? `-${p.dv}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-sm text-slate-500">{fs.length} fact.</span>
                    <Badge tone={p.gmailConectado ? 'dian' : 'default'}>{p.gmailConectado ? 'Gmail ✓' : 'Sin Gmail'}</Badge>
                  </div>
                </Link>
              )
            })}
          </Card>
          <p className="mt-3 text-xs text-slate-400">
            Fuentes: {FUENTE_LABELS.correo} y {FUENTE_LABELS.dian}, consolidadas sin duplicados por CUFE.
          </p>
        </div>
      </div>
    </div>
  )
}
