# Recepción CO — Captura y conciliación de facturas para contadores 🧾

Herramienta web (SaaS) para contadores en Colombia que **captura las facturas
recibidas** por correo, las **lee con IA (OCR doble)** y las **concilia con la
DIAN**, dejando una tabla consolidada y confiable por cada empresa cliente.

> Basado en `PRD_Facturas_Contadores.docx` (v1.0). Plan completo en
> [PLAN-CAPTURA-CONCILIACION-DIAN.md](PLAN-CAPTURA-CONCILIACION-DIAN.md).

## Estado actual

**Fase 1 — Frontend de recepción (demo navegable con datos de prueba).** ✅
Construido y verificado:

- **Inicio**: resumen (proyectos, facturas capturadas, por revisar, total) + bandeja de revisión.
- **Proyectos**: una empresa cliente por proyecto, con NIT y estado de conexión Gmail.
- **Tabla consolidada** por proyecto: filtros por fecha, texto libre, estado y fuente (Correo/DIAN).
- **Revisión humana**: compara la lectura del Modelo A vs Modelo B y resalta los campos en conflicto; resuelve a "OK".

Corre con **datos mock** en el navegador. El pipeline real (Gmail → clasificador →
OCR → upsert → DIAN) se conecta en las siguientes etapas.

> ⏸️ El módulo de **emisión** de facturas (versión anterior) quedó archivado en
> [`_emision-pausada/`](_emision-pausada/) — fuera del build, conservado como referencia.

## Correr en local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Stack

Vite + React + TypeScript + Tailwind v4. Persistencia desacoplada (`DataStore`):
`localStorage` para la demo; **Google Sheets/Drive** (vía Apps Script) para producción.

## Estructura

```
src/
├─ lib/
│  ├─ types.ts            # Proyecto, FacturaRecibida, LecturaModelo (esquema §11.2 del PRD)
│  ├─ mock.ts             # datos de prueba (3 proyectos, 8 facturas)
│  ├─ format.ts           # formato COP / fechas
│  └─ storage/            # DataStore: local.ts (demo) + sheets.ts (Apps Script)
├─ state/AppData.tsx      # contexto global + siembra de demo
├─ components/ui.tsx      # primitivos de UI
└─ pages/                 # Dashboard, Proyectos, ProyectoDetalle, FacturaRevision, Configuracion
```

## Decisiones (confirmadas con el owner)

- **Producto = recepción/conciliación** (no emisión).
- **DIAN = híbrido**: Opción A (proveedor API) para lo automático + Opción B (portal asistido, CAPTCHA por humano) como fallback. **Nunca** auto-solver de CAPTCHA.
- **Datos en el Drive de cada contador** (1 carpeta/contador + 1 hoja/cliente). Sin base de datos central en el MVP.

## Pendiente (Fase 0 — gating, lo gestiona el owner)

1. ⏱️ **Verificación de Gmail con Google (CASA)** — arrancar ya, tarda semanas.
2. **OpenRouter**: API key + IDs de modelo (DeepSeek-OCR, Gemini, clasificador).
3. **Proveedor DIAN** (Alanube/Dataico/Factus/Alegra recepción) para la Opción A.

## Próximos pasos (Fase 1, una vez con credenciales)

- Provisión Sheets/Drive por contador (Apps Script).
- Conexión Gmail real (OAuth readonly) + detección por sondeo.
- Pipeline: clasificador → descompresión ZIP → OCR doble → conciliación → upsert por CUFE.
- DIAN: integración del proveedor (A) y/o worker Playwright asistido (B).
- Fase 2: botones de carga a Alegra / Qenta.

---

⚠️ Apoya la gestión; no sustituye el criterio profesional del contador ni la normativa de la DIAN.
