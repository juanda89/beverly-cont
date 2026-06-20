# Plan — Captura por correo + Conciliación DIAN (evolución de facturador-co)

> Basado en `PRD_Facturas_Contadores.docx` (v1.0) + decisiones del owner.
> Fecha: 2026-06-19.

## 0. Contexto: qué existe vs. qué pide el PRD

| | Hoy (`facturador-co`) | PRD (nuevo módulo) |
|---|---|---|
| Foco | Facturas que el contador **emite** | Facturas **recibidas** (compras/gastos) |
| Captura | Manual (FacturaEditor) | **Automática** desde Gmail |
| Inteligencia | Motor tributario puro | **OCR doble (IA)** + conciliación |
| DIAN | No conecta | **Conciliación semanal** con VPFE |
| Backend | SPA + Apps Script (Sheets) | + worker de automatización + IA |

**Conclusión:** el PRD es un **módulo nuevo grande** sobre la misma base (mismo contador, mismos clientes/proyectos, mismo backend Sheets). Reutiliza la shell (auth, clientes, Sheets, UI) pero **agrega capacidades que el SPA puro no puede hacer solo**: leer Gmail en segundo plano, llamar a IA con secretos, correr en horario, y automatizar el portal DIAN.

---

## 1. Cambio arquitectónico clave

El frontend actual es un SPA estático. El PRD exige **3 piezas que no viven en el navegador**:

1. **Captura continua de Gmail + clasificación/OCR con IA** → tareas en segundo plano con secretos (API keys).
2. **Barrida semanal DIAN** → tarea programada + **navegador real** (el portal tiene CAPTCHA).
3. **Gestión de secretos/tokens** (OAuth, OpenRouter, sesión DIAN).

### Arquitectura propuesta (MVP, costo bajo, apóyate en lo que ya hay)

```
┌─────────────┐     ┌──────────────────────────────────────┐
│  SPA React  │◀───▶│  Google Apps Script  (ya en uso)       │
│ (frontend)  │     │  • Gmail capture (GmailApp)            │
└─────────────┘     │  • Clasificador + OCR (UrlFetch→OpenRouter)
                    │  • Upsert en Sheets (por CUFE)         │
                    │  • Trigger por tiempo (cada N min)     │
                    └───────────────┬──────────────────────┘
                                    │ (CUFEs a verificar)
                    ┌───────────────▼──────────────────────┐
                    │  Worker DIAN  (Node + Playwright)      │  ← solo esta pieza necesita navegador
                    │  • Login portal + token desde Gmail    │
                    │  • CAPTCHA = humano (ver §3)           │
                    │  • Descarga PDF/listado → upsert Sheets│
                    └───────────────────────────────────────┘
```

**Por qué Apps Script para casi todo el MVP:** es Google nativo → `GmailApp` lee correos, `UrlFetchApp` llama a OpenRouter, escribe en Sheets, y los **triggers por tiempo** cubren el "cada 5 min" y el "semanal". Cero hosting extra, cero secretos en cliente. Ya lo usamos para Sheets. Límites (6 min/ejecución, cuotas UrlFetch) son aceptables para pocos contadores; migrar a un servicio Node cuando escale.

**Por qué el worker DIAN aparte:** Apps Script no puede correr un navegador ni resolver el CAPTCHA. El worker (Node + Playwright) se aísla y corre donde haya navegador (máquina del contador / VPS / browserless). Es la única pieza "pesada".

> Migración futura (cuando el volumen lo pida): mover la captura/OCR a un servicio Node (Fastify) + cola + **Supabase/Postgres** en vez de Sheets (el propio PRD §12.5 lo recomienda).

---

## 2. Decisión del owner sobre DIAN + el CAPTCHA (lo central)

El portal **VPFE** de la DIAN protege las consultas con un challenge de **Cloudflare (Turnstile, el "Verify you are human")**. Tu indicación: *"esperar que cargue el botón de Cloudflare y dar clic en 'I'm human'"*. Eso es exactamente el patrón correcto — y lo encaramos así:

### Camino recomendado — **Opción A: proveedor autorizado con API de recepción**
Consumir las facturas recibidas vía un proveedor de FE con API (**Alanube, Dataico, Factus, o la recepción de Alegra**). **Evita el CAPTCHA por completo**, es estable, y es legalmente limpio. El PRD (§9.3) la marca como preferida y coincido: para una "barrida semanal **desatendida**", esta es la única vía que funciona sin un humano en cada corrida.

### Camino alterno — **Opción B: portal autenticado con automatización ASISTIDA**
Si se opta por el portal (tu preferencia inicial), así de forma sostenible y conforme:

