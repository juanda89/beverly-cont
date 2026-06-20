import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { FacturaRecibida, Proyecto } from '../lib/types'
import { createStore, type DataStore } from '../lib/storage'
import { MOCK_FACTURAS, MOCK_PROYECTOS } from '../lib/mock'

export interface CuentaGoogle {
  conectada: boolean
  email: string
}

const K_CUENTA = 'recepcion.cuentaGoogle'

function leerCuenta(): CuentaGoogle {
  try {
    const raw = localStorage.getItem(K_CUENTA)
    return raw ? (JSON.parse(raw) as CuentaGoogle) : { conectada: false, email: '' }
  } catch {
    return { conectada: false, email: '' }
  }
}

interface AppDataValue {
  loading: boolean
  error: string | null
  storeKind: 'local' | 'sheets'
  cuentaGoogle: CuentaGoogle
  conectarGoogle: (email?: string) => void
  desconectarGoogle: () => void
  proyectos: Proyecto[]
  facturas: FacturaRecibida[]
  reload: () => Promise<void>
  saveProyecto: (p: Proyecto) => Promise<void>
  deleteProyecto: (id: string) => Promise<void>
  saveFactura: (f: FacturaRecibida) => Promise<void>
  deleteFactura: (id: string) => Promise<void>
  proyectoById: (id: string) => Proyecto | undefined
  facturasDe: (proyectoId: string) => FacturaRecibida[]
}

const AppDataContext = createContext<AppDataValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<DataStore | null>(null)
  if (!storeRef.current) storeRef.current = createStore()
  const store = storeRef.current

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [facturas, setFacturas] = useState<FacturaRecibida[]>([])
  const [cuentaGoogle, setCuentaGoogle] = useState<CuentaGoogle>(() => leerCuenta())

  const conectarGoogle = useCallback((email?: string) => {
    const cuenta = { conectada: true, email: email || 'contador@gmail.com' }
    localStorage.setItem(K_CUENTA, JSON.stringify(cuenta))
    setCuentaGoogle(cuenta)
  }, [])

  const desconectarGoogle = useCallback(() => {
    const cuenta = { conectada: false, email: '' }
    localStorage.setItem(K_CUENTA, JSON.stringify(cuenta))
    setCuentaGoogle(cuenta)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let [ps, fs] = await Promise.all([store.listProyectos(), store.listFacturas()])
      // Siembra de demo: solo en modo local y si está vacío.
      // En secuencia (no Promise.all): el adaptador local hace read-modify-write
      // y en paralelo la última escritura pisaría a las demás.
      if (store.kind === 'local' && ps.length === 0 && fs.length === 0) {
        for (const p of MOCK_PROYECTOS) await store.saveProyecto(p)
        for (const f of MOCK_FACTURAS) await store.saveFactura(f)
        ps = await store.listProyectos()
        fs = await store.listFacturas()
      }
      setProyectos(ps)
      setFacturas(fs)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [store])

  useEffect(() => {
    void reload()
  }, [reload])

  const saveProyecto = useCallback(
    async (p: Proyecto) => {
      await store.saveProyecto(p)
      setProyectos((prev) => {
        const idx = prev.findIndex((x) => x.id === p.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = p
          return next
        }
        return [...prev, p]
      })
    },
    [store],
  )

  const deleteProyecto = useCallback(
    async (id: string) => {
      await store.deleteProyecto(id)
      setProyectos((prev) => prev.filter((x) => x.id !== id))
      setFacturas((prev) => prev.filter((f) => f.proyectoId !== id))
    },
    [store],
  )

  const saveFactura = useCallback(
    async (f: FacturaRecibida) => {
      await store.saveFactura(f)
      setFacturas((prev) => {
        const idx = prev.findIndex((x) => x.id === f.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = f
          return next
        }
        return [...prev, f]
      })
    },
    [store],
  )

  const deleteFactura = useCallback(
    async (id: string) => {
      await store.deleteFactura(id)
      setFacturas((prev) => prev.filter((x) => x.id !== id))
    },
    [store],
  )

  const proyectoById = useCallback(
    (id: string) => proyectos.find((p) => p.id === id),
    [proyectos],
  )

  const facturasDe = useCallback(
    (proyectoId: string) => facturas.filter((f) => f.proyectoId === proyectoId),
    [facturas],
  )

  const value = useMemo<AppDataValue>(
    () => ({
      loading,
      error,
      storeKind: store.kind,
      cuentaGoogle,
      conectarGoogle,
      desconectarGoogle,
      proyectos,
      facturas,
      reload,
      saveProyecto,
      deleteProyecto,
      saveFactura,
      deleteFactura,
      proyectoById,
      facturasDe,
    }),
    [loading, error, store.kind, cuentaGoogle, conectarGoogle, desconectarGoogle, proyectos, facturas, reload, saveProyecto, deleteProyecto, saveFactura, deleteFactura, proyectoById, facturasDe],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData debe usarse dentro de <AppDataProvider>')
  return ctx
}
