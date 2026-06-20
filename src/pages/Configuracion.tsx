import { useState } from 'react'
import { useAppData } from '../state/AppData'
import { Badge, Button, Card, Field, Input, PageHeader } from '../components/ui'

function Pendiente({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
      <div>
        <div className="text-sm font-medium text-slate-800">{titulo}</div>
        <div className="text-sm text-slate-500">{children}</div>
      </div>
    </div>
  )
}

export default function Configuracion() {
  const { cuentaGoogle, conectarGoogle, desconectarGoogle } = useAppData()
  const [email, setEmail] = useState('')

  function reiniciarDemo() {
    if (!confirm('¿Borrar los datos de prueba y volver a sembrarlos?')) return
    localStorage.removeItem('recepcion.proyectos')
    localStorage.removeItem('recepcion.facturas')
    window.location.href = '/'
  }

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Cuenta, integraciones y datos de prueba" />

      <div className="space-y-6">
        {/* Cuenta de Google */}
        <Card className="p-6">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Cuenta de Google</h2>
            <Badge tone={cuentaGoogle.conectada ? 'ok' : 'default'}>
              {cuentaGoogle.conectada ? 'Conectada' : 'Sin conectar'}
            </Badge>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Tus proyectos y facturas se guardan en una carpeta de tu Google Drive (1 carpeta por
            contador, 1 hoja por cliente). Es obligatoria para usar la herramienta.
          </p>
          {cuentaGoogle.conectada ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">✓ {cuentaGoogle.email}</span>
              <Button variant="secondary" onClick={desconectarGoogle}>Desconectar</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input type="email" placeholder="contador@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button onClick={() => conectarGoogle(email.trim() || undefined)}>Conectar con Google</Button>
            </div>
          )}
        </Card>

        {/* Fase 0 */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Integraciones (pendientes)</h2>
          <p className="mb-2 text-sm text-slate-500">Lo que falta para el pipeline real de captura y conciliación.</p>
          <Pendiente titulo="OpenRouter (clasificador + OCR doble)">
            API key + IDs de modelo. Habilita la lectura automática de facturas. <span className="text-green-600">Ya integrado en /api/ocr.</span>
          </Pendiente>
          <Pendiente titulo="Google OAuth + verificación de Gmail (CASA)">
            Para leer el correo de facturas y el token de la DIAN. ⏱️ Es el de mayor tiempo: arrancar ya.
          </Pendiente>
          <Pendiente titulo="Worker DIAN asistido (Playwright)">
            Login al portal + token desde Gmail; el contador resuelve el CAPTCHA en sesión visible.
          </Pendiente>
        </Card>

        {/* Demo */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Datos de prueba</h2>
          <p className="mb-3 text-sm text-slate-500">La app corre en modo demo con datos sembrados localmente.</p>
          <Button variant="secondary" onClick={reiniciarDemo}>↻ Reiniciar datos demo</Button>
        </Card>
      </div>
    </div>
  )
}