- **Automatización con Playwright (open-source)** para todo lo automatizable: login con tipo de doc + NIT, lectura del **token de un solo uso desde el Gmail conectado**, navegación al listado de "recibidos", y descarga de PDFs por CUFE.
- **El CAPTCHA lo resuelve un HUMANO** (el contador), no un solver:
  - Se corre el navegador **visible** (headful) o se transmite la sesión (browserless / noVNC) al contador.
  - El sistema **espera a que cargue el widget de Cloudflare**, lo muestra, y el contador da clic en **"I'm human"**.
  - Tras resolverlo, **persistimos la sesión/cookies** (`storageState` de Playwright) para reusarla y minimizar nuevos challenges dentro de esa ventana.
- **NO** integramos un solver/bypass automático de CAPTCHA. Razones: (1) va contra los términos del portal estatal; (2) Turnstile detecta automatización headless y endurece el reto → es frágil y se rompe seguido; (3) no es algo que se deba construir. El patrón **humano-en-el-loop** que describiste es el robusto y el que aguanta en el tiempo. *(Esto alinea con el propio PRD §9.2 y §15: "no resolver CAPTCHA de forma automática".)*

> **Implicación de producto a tener clara:** con la Opción B, la barrida DIAN **no es 100% desatendida** — necesita que el contador haga el clic del CAPTCHA en cada sesión (o cada vez que Cloudflare lo pida). Si quieres el "semanal automático de verdad" del PRD, la **Opción A es la que lo cumple**. Mi recomendación: **A para la conciliación automática**; B como fallback manual/asistido para consultas puntuales.

