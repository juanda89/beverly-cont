import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import type { Proyecto, TipoDocEmpresa } from '../lib/types'
import { crearSheetCliente } from '../lib/google'
import { Badge, Button, Card, Field, Input, PageHeader, Select } from '../components/ui'

function nuevoProyecto(): Proyecto {
  return {
    id: crypto.randomUUID(),
    nombre: '',
    tipoDocumento: 'NIT',
    identificacion: '',
    dv: '',
    correoFacturas: '',
    correoFacturasConectado: false,
    correoDian: '',
    correoDianConectado: false,
    creadoEn: new Date().toISOString(),
  }
}

/** Pantalla de onboarding: conectar Google es obligatorio antes de todo. */
function OnboardingGoogle() {
  const { conectarGoogle } = useAppData()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setLoading(true)
    setError(null)
    try {
      await conectarGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-3xl">
          🔐
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Conecta tu cuenta de Google</h1>
        <p className="mt-2 text-sm text-slate-500">
          Es el primer paso. La app crea una carpeta en tu propio Google Drive donde se guardan
          tus clientes y facturas. Sin conectar no es posible crear proyectos.
        </p>
        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={go} disabled={loading}>
            {loading ? 'Conectando con Google…' : 'Conectar con Google'}
          </Button>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <p className="text-center text-xs text-slate-400">
            Se abre el consentimiento de Google (permiso para crear archivos en tu Drive).
          </p>
        </div>
      </Card>
    </div>
  )
}

export default function Proyectos() {
  const { cuentaGoogle, proyectos, facturas, saveProyecto, obtenerTokenGoogle } = useAppData()
  const [editing, setEditing] = useState<Proyecto | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Gate obligatorio
  if (!cuentaGoogle.conectada) {
    return (
      <div>
        <PageHeader title="Bienvenido" subtitle="Configura tu cuenta para empezar" />
        <OnboardingGoogle />
      </div>
    )
  }

  const ordenados = [...proyectos].sort((a, b) => a.nombre.localeCompare(b.nombre))

  async function handleSave() {
    if (!editing || !editing.nombre.trim() || !editing.identificacion.trim()) return
    setSaving(true)
    setError(null)
    try {
      let proyecto = editing
      // Proyecto nuevo + Google conectado → crea su archivo Sheets en el Drive
      if (!proyecto.spreadsheetId && cuentaGoogle.folderId) {
        const token = await obtenerTokenGoogle()
        const spreadsheetId = await crearSheetCliente(token, cuentaGoogle.folderId, proyecto.nombre.trim())
        proyecto = { ...proyecto, spreadsheetId }
      }
      await saveProyecto(proyecto)
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Proyectos"
        subtitle="Cada empresa cliente que atiendes"
        actions={<Button onClick={() => setEditing(nuevoProyecto())}>+ Nuevo proyecto</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordenados.map((p) => {
          const fs = facturas.filter((f) => f.proyectoId === p.id)
          const revisar = fs.filter((f) => f.estado === 'revision_manual').length
          return (
            <Link key={p.id} to={`/proyectos/${p.id}`}>
              <Card className="flex h-full flex-col p-5 transition hover:border-brand-300 hover:shadow-md">
                <div className="font-semibold text-slate-900">{p.nombre}</div>
                <div className="text-sm text-slate-500">
                  {p.tipoDocumento} {p.identificacion}{p.dv ? `-${p.dv}` : ''}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={p.correoFacturasConectado ? 'dian' : 'default'}>
                    {p.correoFacturasConectado ? 'Facturas ✓' : 'Sin correo facturas'}
                  </Badge>
                  <Badge tone={p.correoDianConectado ? 'dian' : 'default'}>
                    {p.correoDianConectado ? 'DIAN ✓' : 'Sin correo DIAN'}
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
              </Card>
            </Link>
          )
        })}

        {/* Tarjeta para crear */}
        <button
          onClick={() => setEditing(nuevoProyecto())}
          className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-400 hover:text-brand-600"
        >
          <span className="text-2xl">＋</span>
          <span className="mt-1 text-sm font-medium">Nuevo proyecto</span>
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {proyectos.some((p) => p.id === editing.id) ? 'Editar proyecto' : 'Nuevo proyecto'}
            </h2>
            <div className="space-y-4">
              <Field label="Nombre de la empresa" required>
                <Input value={editing.nombre} onChange={(e) => setEditing({ ...editing, nombre: e.target.value })} />
              </Field>
              <div className="flex gap-3">
                <Field label="Tipo de documento" className="w-40 shrink-0">
                  <Select
                    value={editing.tipoDocumento}
                    onChange={(e) => setEditing({ ...editing, tipoDocumento: e.target.value as TipoDocEmpresa })}
                  >
                    <option value="NIT">NIT</option>
                    <option value="CC">Cédula</option>
                    <option value="CE">Cédula extranjería</option>
                  </Select>
                </Field>
                <Field label="Identificación" required className="flex-1">
                  <Input value={editing.identificacion} onChange={(e) => setEditing({ ...editing, identificacion: e.target.value })} />
                </Field>
                {editing.tipoDocumento === 'NIT' && (
                  <Field label="DV" className="w-16 shrink-0">
                    <Input maxLength={1} value={editing.dv ?? ''} onChange={(e) => setEditing({ ...editing, dv: e.target.value })} />
                  </Field>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Los correos de facturas y de la DIAN se configuran dentro del proyecto.
              </p>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !editing.nombre.trim() || !editing.identificacion.trim()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
