import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppData } from '../state/AppData'
import type { Proyecto, TipoDocEmpresa } from '../lib/types'
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
  const [email, setEmail] = useState('')
  return (
    <div className="mx-auto max-w-md">
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-3xl">
          🔐
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Conecta tu cuenta de Google</h1>
        <p className="mt-2 text-sm text-slate-500">
          Es el primer paso. Tus proyectos, facturas y datos se guardan en una carpeta de tu
          propio Google Drive. Sin conectar tu cuenta no es posible crear proyectos.
        </p>
        <div className="mt-6 space-y-2 text-left">
          <Field label="Tu correo de Google">
            <Input
              type="email"
              placeholder="contador@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button className="w-full" onClick={() => conectarGoogle(email.trim() || undefined)}>
            Conectar con Google
          </Button>
          <p className="text-center text-xs text-slate-400">
            En producción abre el consentimiento OAuth de Google (Drive + correo). En la demo se simula.
          </p>
        </div>
      </Card>
    </div>
  )
}

export default function Proyectos() {
  const { cuentaGoogle, proyectos, facturas, saveProyecto } = useAppData()
  const [editing, setEditing] = useState<Proyecto | null>(null)
  const [saving, setSaving] = useState(false)

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
              <p className="col-span-2 text-xs text-slate-400">
                Los correos de facturas y de la DIAN se configuran dentro del proyecto.
              </p>
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
