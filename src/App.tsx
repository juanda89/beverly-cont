import { NavLink, Route, Routes } from 'react-router-dom'
import { useAppData } from './state/AppData'
import Dashboard from './pages/Dashboard'
import Proyectos from './pages/Proyectos'
import ProyectoDetalle from './pages/ProyectoDetalle'
import FacturaRevision from './pages/FacturaRevision'
import Configuracion from './pages/Configuracion'

const navItems = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/proyectos', label: 'Proyectos', icon: '🏢' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙️' },
]

function Sidebar() {
  const { storeKind } = useAppData()
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
          R
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight text-slate-900">Recepción CO</div>
          <div className="text-xs text-slate-400">Captura + DIAN</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className={`h-2 w-2 rounded-full ${storeKind === 'sheets' ? 'bg-green-500' : 'bg-amber-400'}`} />
          {storeKind === 'sheets' ? 'Google Sheets' : 'Demo (datos de prueba)'}
        </div>
      </div>
    </aside>
  )
}

export default function App() {
  const { loading, error } = useAppData()

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Error de datos: {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">Cargando…</div>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/proyectos" element={<Proyectos />} />
              <Route path="/proyectos/:id" element={<ProyectoDetalle />} />
              <Route path="/facturas/:id" element={<FacturaRevision />} />
              <Route path="/configuracion" element={<Configuracion />} />
            </Routes>
          )}
        </div>
      </main>
    </div>
  )
}
