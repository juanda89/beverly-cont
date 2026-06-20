/**
 * Facturador CO — Backend en Google Sheets (Apps Script Web App)
 * =============================================================
 * Pega este código en Extensiones → Apps Script de tu hoja de cálculo,
 * despliégalo como "Aplicación web" (ejecutar como: tú; acceso: cualquiera)
 * y copia la URL /exec en Configuración → Google Sheets de la app.
 *
 * Crea automáticamente las pestañas: Clientes, Facturas, Config.
 */

// Deja vacío para usar la hoja que contiene este script (recomendado).
var SHEET_ID = ''

var CLIENTE_COLS = [
  'id', 'tipoDocumento', 'documento', 'dv', 'razonSocial', 'email',
  'telefono', 'direccion', 'ciudad', 'declaranteRenta', 'autorretenedor',
  'responsabilidad', 'createdAt',
]
var FACTURA_COLS = [
  'id', 'numero', 'clienteId', 'fecha', 'fechaVencimiento', 'estado',
  'retefuenteConceptId', 'aplicaReteIva', 'reteIcaPorMil', 'notas',
  'createdAt', 'itemsJson',
]

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

function readAll(name, cols) {
  var sh = getSheet(name, cols)
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

function upsert(name, cols, obj) {
  var sh = getSheet(name, cols)
  var ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues()
  var rowIndex = -1
  for (var i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(obj.id)) { rowIndex = i + 1; break }
  }
  var row = rowFromObject(obj, cols)
  if (rowIndex > 0) {
    sh.getRange(rowIndex, 1, 1, cols.length).setValues([row])
  } else {
    sh.appendRow(row)
  }
}

function deleteById(name, cols, id) {
  var sh = getSheet(name, cols)
  var ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues()
  for (var i = 1; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 1); return }
  }
}

// --- Mapeo de tipos ---
function toCliente(o) {
  return {
    id: String(o.id),
    tipoDocumento: o.tipoDocumento || 'NIT',
    documento: String(o.documento == null ? '' : o.documento),
    dv: o.dv === '' || o.dv == null ? '' : String(o.dv),
    razonSocial: o.razonSocial || '',
    email: o.email || '',
    telefono: o.telefono === '' ? '' : String(o.telefono || ''),
    direccion: o.direccion || '',
    ciudad: o.ciudad || '',
    declaranteRenta: o.declaranteRenta === true || o.declaranteRenta === 'TRUE',
    autorretenedor: o.autorretenedor === true || o.autorretenedor === 'TRUE',
    responsabilidad: o.responsabilidad || 'responsable_iva',
    createdAt: o.createdAt || '',
  }
}

function facturaToRowObject(f) {
  return {
    id: f.id, numero: f.numero, clienteId: f.clienteId, fecha: f.fecha,
    fechaVencimiento: f.fechaVencimiento || '', estado: f.estado,
    retefuenteConceptId: f.retefuenteConceptId || '',
    aplicaReteIva: !!f.aplicaReteIva, reteIcaPorMil: f.reteIcaPorMil || 0,
    notas: f.notas || '', createdAt: f.createdAt || '',
    itemsJson: JSON.stringify(f.items || []),
  }
}

function toFactura(o) {
  var items = []
  try { items = o.itemsJson ? JSON.parse(o.itemsJson) : [] } catch (e) { items = [] }
  return {
    id: String(o.id), numero: String(o.numero), clienteId: String(o.clienteId),
    fecha: String(o.fecha).slice(0, 10), fechaVencimiento: o.fechaVencimiento ? String(o.fechaVencimiento).slice(0, 10) : '',
    estado: o.estado || 'borrador',
    retefuenteConceptId: o.retefuenteConceptId || null,
    aplicaReteIva: o.aplicaReteIva === true || o.aplicaReteIva === 'TRUE',
    reteIcaPorMil: Number(o.reteIcaPorMil) || 0,
    notas: o.notas || '', createdAt: o.createdAt || '', items: items,
  }
}

// --- Router ---
function handle(action, payload) {
  switch (action) {
    case 'listClientes':
      return readAll('Clientes', CLIENTE_COLS).map(toCliente)
    case 'saveCliente':
      upsert('Clientes', CLIENTE_COLS, payload)
      return payload
    case 'deleteCliente':
      deleteById('Clientes', CLIENTE_COLS, payload.id)
      return null
    case 'listFacturas':
      return readAll('Facturas', FACTURA_COLS).map(toFactura)
    case 'saveFactura':
      upsert('Facturas', FACTURA_COLS, facturaToRowObject(payload))
      return payload
    case 'deleteFactura':
      deleteById('Facturas', FACTURA_COLS, payload.id)
      return null
    case 'getConfig': {
      var sh = getSheet('Config', ['json'])
      var raw = sh.getRange('A2').getValue()
      return raw ? JSON.parse(raw) : null
    }
    case 'saveConfig': {
      var s = getSheet('Config', ['json'])
      s.getRange('A2').setValue(JSON.stringify(payload))
      return null
    }
    default:
      throw new Error('Acción desconocida: ' + action)
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}

function doPost(e) {
  var lock = LockService.getScriptLock()
  try {
    lock.waitLock(20000)
    var body = JSON.parse(e.postData.contents)
    var data = handle(body.action, body.payload)
    return json({ ok: true, data: data })
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) })
  } finally {
    try { lock.releaseLock() } catch (e2) {}
  }
}

function doGet() {
  return json({ ok: true, data: 'Facturador CO backend activo' })
}
