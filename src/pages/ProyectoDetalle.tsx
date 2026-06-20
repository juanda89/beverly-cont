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
  type Proyecto,
} from '../lib/types'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from '../components/ui'
import ConectarCorreo from '../components/ConectarCorreo'

function CorreoConector({
  titulo,
  descripcion,
  icono,
  email,
  conectado,
  onAbrir,
  onDesconectar,
}: {
  titulo: string
  descripcion: string
  icono: string
  email: string
  conectado: boolean
  onAbrir: () => void
  onDesconectar: () => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icono}</span>
          <div>
            <div className="text-sm font-medium text-slate-800">{titulo}</div>
            <p className="text-xs text-slate-400">{descripcion}</p>
          </div>
        </div>
        <Badge tone={conectado ? 'ok' : 'default'}>{conectado ? 'Conectado' : 'Sin conectar'}</Badge>
      </div>
      {conectado ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate text-sm text-slate-700">{email}</span>
          <Button variant="ghost" onClick={onDesconectar}>Desconectar</Button>
        </div>
      ) : (
        <Button variant="secondary" className="mt-3 w-full" onClick={onAbrir}>
          Conectar buzón
        </Button>
      )}
    </div>
  )
}

export default function ProyectoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { proyectoById, facturasDe, saveProyecto, deleteProyecto } = useAppData()

  const proyecto = id ? proyectoById(id) : undefined
  const todas = id ? facturasDe(id) : []

  const [q, setQ] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState<'todos' | EstadoFactura>('todos')
  const [fuente, setFuente] = useState<'todas' | Fuente>('todas')
  const [editando, setEditando] = useState<Proyecto | null>(null)
  const [conectando, setConectando] = useState<'facturas' | 'dian' | null>(null)

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase()
    return todas
      .filter((f) => {
        if (estado !== 'todos' && f.estado !== estado) return false
        if (fuente !== 'todas' && f.fuente !== fuente) return false
        if (desde && f.fechaEmision < desde) return false
        if (hasta && f.fechaEmision > hasta) return false
        if (term && !`${f.emisorNombre} ${f.emisorNit} ${f.numero} ${f.prefijo ?? ''} ${f.cufe} ${f.total}`.toLowerCase().includes(term)) return false
        return true
      })
      .sort((a, b) => (b.fechaEmision > a.fechaEmision ? 1 : b.fechaEmision < a.fechaEmision ? -1 : 0))
  }, [todas, q, desde, hasta, estado, fuente])

  if (!proyecto) {
    return <EmptyState title="Proyecto no encontrado" action={<Link to="/"><Button>Volver</Button></Link>} />
  }

  const totalFiltrado = filtradas.reduce((s, f) => s + f.total, 0)

  return (
    <div>
      <PageHeader
        title={proyecto.nombre}
        subtitle={`${proyecto.tipoDocumento} ${proyecto.identificacion}${proyecto.dv ? `-${proyecto.dv}` : ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/')}>← Proyectos</Button>
            <Button variant="secondary" onClick={() => setEditando({ ...proyecto })}>Editar</Button>
            <Link to={`/proyectos/${proyecto.id}/subir`}>
              <Button>＋ Subir factura</Button>
            </Link>
          </>
        }
      />

      {/* Correos del proyecto */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <CorreoConector
          titulo="Correo de facturas"
          descripcion="Buzón donde llegan las facturas de proveedores. Se lee para capturarlas."
          icono="📥"
          email={proyecto.correoFacturas}
          conectado={proyecto.correoFacturasConectado}
          onAbrir={() => setConectando('facturas')}
          onDesconectar={() => saveProyecto({ ...proyecto, correoFacturasConectado: false })}
        />
        <CorreoConector
          titulo="Correo para token DIAN"
          descripcion="Donde la DIAN envía el código de un solo uso al consultar el portal."
          icono="🏛️"
          email={proyecto.correoDian}
          conectado={proyecto.correoDianConectado}
          onAbrir={() => setConectando('dian')}
          onDesconectar={() => saveProyecto({ ...proyecto, correoDianConectado: false })}
        />
      </div>

      {conectando && (
        <ConectarCorreo
          proyecto={proyecto}
          tipo={conectando}
          onClose={() => setConectando(null)}
          onConnected={(email) => {
            if (conectando === 'facturas') saveProyecto({ ...proyecto, correoFacturas: email, correoFacturasConectado: true })
            else saveProyecto({ ...proyecto, correoDian: email, correoDianConectado: true })
            setConectando(null)
          }}
        />
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Facturas</h2>
        <Button variant="secondary" title="Disponible al conectar el pipeline real">⟳ Barrer DIAN</Button>
      </div>

      {/* Filtros */}
      <Card className="mb-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Input placeholder="Buscar emisor, NIT, CUFE…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <Select value={estado} onChange={(e) => setEstado(e.target.value as 'todos' | EstadoFactura)}>
            <option value="todos">Todos los estados</option>
            {Object.entries(ESTADO_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </Select>
          <Select value={fuente} onChange={(e) => setFuente(e.target.value as 'todas' | Fuente)}>
            <option value="todas">Toda fuente</option>
            {Object.entries(FUENTE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>{filtradas.length} de {todas.length} facturas</span>
          <span>Total: <span className="font-semibold text-slate-800">{formatCOP(totalFiltrado)}</span></span>
        </div>
      </Card>

      {filtradas.length === 0 ? (
        <EmptyState
          title={todas.length === 0 ? 'Aún no hay facturas' : 'Sin resultados'}
          description={
            todas.length === 0
              ? 'Sube una factura o conecta el correo para capturarlas automáticamente.'
              : 'Ajusta los filtros.'
          }
          action={todas.length === 0 ? <Link to={`/proyectos/${proyecto.id}/subir`}><Button>＋ Subir factura</Button></Link> : undefined}
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
                  <tr key={f.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/facturas/${f.id}`)}>
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

      {/* Editar datos básicos */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Editar proyecto</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre" required className="col-span-2">
                <Input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} />
              </Field>
              <Field label="Tipo">
                <Select value={editando.tipoDocumento} onChange={(e) => setEditando({ ...editando, tipoDocumento: e.target.value as Proyecto['tipoDocumento'] })}>
                  <option value="NIT">NIT</option>
                  <option value="CC">Cédula</option>
                  <option value="CE">Cédula extranjería</option>
                </Select>
              </Field>
              <Field label="Identificación" required>
                <Input value={editando.identificacion} onChange={(e) => setEditando({ ...editando, identificacion: e.target.value })} />
              </Field>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                className="text-xs text-slate-400 hover:text-red-500"
                onClick={() => { if (confirm(`¿Eliminar ${editando.nombre} y sus facturas?`)) void deleteProyecto(editando.id).then(() => navigate('/')) }}
              >
                Eliminar proyecto
              </button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button>
                <Button onClick={() => { void saveProyecto(editando); setEditando(null) }} disabled={!editando.nombre.trim() || !editando.identificacion.trim()}>
                  Guardar
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
