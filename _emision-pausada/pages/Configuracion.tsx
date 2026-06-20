import { useState } from 'react'
import { useAppData } from '../state/AppData'
import { DEFAULT_TAX_CONFIG } from '../lib/tax/config'
import { getSheetsUrl, setSheetsUrl } from '../lib/storage'
import { EMISOR_VACIO, getEmisor, setEmisor, type Emisor } from '../lib/emisor'
import { Button, Card, Field, Input, PageHeader, Select } from '../components/ui'

export default function Configuracion() {
  const { config, saveConfig, storeKind } = useAppData()

  // --- Emisor ---
  const [emisor, setEmisorState] = useState<Emisor>(() => getEmisor())
  const [emisorOk, setEmisorOk] = useState(false)
  function guardarEmisor() {
    setEmisor(emisor)
    setEmisorOk(true)
    setTimeout(() => setEmisorOk(false), 2000)
  }

  // --- Parámetros tributarios ---
  const [uvt, setUvt] = useState(config.uvt)
  const [anioUvt, setAnioUvt] = useState(config.anioUvt)
  const [reteIvaRate, setReteIvaRate] = useState(config.reteIvaRate * 100)
  const [reteIvaBaseUvt, setReteIvaBaseUvt] = useState(config.reteIvaBaseUvt)
  const [taxOk, setTaxOk] = useState(false)
  async function guardarTax() {
    await saveConfig({
      ...config,
      uvt,
      anioUvt,
      reteIvaRate: reteIvaRate / 100,
      reteIvaBaseUvt,
    })
    setTaxOk(true)
    setTimeout(() => setTaxOk(false), 2000)
  }
  async function restaurarTax() {
    if (!confirm('¿Restaurar los parámetros tributarios por defecto?')) return
    await saveConfig(DEFAULT_TAX_CONFIG)
    setUvt(DEFAULT_TAX_CONFIG.uvt)
    setAnioUvt(DEFAULT_TAX_CONFIG.anioUvt)
    setReteIvaRate(DEFAULT_TAX_CONFIG.reteIvaRate * 100)
    setReteIvaBaseUvt(DEFAULT_TAX_CONFIG.reteIvaBaseUvt)
  }

  // --- Google Sheets ---
  const [sheetsUrl, setSheetsUrlState] = useState(getSheetsUrl() ?? '')
  function conectarSheets() {
    setSheetsUrl(sheetsUrl.trim() || null)
    window.location.reload()
  }
  function desconectarSheets() {
    setSheetsUrl(null)
    window.location.reload()
  }

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Datos del emisor, parámetros tributarios y almacenamiento" />

      <div className="space-y-6">
        {/* Emisor */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Datos del emisor</h2>
          <p className="mb-4 text-sm text-slate-500">Aparecen en el encabezado de cada factura.</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Razón social / Nombre" className="col-span-2">
              <Input
                value={emisor.razonSocial}
                onChange={(e) => setEmisorState({ ...emisor, razonSocial: e.target.value })}
              />
            </Field>
            <Field label="Tipo doc.">
              <Select
                value={emisor.tipoDocumento}
                onChange={(e) =>
                  setEmisorState({ ...emisor, tipoDocumento: e.target.value as Emisor['tipoDocumento'] })
                }
              >
                <option value="NIT">NIT</option>
                <option value="CC">CC</option>
              </Select>
            </Field>
            <Field label="Número">
              <Input value={emisor.nit} onChange={(e) => setEmisorState({ ...emisor, nit: e.target.value })} />
            </Field>
            <Field label="DV">
              <Input
                className="w-20"
                maxLength={1}
                value={emisor.dv ?? ''}
                onChange={(e) => setEmisorState({ ...emisor, dv: e.target.value })}
              />
            </Field>
            <Field label="Régimen / responsabilidad">
              <Input
                value={emisor.regimen}
                onChange={(e) => setEmisorState({ ...emisor, regimen: e.target.value })}
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={emisor.direccion}
                onChange={(e) => setEmisorState({ ...emisor, direccion: e.target.value })}
              />
            </Field>
            <Field label="Ciudad">
              <Input
                value={emisor.ciudad}
                onChange={(e) => setEmisorState({ ...emisor, ciudad: e.target.value })}
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={emisor.telefono}
                onChange={(e) => setEmisorState({ ...emisor, telefono: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                value={emisor.email}
                onChange={(e) => setEmisorState({ ...emisor, email: e.target.value })}
              />
            </Field>
            <Field label="Resolución DIAN / leyenda legal" className="col-span-2">
              <Input
                placeholder="Ej: Resolución DIAN 18760000000 del ... rango FV-1 a FV-5000"
                value={emisor.resolucion ?? ''}
                onChange={(e) => setEmisorState({ ...emisor, resolucion: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={guardarEmisor}>Guardar emisor</Button>
            {emisorOk && <span className="text-sm text-green-600">✓ Guardado</span>}
            <button
              className="ml-auto text-xs text-slate-400 hover:text-slate-600"
              onClick={() => setEmisorState(EMISOR_VACIO)}
            >
              Limpiar
            </button>
          </div>
        </Card>

        {/* Parámetros tributarios */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Parámetros tributarios</h2>
          <p className="mb-4 text-sm text-slate-500">
            ⚠️ Verifica el UVT y las tarifas vigentes cada año. Afectan el cálculo de retenciones.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="UVT (pesos)" hint="Valor de la UVT vigente">
              <Input type="number" value={uvt} onChange={(e) => setUvt(parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Año UVT">
              <Input
                type="number"
                value={anioUvt}
                onChange={(e) => setAnioUvt(parseInt(e.target.value) || 0)}
              />
            </Field>
            <Field label="ReteIVA (% del IVA)">
              <Input
                type="number"
                value={reteIvaRate}
                onChange={(e) => setReteIvaRate(parseFloat(e.target.value) || 0)}
              />
            </Field>
            <Field label="Base reteIVA (UVT)">
              <Input
                type="number"
                value={reteIvaBaseUvt}
                onChange={(e) => setReteIvaBaseUvt(parseFloat(e.target.value) || 0)}
              />
            </Field>
          </div>

          <div className="mt-5">
            <div className="mb-2 text-sm font-medium text-slate-700">
              Conceptos de retención en la fuente
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2 font-medium">Concepto</th>
                    <th className="px-3 py-2 text-right font-medium">Base (UVT)</th>
                    <th className="px-3 py-2 text-right font-medium">Tarifa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {config.retefuenteConcepts.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 text-slate-700">
                        {c.label}
                        {c.nota && <div className="text-xs text-slate-400">{c.nota}</div>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-600">{c.baseUvt || '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{(c.rate * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={guardarTax}>Guardar parámetros</Button>
            {taxOk && <span className="text-sm text-green-600">✓ Guardado</span>}
            <button className="ml-auto text-xs text-slate-400 hover:text-slate-600" onClick={restaurarTax}>
              Restaurar por defecto
            </button>
          </div>
        </Card>

        {/* Google Sheets */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-900">Almacenamiento — Google Sheets</h2>
          <p className="mb-4 text-sm text-slate-500">
            Estado actual:{' '}
            <span className="font-medium">
              {storeKind === 'sheets' ? 'Conectado a Google Sheets' : 'Local (este equipo)'}
            </span>
            . Pega la URL del Apps Script desplegado como Web App para sincronizar tus datos.
          </p>
          <Field label="URL del Apps Script (Web App)">
            <Input
              placeholder="https://script.google.com/macros/s/AKfy.../exec"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrlState(e.target.value)}
            />
          </Field>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={conectarSheets} disabled={!sheetsUrl.trim()}>
              Conectar
            </Button>
            {storeKind === 'sheets' && (
              <Button variant="secondary" onClick={desconectarSheets}>
                Desconectar
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Las instrucciones para crear el Apps Script están en el archivo README del proyecto
            (carpeta <code>apps-script/</code>).
          </p>
        </Card>
      </div>
    </div>
  )
}
