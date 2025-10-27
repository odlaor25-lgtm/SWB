// ===== SWBernhardt: Web App with runtime schema validation =====
const SPREADSHEET_ID = '1jBkjkJVHVbtjAjOzSVaMSen8p_dgUGomF211MatPYK0';
const ALLOWED_SHEETS = ["MillBills", "Customers", "Products", "Loads", "Labor", "Bills", "Office", "Employees"];
const SERVER_SCHEMA_HASH = '875c62445908b4830afc1a0911c78b58749840b4af2bf8718ceb26a19edbf975';

function _getHeaders(sh) {
  const lastCol = sh.getLastColumn();
  if (!lastCol) return [];
  return sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h));
}

function _json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const ct = (e.postData && e.postData.type) || '';
    const payload = ct.indexOf('application/json') !== -1
      ? JSON.parse(e.postData.contents || '{}')
      : e.parameter || {};

    const requiredSecret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (requiredSecret && payload.SECRET !== requiredSecret) throw new Error('Unauthorized');

    const sheetName = String(payload.sheet || '').trim();
    if (!ALLOWED_SHEETS.includes(sheetName)) throw new Error('Invalid sheet.');

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName(sheetName);
    if (!sh) throw new Error('Sheet not found.');

    const headers = _getHeaders(sh);
    if (!headers.length) throw new Error('No headers in row 1.');

    const fields = payload.fields || {};
    if (typeof fields !== 'object' || Array.isArray(fields)) throw new Error('Invalid fields payload.');

    const allowable = new Set(headers.filter(h => h && h !== 'Timestamp'));
    const incomingKeys = Object.keys(fields);

    const unknown = incomingKeys.filter(k => !allowable.has(k));
    if (unknown.length) throw new Error('Unknown columns: ' + unknown.join(', '));

    const hasValue = incomingKeys.some(k => String(fields[k]).trim().length > 0);
    if (!hasValue) throw new Error('Empty payload.');

    if (payload.schemaHash && payload.schemaHash !== SERVER_SCHEMA_HASH) {
      throw new Error('Client schema mismatch.');
    }

    const row = headers.map(h => (h === 'Timestamp') ? new Date() : (h in fields ? String(fields[h]).trim() : ''));
    sh.appendRow(row);
    const newRow = sh.getLastRow();

    return _json({ ok: true, row: newRow, sheet: sheetName });
  } catch (err) {
    return _json({ ok: false, error: err.message });
  }
}
