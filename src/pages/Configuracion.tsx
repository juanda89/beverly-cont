import { useState } from 'react'
import { useAppData } from '../state/AppData'
import { getSheetsUrl, setSheetsUrl } from '../lib/storage'
import { Badge, Button, Card, Field, Input, PageHeader } from '../components/ui'

function Pendiente({ titulo, estado, children }: { titulo: string; estado: 'pendiente' | 'listo'; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${estado === 'listo' ? 'bg-green-500' : 'bg-amber-400'}`} />
      <div>
        <div className="text-sm font-medium text-slate-800">{titulo}</div>
        <div className="text-sm text-slate-500">{children}</div>
      </div>
    </div>
  )
}

export default function Configuracion() {
  const { storeKind } = useAppData()
  const [sheetsUrl, setSheetsUrlState] = useState(getSheetsUrl() ?? '')

  function conectar() {
    setSheetsUrl(sheetsUrl.trim() || null)
    window.location.reload()
  }
  function desconectar() {
    setSheetsUrl(null)
    window.location.reload()
  }
  function reiniciarDemo() {
    if (!confirm('¿Borrar los datos de prueba y volver a sembrarlos?')) return
    localStorage.removeItem('recepcion.proyectos')
    localStorage.removeItem('recepcion.facturas')
    window.location.reload()
  }

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Almacenamiento, integraciones y datos de prueba" />

      <div className="space-y-6">
        {/* Almacenamiento */}
        <Card className="p-6">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Almacenamiento</h2>
            <Badge tone={storeKind === 'sheets' ? 'ok' : 'default'}>
              {storeKind === 'sheets' ? 'Google Sheets' : 'Demo local'}
            </Badge>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Modelo objetivo (PRD §11.1): la app crea, en el Google Drive de cada contador, una carpeta propia con
            una hoja por proyecto/cliente. Hoy corre en modo demo (datos de prueba en este navegador).
          </p>
          <Field label="URL del Apps Script (Web App)" hint="Se habilita al conectar el backend real de Sheets/Drive.">
            <Input
              placeholder="https://script.google.com/macros/s/AKfy.../exec"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrlState(e.target.value)}
            />
          </Field>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={conectar} disabled={!sheetsUrl.trim()}>Conectar</Button>
            {storeKind === 'sheets' && <Button variant="secondary" onClick={desconectar}>Desconectar</Button>}
            <Button variant="ghost" className="ml-auto" onClick={reiniciarDemo}>↻ Reiniciar datos demo</Button>
          </div>
        </Card>

        {/* Fase 0 — integraciones pendientes */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Integraciones (Fase 0 — pendientes)</h2>
          <p className="mb-2 text-sm text-slate-500">Lo que falta para conectar el pipeline real de captura y conciliación.</p>
          <Pendiente titulo="OpenRouter (clasificador + OCR doble)" estado="pendiente">
            API key + IDs de modelo (DeepSeek-OCR y Gemini). Habilita la lectura automática de facturas.
          </Pendiente>
          <Pendiente titulo="Google OAuth + verificación de Gmail" estado="pendiente">
            Proyecto Google Cloud, consentimiento OAuth y verificación de seguridad (CASA). ⏱️ Es el de mayor tiempo: arrancar ya.
          </Pendiente>
          <Pendiente titulo="Proveedor DIAN (Opción A)" estado="pendiente">
            Alanube / Dataico / Factus / recepción de Alegra. Habilita la barrida semanal sin CAPTCHA.
          </Pendiente>
          <Pendiente titulo="Worker DIAN asistido (Opción B, fallback)" estado="pendiente">
            Node + Playwright; el contador resuelve el CAPTCHA en sesión visible.
          </Pendiente>
        </Card>
      </div>
    </div>
  )
}
