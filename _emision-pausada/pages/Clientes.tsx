import { useState } from 'react'
import { useAppData } from '../state/AppData'
import {
  RESPONSABILIDAD_LABELS,
  type Cliente,
  type Responsabilidad,
  type TipoDocumento,
} from '../lib/types'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from '../components/ui'

function nuevoCliente(): Cliente {
  return {
    id: crypto.randomUUID(),
    tipoDocumento: 'NIT',
    documento: '',
    dv: '',
    razonSocial: '',
    email: '',
    telefono: '',
    direccion: '',
    ciudad: '',
    declaranteRenta: true,
    autorretenedor: false,
    responsabilidad: 'responsable_iva',
    createdAt: new Date().toISOString(),
  }
}

export default function Clientes() {
  const { clientes, saveCliente, deleteCliente } = useAppData()
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [saving, setSaving] = useState(false)

  const ordenados = [...clientes].sort((a, b) =>
    a.razonSocial.localeCompare(b.razonSocial),
  )

  async function handleSave() {
    if (!editing) return
    if (!editing.razonSocial.trim() || !editing.documento.trim()) return
    setSaving(true)
    try {
      await saveCliente(editing)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Personas y empresas a las que facturas"
        actions={<Button onClick={() => setEditing(nuevoCliente())}>+ Nuevo cliente</Button>}
      />

      {ordenados.length === 0 ? (
        <EmptyState
          title="Sin clientes todavía"
          description="Registra tu primer cliente para poder emitir facturas."
          action={<Button onClick={() => setEditing(nuevoCliente())}>+ Nuevo cliente</Button>}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Documento</th>
                <th className="px-5 py-3 font-medium">Responsabilidad</th>
                <th className="px-5 py-3 font-medium">Ciudad</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordenados.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{c.razonSocial}</div>
                    {c.email && <div className="text-xs text-slate-400">{c.email}</div>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {c.tipoDocumento} {c.documento}
                    {c.dv ? `-${c.dv}` : ''}
                  </td>
                  <td className="px-5 py-3">
                    <Badge>{RESPONSABILIDAD_LABELS[c.responsabilidad]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{c.ciudad || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" onClick={() => setEditing({ ...c })}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`¿Eliminar a ${c.razonSocial}?`)) void deleteCliente(c.id)
                        }}
                      >
                        🗑
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editing && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {clientes.some((c) => c.id === editing.id) ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tipo de documento">
                <Select
                  value={editing.tipoDocumento}
                  onChange={(e) =>
                    setEditing({ ...editing, tipoDocumento: e.target.value as TipoDocumento })
                  }
                >
                  <option value="NIT">NIT</option>
                  <option value="CC">Cédula de ciudadanía</option>
                  <option value="CE">Cédula de extranjería</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </Select>
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Field label="Número" required>
                  <Input
                    value={editing.documento}
                    onChange={(e) => setEditing({ ...editing, documento: e.target.value })}
                  />
                </Field>
                {editing.tipoDocumento === 'NIT' && (
                  <Field label="DV">
                    <Input
                      className="w-16"
                      maxLength={1}
                      value={editing.dv ?? ''}
                      onChange={(e) => setEditing({ ...editing, dv: e.target.value })}
                    />
                  </Field>
                )}
              </div>
              <Field label="Razón social / Nombre" required className="col-span-2">
                <Input
                  value={editing.razonSocial}
                  onChange={(e) => setEditing({ ...editing, razonSocial: e.target.value })}
                />
              </Field>
              <Field label="Responsabilidad tributaria" className="col-span-2">
                <Select
                  value={editing.responsabilidad}
                  onChange={(e) =>
                    setEditing({ ...editing, responsabilidad: e.target.value as Responsabilidad })
                  }
                >
                  {Object.entries(RESPONSABILIDAD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={editing.email ?? ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </Field>
              <Field label="Teléfono">
                <Input
                  value={editing.telefono ?? ''}
                  onChange={(e) => setEditing({ ...editing, telefono: e.target.value })}
                />
              </Field>
              <Field label="Dirección">
                <Input
                  value={editing.direccion ?? ''}
                  onChange={(e) => setEditing({ ...editing, direccion: e.target.value })}
                />
              </Field>
              <Field label="Ciudad">
                <Input
                  value={editing.ciudad ?? ''}
                  onChange={(e) => setEditing({ ...editing, ciudad: e.target.value })}
                />
              </Field>
              <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editing.declaranteRenta}
                  onChange={(e) => setEditing({ ...editing, declaranteRenta: e.target.checked })}
                />
                Declarante de renta
              </label>
              <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editing.autorretenedor}
                  onChange={(e) => setEditing({ ...editing, autorretenedor: e.target.checked })}
                />
                Autorretenedor
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !editing.razonSocial.trim() || !editing.documento.trim()}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
