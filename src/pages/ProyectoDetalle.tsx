import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import { formatCOP, formatFecha } from '../lib/format'
import {
  ESTADO_LABELS,
  FUENTE_LABELS,
  TIPO_DOC_FE_LABELS,
  type EstadoFactura,
  type Fuente,
} from '../lib/types'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '../components/ui'

export default function ProyectoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { proyectoById, facturasDe } = useAppData()

  const proyecto = id ? proyectoById(id) : undefined
  const todas = id ? facturasDe(id) : []

  const [q, setQ] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState<'todos' | EstadoFactura>('todos')
  const [fuente, setFuente] = useState<'todas' | Fuente>('todas')

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase()
    return todas
      .filter((f) => {
        if (estado !== 'todos' && f.estado !== estado) return false
        if (fuente !== 'todas' && f.fuente !== fuente) return false
        if (desde && f.fechaEmision < desde) return false
        if (hasta && f.fechaEmision > hasta) return false
        if (term) {
          const hay = `${f.emisorNombre} ${f.emisorNit} ${f.numero} ${f.prefijo ?? ''} ${f.cufe} ${f.total}`.toLowerCase()
          if (!hay.includes(term)) return false
        }
        return true
      })
      .sort((a, b) => (b.fechaEmision > a.fechaEmision ? 1 : b.fechaEmision < a.fechaEmision ? -1 : 0))
  }, [todas, q, desde, hasta, estado, fuente])

  if (!proyecto) {
    return (
      <EmptyState
        title="Proyecto no encontrado"
        action={<Link to="/proyectos"><Button>Volver a proyectos</Button></Link>}
      />
    )
  }

  const totalFiltrado = filtradas.reduce((s, f) => s + f.total, 0)

  return (
    <div>
      <PageHeader
        title={proyecto.nombre}
        subtitle={`${proyecto.tipoDocumento} ${proyecto.identificacion}${proyecto.dv ? `-${proyecto.dv}` : ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/proyectos')}>← Proyectos</Button>
            <Button variant="secondary" title="Disponible al conectar el pipeline real">⟳ Barrer DIAN</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={proyecto.gmailConectado ? 'dian' : 'default'}>
          {proyecto.gmailConectado ? `Gmail: ${proyecto.gmailCuenta}` : 'Gmail sin conectar'}
        </Badge>
        {!proyecto.gmailConectado && (
          <span className="text-xs text-amber-600">Conéctalo en “Editar proyecto” para capturar correos.</span>
        )}
      </div>

      {/* Filtros */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Input placeholder="Buscar emisor, NIT, número, CUFE…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
          <Select value={estado} onChange={(e) => setEstado(e.target.value as 'todos' | EstadoFactura)}>
            <option value="todos">Todos los estados</option>
            {Object.entries(ESTADO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select value={fuente} onChange={(e) => setFuente(e.target.value as 'todas' | Fuente)}>
            <option value="todas">Toda fuente</option>
            {Object.entries(FUENTE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>{filtradas.length} de {todas.length} facturas</span>
          <span>Total filtrado: <span className="font-semibold text-slate-800">{formatCOP(totalFiltrado)}</span></span>
        </div>
      </Card>

      {filtradas.length === 0 ? (
        <EmptyState
          title={todas.length === 0 ? 'Aún no hay facturas capturadas' : 'Ningún resultado con esos filtros'}
          description={
            todas.length === 0
              ? 'Cuando lleguen correos con factura o corra la barrida DIAN, aparecerán aquí.'
              : 'Ajusta o limpia los filtros.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Emisor</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Fuente</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtradas.map((f) => (
                  <tr
                    key={f.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => navigate(`/facturas/${f.id}`)}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatFecha(f.fechaEmision)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{f.emisorNombre}</div>
                      <div className="text-xs text-slate-400">NIT {f.emisorNit}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{TIPO_DOC_FE_LABELS[f.tipoDocumento]}</div>
                      <div className="text-xs text-slate-400">{f.prefijo} {f.numero}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">{formatCOP(f.total)}</td>
                    <td className="px-4 py-3"><Badge tone={f.fuente}>{FUENTE_LABELS[f.fuente]}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={f.estado}>{ESTADO_LABELS[f.estado]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
