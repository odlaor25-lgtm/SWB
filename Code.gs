
/**
 * SW.BERNHARDT RENTAL ENGINE - BACKEND KERNEL
 * Automated Property Management System
 */

// Default Spreadsheet ID (Update this to your own spreadsheet ID)
const DEFAULT_SPREADSHEET_ID = '1iezAQfEZ2WHmN__67pIPsjY1xR1kwpV-bqwaEpE7Ja0';

function getSpreadsheet() {
  try {
    // Attempt to use the ID specified in the constants
    return SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
  } catch (e) {
    // Fallback to the spreadsheet the script is attached to, if applicable
    try {
      return SpreadsheetApp.getActiveSpreadsheet();
    } catch (e2) {
      throw new Error("UNABLE_TO_ACCESS_SPREADSHEET: Check Spreadsheet ID and Permissions.");
    }
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss = getSpreadsheet();
    
    if (action === 'getData') {
      const data = {
        rooms: getSheetData(ss, 'Rooms'),
        tenants: getSheetData(ss, 'Tenants'),
        invoices: getSheetData(ss, 'Invoices'),
        tasks: getSheetData(ss, 'Tasks'),
        bookings: getSheetData(ss, 'Bookings')
      };
      return createJsonResponse(data);
    }
    
    return createJsonResponse({ error: 'INVALID_ACTION' });
  } catch (err) {
    return createJsonResponse({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const ss = getSpreadsheet();
    
    if (action === 'addBooking') {
      let sheet = ss.getSheetByName('Bookings');
      if (!sheet) {
        sheet = ss.insertSheet('Bookings');
        sheet.appendRow(['id', 'roomNumber', 'tenantName', 'phone', 'bookingDate', 'moveInDate', 'status']);
      }
      sheet.appendRow([
        params.data.id,
        params.data.roomNumber,
        params.data.tenantName,
        params.data.phone,
        params.data.bookingDate,
        params.data.moveInDate,
        params.data.status
      ]);
      return createJsonResponse({ status: 'success' });
    }

    if (action === 'updateBooking') {
      const sheet = ss.getSheetByName('Bookings');
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const idIdx = headers.indexOf('id');
      const statusIdx = headers.indexOf('status');
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][idIdx] === params.data.id) {
          sheet.getRange(i + 1, statusIdx + 1).setValue(params.data.status);
          break;
        }
      }
      return createJsonResponse({ status: 'success' });
    }

    if (action === 'addInvoice') {
      let sheet = ss.getSheetByName('Invoices');
      if (!sheet) {
        sheet = ss.insertSheet('Invoices');
        sheet.appendRow(['id', 'roomNumber', 'month', 'date', 'amount', 'status']);
      }
      sheet.appendRow([
        params.data.id,
        params.data.roomNumber,
        params.data.month,
        params.data.date,
        params.data.amount,
        params.data.status
      ]);
      return createJsonResponse({ status: 'success' });
    }
    
    if (action === 'updateTenant') {
      const sheet = ss.getSheetByName('Tenants');
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === params.data.id) {
          sheet.getRange(i + 1, 1, 1, 10).setValues([[
            params.data.id,
            params.data.name,
            params.data.roomNumber,
            params.data.phone,
            params.data.entryDate,
            params.data.status,
            params.data.emergencyName,
            params.data.emergencyPhone,
            params.data.contractPeriod,
            params.data.depositAmount
          ]]);
          break;
        }
      }
      return createJsonResponse({ status: 'success' });
    }
    
    return createJsonResponse({ error: 'ACTION_NOT_FOUND' });
  } catch (err) {
    return createJsonResponse({ error: err.toString() });
  }
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return []; // Only headers or empty
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
