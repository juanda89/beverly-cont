/**
 * Recepción CO — Backend en Google Sheets / Drive (Apps Script Web App)
 * =====================================================================
 * Modelo PRD §11.1: el archivo de cálculo es el "workspace" del contador
 * (vive en su Drive). Dentro:
 *   • pestaña "Proyectos"  → índice de empresas cliente
 *   • una pestaña por cliente → tabla consolidada de sus facturas (§11.2)
 *
 * Despliegue: Extensiones → Apps Script → pegar este código → Implementar como
 * "Aplicación web" (ejecutar como: Yo · acceso: cualquiera) → copiar URL /exec
 * y pegarla en Configuración → Almacenamiento de la app.
 *
 * Protocolo: POST text/plain con { action, payload } → responde { ok, data }.
 */

var SHEET_ID = '' // vacío = usa la hoja que contiene este script

var PROYECTO_COLS = [
  'id', 'nombre', 'tipoDocumento', 'identificacion', 'dv',
  'gmailConectado', 'gmailCuenta', 'dianProveedor', 'creadoEn', 'tabName',
]

// Esquema §11.2 (campos anidados se guardan como JSON).
var FACTURA_COLS = [
  'id', 'proyectoId', 'fuente', 'estado', 'cufe', 'tipoDocumento', 'prefijo',
  'numero', 'emisorNombre', 'emisorNit', 'adquirenteNombre', 'adquirenteNit',
  'fechaEmision', 'fechaRecepcion', 'moneda', 'subtotal', 'iva',
  'otrosImpuestos', 'total', 'estadoDian', 'concordanciaOcr',
  'camposDiscrepancia', 'modeloA', 'modeloB', 'archivoOrigen', 'pdfDian',
  'xml', 'cargadaAlegra', 'cargadaQenta', 'creadoEn', 'actualizadoEn',
]
var FACTURA_JSON_FIELDS = ['camposDiscrepancia', 'modeloA', 'modeloB']
var FACTURA_BOOL_FIELDS = ['concordanciaOcr']
var FACTURA_NUM_FIELDS = ['subtotal', 'iva', 'otrosImpuestos', 'total']

var PROYECTOS_TAB = 'Proyectos'

function ss() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet()
}

function getSheet(name, headers) {
  var s = ss()
  var sh = s.getSheetByName(name)
  if (!sh) {
    sh = s.insertSheet(name)
    sh.appendRow(headers)
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(headers)
  }
  return sh
}

function readObjects(sh) {
  var values = sh.getDataRange().getValues()
  if (values.length < 2) return []
  var header = values[0]
  var out = []
  for (var i = 1; i < values.length; i++) {
    var r = values[i]
    if (r[0] === '' || r[0] == null) continue
    var o = {}
    for (var c = 0; c < header.length; c++) o[header[c]] = r[c]
    out.push(o)
  }
  return out
}

function rowFromObject(obj, cols) {
  return cols.map(function (c) {
    var v = obj[c]
    return v === undefined || v === null ? '' : v
  })
}

function upsertRow(sh, cols, obj) {
  var ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues()
  var rowIndex = -1
  for (var i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(obj.id)) { rowIndex = i + 1; break }
  }
  var row = rowFromObject(obj, cols)
  if (rowIndex > 0) sh.getRange(rowIndex, 1, 1, cols.length).setValues([row])
  else sh.appendRow(row)
}

function deleteRowById(sh, id) {
  var ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues()
  for (var i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 1); return }
  }
}

// --- Proyectos ---

function proyectosSheet() {
  return getSheet(PROYECTOS_TAB, PROYECTO_COLS)
}

function sanitizeTab(nombre, id) {
  var base = String(nombre || 'Cliente').replace(/[\[\]\*\/\\\?:]/g, ' ').trim().slice(0, 24)
  return (base + ' ' + String(id).slice(0, 4)) || ('C-' + id)
}

function listProyectos() {
  return readObjects(proyectosSheet()).map(function (o) {
    return {
      id: String(o.id), nombre: o.nombre, tipoDocumento: o.tipoDocumento || 'NIT',
      identificacion: String(o.identificacion == null ? '' : o.identificacion),
      dv: o.dv === '' ? '' : String(o.dv),
      gmailConectado: o.gmailConectado === true || o.gmailConectado === 'TRUE',
      gmailCuenta: o.gmailCuenta || '', dianProveedor: o.dianProveedor || '',
      creadoEn: o.creadoEn || '',
    }
  })
}

function saveProyecto(p) {
  var sh = proyectosSheet()
  // localiza o asigna el nombre de pestaña de facturas del proyecto
  var existing = readObjects(sh)
  var match = null
  for (var i = 0; i < existing.length; i++) if (String(existing[i].id) === String(p.id)) match = existing[i]
  var tabName = (match && match.tabName) ? match.tabName : sanitizeTab(p.nombre, p.id)
  var record = {
    id: p.id, nombre: p.nombre, tipoDocumento: p.tipoDocumento, identificacion: p.identificacion,
    dv: p.dv || '', gmailConectado: !!p.gmailConectado, gmailCuenta: p.gmailCuenta || '',
    dianProveedor: p.dianProveedor || '', creadoEn: p.creadoEn || new Date().toISOString(),
    tabName: tabName,
  }
  upsertRow(sh, PROYECTO_COLS, record)
  getSheet(tabName, FACTURA_COLS) // asegura la pestaña de facturas
  return p
}

