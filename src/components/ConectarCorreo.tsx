import { useState } from 'react'
import type { Proyecto } from '../lib/types'
import { Button, Card, Field, Input } from './ui'

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
        {n}
      </div>
      <div className="flex-1 pb-4">
        <div className="text-sm font-semibold text-slate-800">{titulo}</div>
        <div className="mt-1 text-sm text-slate-500">{children}</div>
      </div>
    </div>
  )
}

export default function ConectarCorreo({
  proyecto,
  tipo,
  onClose,
  onConnected,
}: {
  proyecto: Proyecto
  tipo: 'facturas' | 'dian'
  onClose: () => void
  onConnected: (email: string) => void
}) {
  const [email, setEmail] = useState(tipo === 'facturas' ? proyecto.correoFacturas : proyecto.correoDian)
  const [appPassword, setAppPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titulo = tipo === 'facturas' ? 'Conectar correo de facturas' : 'Conectar correo del token DIAN'

  async function conectar() {
    if (!email.trim() || !appPassword.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/connect-mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyectoId: proyecto.id,
          proyectoNombre: proyecto.nombre,
          tipo,
          email: email.trim(),
          appPassword: appPassword.trim(),
          spreadsheetId: proyecto.spreadsheetId,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`)
      onConnected(email.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <Card className="max-h-[92vh] w-full max-w-lg overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Conectamos el buzón de forma segura usando una <b>contraseña de aplicación</b> de Gmail.
          Solo sales un momento a Gmail para crearla.
        </p>

        <div className="mt-5">
          <Paso n={1} titulo="Activa la verificación en 2 pasos">
            Es requisito de Google para crear la clave.{' '}
            <a className="font-medium text-brand-600 hover:underline" href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer">
              Abrir verificación en 2 pasos ↗
            </a>
          </Paso>
          <Paso n={2} titulo="Genera una contraseña de aplicación">
            Entra a{' '}
            <a className="font-medium text-brand-600 hover:underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
              contraseñas de aplicación ↗
            </a>
            , escribe el nombre <b>“Recepción CO”</b> y crea. Copia los <b>16 caracteres</b> que aparecen.
          </Paso>
          <Paso n={3} titulo="Pega tus datos aquí">
            <div className="mt-2 space-y-3">
              <Field label="Correo de Gmail">
                <Input type="email" placeholder="facturas@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Contraseña de aplicación (16 caracteres)">
                <Input type="password" placeholder="xxxx xxxx xxxx xxxx" value={appPassword} onChange={(e) => setAppPassword(e.target.value)} />
              </Field>
            </div>
          </Paso>
        </div>

        {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={conectar} disabled={loading || !email.trim() || !appPassword.trim()}>
            {loading ? 'Conectando…' : 'Conectar buzón'}
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">
          Tu clave se guarda cifrada en el motor de captura. Nunca la almacenamos ni la mostramos de nuevo.
        </p>
      </Card>
    </div>
  )
}
