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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function conectar() {
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
            <div>
              <Button onClick={conectar} disabled={loading}>
                {loading ? 'Conectando con Google…' : 'Conectar con Google'}
              </Button>
              {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
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