function deleteProyecto(id) {
  var sh = proyectosSheet()
  var rows = readObjects(sh)
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) {
      var tab = ss().getSheetByName(rows[i].tabName)
      if (tab) ss().deleteSheet(tab)
    }
  }
  deleteRowById(sh, id)
}

function tabDeProyecto(proyectoId) {
  var rows = readObjects(proyectosSheet())
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(proyectoId)) {
      return getSheet(rows[i].tabName || sanitizeTab(rows[i].nombre, proyectoId), FACTURA_COLS)
    }
  }
  return null
}

// --- Facturas ---

function facturaFromRow(o) {
  var f = {}
  for (var k in o) f[k] = o[k]
  FACTURA_JSON_FIELDS.forEach(function (k) {
    try { f[k] = o[k] ? JSON.parse(o[k]) : (k === 'camposDiscrepancia' ? [] : null) }
    catch (e) { f[k] = k === 'camposDiscrepancia' ? [] : null }
  })
  FACTURA_BOOL_FIELDS.forEach(function (k) { f[k] = o[k] === true || o[k] === 'TRUE' })
  FACTURA_NUM_FIELDS.forEach(function (k) { f[k] = Number(o[k]) || 0 })
  f.id = String(o.id); f.cufe = String(o.cufe || ''); f.numero = String(o.numero || '')
  f.emisorNit = String(o.emisorNit || '')
  return f
}

function facturaToRow(f) {
  var o = {}
  for (var k in f) o[k] = f[k]
  FACTURA_JSON_FIELDS.forEach(function (k) { o[k] = JSON.stringify(f[k] || (k === 'camposDiscrepancia' ? [] : null)) })
  FACTURA_BOOL_FIELDS.forEach(function (k) { o[k] = !!f[k] })
  return o
}

function listFacturas() {
  var out = []
  var proyectos = readObjects(proyectosSheet())
  for (var i = 0; i < proyectos.length; i++) {
    var tab = ss().getSheetByName(proyectos[i].tabName)
    if (!tab) continue
    var rows = readObjects(tab)
    for (var j = 0; j < rows.length; j++) out.push(facturaFromRow(rows[j]))
  }
  return out
}

function saveFactura(f) {
  var tab = tabDeProyecto(f.proyectoId)
  if (!tab) throw new Error('Proyecto no encontrado: ' + f.proyectoId)
  upsertRow(tab, FACTURA_COLS, facturaToRow(f))
  return f
}

function deleteFactura(id) {
  var proyectos = readObjects(proyectosSheet())
  for (var i = 0; i < proyectos.length; i++) {
    var tab = ss().getSheetByName(proyectos[i].tabName)
    if (tab) deleteRowById(tab, id)
  }
}

/**
 * Upsert por CUFE (RF-305). Lo usará el pipeline de captura/DIAN.
 * Si existe el CUFE en la pestaña del proyecto: combina (prioridad DIAN sobre
 * OCR, RF-306) preservando ediciones manuales. Si no, inserta.
 */
function upsertFacturaByCufe(proyectoId, incoming) {
  var tab = tabDeProyecto(proyectoId)
  if (!tab) throw new Error('Proyecto no encontrado: ' + proyectoId)
  var rows = readObjects(tab).map(facturaFromRow)
  var prev = null
  for (var i = 0; i < rows.length; i++) {
    if (incoming.cufe && String(rows[i].cufe) === String(incoming.cufe)) { prev = rows[i]; break }
  }
  var merged = incoming
  if (prev) {
    merged = {}
    for (var k in prev) merged[k] = prev[k]
    // la DIAN prevalece; el correo solo completa vacíos
    for (var k2 in incoming) {
      var v = incoming[k2]
      if (v === undefined || v === null || v === '') continue
      if (incoming.fuente === 'dian' || prev[k2] === undefined || prev[k2] === null || prev[k2] === '') {
        merged[k2] = v
      }
    }
    merged.id = prev.id
    merged.actualizadoEn = new Date().toISOString()
  }
  upsertRow(tab, FACTURA_COLS, facturaToRow(merged))
  return merged
}

// --- Router ---

function handle(action, payload) {
  switch (action) {
    case 'listProyectos': return listProyectos()
    case 'saveProyecto': return saveProyecto(payload)
    case 'deleteProyecto': deleteProyecto(payload.id); return null
    case 'listFacturas': return listFacturas()
    case 'saveFactura': return saveFactura(payload)
    case 'deleteFactura': deleteFactura(payload.id); return null
    case 'upsertFacturaByCufe': return upsertFacturaByCufe(payload.proyectoId, payload.factura)
    default: throw new Error('Acción desconocida: ' + action)
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  var lock = LockService.getScriptLock()
  try {
    lock.waitLock(20000)
    var body = JSON.parse(e.postData.contents)
    return json({ ok: true, data: handle(body.action, body.payload) })
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) })
  } finally {
    try { lock.releaseLock() } catch (e2) {}
  }
}

function doGet() {
  return json({ ok: true, data: 'Recepción CO backend activo' })
}
