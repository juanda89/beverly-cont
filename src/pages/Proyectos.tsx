import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import type { Proyecto, TipoDocEmpresa } from '../lib/types'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from '../components/ui'

function nuevoProyecto(): Proyecto {
  return {
    id: crypto.randomUUID(),
    nombre: '',
    tipoDocumento: 'NIT',
    identificacion: '',
    dv: '',
    gmailConectado: false,
    creadoEn: new Date().toISOString(),
  }
}

export default function Proyectos() {
  const { proyectos, facturas, saveProyecto, deleteProyecto } = useAppData()
  const [editing, setEditing] = useState<Proyecto | null>(null)
  const [saving, setSaving] = useState(false)

  const ordenados = [...proyectos].sort((a, b) => a.nombre.localeCompare(b.nombre))

  async function handleSave() {
    if (!editing || !editing.nombre.trim() || !editing.identificacion.trim()) return
    setSaving(true)
    try {
      await saveProyecto(editing)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Proyectos"
        subtitle="Cada empresa cliente que atiendes, con su correo conectado"
        actions={<Button onClick={() => setEditing(nuevoProyecto())}>+ Nuevo proyecto</Button>}
      />

      {ordenados.length === 0 ? (
        <EmptyState
          title="Sin proyectos todavía"
          description="Crea un proyecto por cada empresa cliente y conéctale su Gmail."
          action={<Button onClick={() => setEditing(nuevoProyecto())}>+ Nuevo proyecto</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordenados.map((p) => {
            const fs = facturas.filter((f) => f.proyectoId === p.id)
            const revisar = fs.filter((f) => f.estado === 'revision_manual').length
            return (
              <Card key={p.id} className="flex flex-col p-5">
                <Link to={`/proyectos/${p.id}`} className="group">
                  <div className="font-semibold text-slate-900 group-hover:text-brand-700">{p.nombre}</div>
                  <div className="text-sm text-slate-500">
                    {p.tipoDocumento} {p.identificacion}{p.dv ? `-${p.dv}` : ''}
                  </div>
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone={p.gmailConectado ? 'dian' : 'default'}>
                    {p.gmailConectado ? `Gmail: ${p.gmailCuenta}` : 'Sin Gmail'}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="text-slate-600">{fs.length} facturas</span>
                  {revisar > 0 ? (
                    <span className="font-medium text-amber-600">{revisar} por revisar</span>
                  ) : (
                    <span className="text-slate-400">al día</span>
                  )}
                </div>
                <div className="mt-3 flex gap-1">
                  <Link to={`/proyectos/${p.id}`} className="flex-1">
                    <Button variant="secondary" className="w-full">Abrir</Button>
                  </Link>
                  <Button variant="ghost" onClick={() => setEditing({ ...p })}>Editar</Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {proyectos.some((p) => p.id === editing.id) ? 'Editar proyecto' : 'Nuevo proyecto'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre de la empresa" required className="col-span-2">
                <Input value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
              </Field>
              <Field label="Tipo de documento">
                <Select
                  value={editing.tipoDocumento}
                  onChange={(e) => setEditing({ ...editing, tipoDocumento: e.target.value as TipoDocEmpresa })}
                >
                  <option value="NIT">NIT</option>
                  <option value="CC">Cédula</option>
                  <option value="CE">Cédula extranjería</option>
                </Select>
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Field label="Identificación" required>
                  <Input value={editing.identificacion} onChange={(e) => setEditing({ ...editing, identificacion: e.target.value })} />
                </Field>
                {editing.tipoDocumento === 'NIT' && (
                  <Field label="DV">
                    <Input className="w-16" maxLength={1} value={editing.dv ?? ''} onChange={(e) => setEditing({ ...editing, dv: e.target.value })} />
                  </Field>
                )}
              </div>

              {/* Conexión Gmail */}
              <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-1 text-sm font-medium text-slate-700">Conexión de correo (Gmail)</div>
                {editing.gmailConectado ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-700">✓ Conectado: {editing.gmailCuenta}</span>
                    <Button variant="ghost" onClick={() => setEditing({ ...editing, gmailConectado: false, gmailCuenta: '' })}>
                      Desconectar
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      En producción abrirá el consentimiento OAuth (solo lectura). En la demo se simula.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => setEditing({ ...editing, gmailConectado: true, gmailCuenta: 'demo@gmail.com' })}
                    >
                      Conectar Gmail (demo)
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                className="text-xs text-slate-400 hover:text-red-500"
                onClick={() => {
                  if (proyectos.some((p) => p.id === editing.id) && confirm(`¿Eliminar el proyecto ${editing.nombre} y sus facturas?`)) {
                    void deleteProyecto(editing.id).then(() => setEditing(null))
                  }
                }}
              >
                {proyectos.some((p) => p.id === editing.id) ? 'Eliminar proyecto' : ''}
              </button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || !editing.nombre.trim() || !editing.identificacion.trim()}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