**Decisión tomada (default, sin preferencia del owner → recomendación):** **Híbrido** — apuntar a **Opción A (proveedor API)** para la conciliación automática semanal, con **Opción B (portal asistido)** como fallback para consultas puntuales. La pieza B (worker Playwright + CAPTCHA humano) se especifica igual porque no depende de contratar proveedor; A se activa al confirmar proveedor (decisión #4 abajo).

---

## 3. Captura por correo (RF-201…207)

- **Gmail por cliente** vía OAuth **solo-lectura** (`gmail.readonly`). En MVP, Apps Script puede leer el buzón del propio contador; para multi-cliente real se usa Gmail API con OAuth por cuenta conectada.
- **Detección:** push (Gmail watch + Pub/Sub) ideal; **sondeo periódico** (trigger Apps Script cada 5 min) para el MVP (más simple).
- **Clasificador barato** (modelo económico vía OpenRouter) lee asunto+cuerpo+adjuntos y decide "¿factura sí/no?" antes de gastar OCR.
- **Adjuntos:** PDF, imagen y **ZIP** (descomprimir y evaluar cada archivo; capturar **XML** si viene — es el documento con validez legal, §9.2).
- **Dedup** por hash de archivo + por CUFE para no reprocesar.

## 4. OCR doble + conciliación (RF-301…307, §8)

- **Dos modelos vía OpenRouter** en paralelo: **DeepSeek-OCR** (Modelo A) + **Gemini multimodal** (Modelo B). Cada uno devuelve **JSON estructurado** con los campos mínimos (§8.2: tipo doc, prefijo+número, CUFE/CUDE, emisor/NIT, adquirente/NIT, fecha, subtotal/IVA/otros/total, moneda).
- **Normalizar** (trim, mayúsculas, números/fechas) → **comparar campos clave** (CUFE, NIT emisor, número, fecha, total) exactos; razón social con comparación tolerante.
- Coinciden → **estado OK**. Difieren → **"Revisión manual"** con campos en conflicto resaltados. Se guardan **ambas lecturas** para auditoría.
- **Upsert por CUFE** (clave; fallback NIT+número+fecha). **Prioridad DIAN > OCR**; **ediciones manuales del contador se preservan** (RF-306/307).
- **Control de costos** (§8.4): OCR solo si el clasificador confirma; caché por hash; registrar costo por documento/cliente.

## 5. Datos (§11)

- MVP en **Google Sheets**: 1 carpeta por contador, 1 hoja por cliente, 1 fila por factura. Esquema del §11.2 tal cual (id_registro, cufe_cude, fuente, estado, emisor/adquirente, montos, modelo_a/b, enlaces a archivo/pdf_dian/xml, marcas de carga Fase 2, timestamps).
- **Upsert** idempotente (clave CUFE). Definir **umbral de migración a Postgres/Supabase** (concurrencia/volumen) desde ya.

## 6. Seguridad y cumplimiento (§12)

- OAuth con permisos mínimos (Gmail **solo lectura**). ⚠️ **Riesgo alto y lento:** Google exige **verificación de app** para scopes restringidos de Gmail (CASA security assessment). **Iniciarlo YA** y usar cuenta de prueba en el MVP.
- **Ley 1581/2012 (Habeas Data):** política de privacidad, minimización, retención y consentimiento (las facturas son datos personales/fiscales).
- Secretos gestionados; tokens DIAN **efímeros**, nunca en texto plano; cifrado en tránsito/reposo.

---

## 7. Roadmap por fases

### Fase 0 — Decisiones + cimientos (1 semana)
- [ ] **Decidir DIAN: Opción A (proveedor API) vs B (portal asistido)** ← bloqueante.
- [ ] Confirmar IDs exactos de modelos en OpenRouter (DeepSeek-OCR, Gemini, clasificador).
- [ ] Crear proyecto Google Cloud + OAuth consent; **arrancar verificación de Gmail** (es el cuello de botella de tiempo).
- [ ] Definir esquema Sheets y la interfaz de upsert.

### Fase 1 — MVP (núcleo del PRD)
1. **Auth + proyectos/clientes** (RF-101…104): extender la shell existente; registrar tipo doc + NIT por cliente.
2. **Conexión Gmail** por cliente (OAuth readonly) + detección (sondeo Apps Script).
3. **Pipeline de captura**: clasificador → descompresión ZIP → OCR doble → conciliación → upsert Sheets.
4. **Tabla consolidada por cliente** con filtros por fecha y por cualquier campo + estado/fuente (RF-501…503).
5. **DIAN** según decisión Fase 0:
   - A: integrar API del proveedor → upsert.
   - B: worker Playwright + token-desde-Gmail + **CAPTCHA asistido** + descarga → upsert.
6. **No-funcionales**: reintentos con backoff, idempotencia, log de cada corrida visible al contador.

### Fase 2 — Carga contable
- Botones **Alegra** y **Qenta** por fila (RF-504/505) → API → marcar "Cargada" con fecha/destino. (Qenta: confirmar API; si no, exportación/automatización.)

### Futuro
- Migración Sheets → Postgres/Supabase · Outlook · panel de métricas (las del §2.2) · multiusuario por despacho · uso del XML como fuente autoritativa.

---

## 8. Riesgos (del PRD §15 + añadidos)

| Riesgo | Mitigación |
|---|---|
| **CAPTCHA DIAN** | Opción A (sin captcha) o B asistida por humano. **Nunca** auto-solver. |
| **Verificación OAuth Gmail (Google)** ⏱️ | Arrancar el proceso en Fase 0; cuenta de prueba en MVP. *(El más subestimado: puede tardar semanas.)* |
| Barrida B no desatendida | Aceptar toque humano por sesión, o ir por Opción A. |
| Demora 48h / registro incompleto DIAN | Ventana de 15 días + reintentos. |
| Intermitencia VPFE | Backoff, fuera de cierre contable, alertas. |
| Costo doble OCR | Clasificador previo + caché + dedup. |
| Límites Sheets | Umbral de migración definido. |
| Datos Ley 1581 | Minimización, consentimiento, retención. |

---

## 9. Decisiones

**Confirmadas por el owner — 2026-06-19:**
1. ✅ **Emisión (`facturador-co`) EN PAUSA.** El producto es el del PRD (recepción + conciliación). Se reutiliza solo el cáscaron técnico (React/Vite/TS/Tailwind, UI, conexión Sheets); se retiran las páginas/dominio de emisión (FacturaEditor, motor tributario, etc.).
2. ✅ **DIAN: Opción B — acceso DIRECTO al portal, SIN operador/proveedor** (decisión del owner 2026-06-19). Automatización propia (Node + Playwright): login con datos de la empresa → lee el token de un solo uso desde el Gmail conectado → navega a "documentos recibidos" (últimos 15 días) → descarga PDF/XML por CUFE → upsert. **CAPTCHA = humano-en-el-loop:** el contador da el clic de Cloudflare en sesión visible; se persiste `storageState` para minimizar retos. **NO se construye solver/bypass automático de CAPTCHA** (lo prohíbe el portal estatal + Turnstile detecta headless y rompe el flujo). Opción A (proveedor) **descartada**.
3. ✅ **Datos: Drive de cada contador** (modelo PRD §11.1). La app provisiona, bajo la cuenta Google del contador, 1 carpeta por contador + 1 hoja por cliente. **Sin base de datos central nuestra** en el MVP (evita ser responsables de datos fiscales de terceros bajo Ley 1581). DB central/Supabase = migración futura (§12.5).

**Pendientes:**
4. **XML:** recomendado capturar y guardar además del PDF → asumido SÍ salvo indicación contraria.
5. ❌ **Proveedor DIAN/API: DESCARTADO** — el owner quiere acceso directo sin operador (ver #2).
6. **Multiusuario:** un contador por cuenta en MVP; despacho multiusuario = futuro.
