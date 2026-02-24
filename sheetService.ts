
/**
 * Google Apps Script Web App URL for SW.BERNHARDT RENTAL ENGINE
 * IMPORTANT: Ensure the script is deployed as a Web App with "Execute as: Me" and "Who has access: Anyone".
 */
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxgs-ahcijwuWDC0Y3npLdshORkrdZ7esIRuN3qm9e5jZEaVNvWZEtIqqbyYQCgqg8M/exec';

const getScriptUrl = () => {
  const url = localStorage.getItem('scriptUrl') || DEFAULT_SCRIPT_URL;
  return url.trim();
};

/**
 * Fetches the complete dataset from the Google Sheets kernel.
 * Optimized for Google Apps Script CORS behavior and redirect handling.
 */
export const fetchSheetData = async () => {
  const baseUrl = getScriptUrl();
  
  if (!baseUrl || !baseUrl.startsWith('https://script.google.com')) {
    throw new Error('INVALID_URL: Please provide a valid Google Apps Script Web App URL.');
  }

  // Use URL object for robust parameter appending
  const url = new URL(baseUrl);
  url.searchParams.set('action', 'getData');
  url.searchParams.set('_t', Date.now().toString()); // Cache buster to prevent stale browser caches

  try {
    // Note: mode 'cors' and redirect 'follow' are critical for GAS GET requests.
    // If you see 'Load failed', it's usually because the script is not deployed as 'Anyone'.
    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP_ERROR_${response.status}: Server responded with non-200 status.`);
    }

    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      throw new Error('MALFORMED_DATA: Received invalid JSON from the kernel.');
    }
    
    // Success: Cache data locally for offline fallback
    localStorage.setItem('kernel_cache', JSON.stringify(data));
    localStorage.setItem('kernel_last_sync', new Date().toISOString());
    
    return data;
  } catch (error: any) {
    console.error('Kernel fetch failed:', error);
    
    // Check for cached data fallback if network fails
    const cached = localStorage.getItem('kernel_cache');
    if (cached) {
      console.warn('Network error. Falling back to cached data.');
      return JSON.parse(cached);
    }
    
    // Distinguish between network/CORS issues and logic issues
    const message = error.message || 'Unknown network error';
    if (message.includes('fetch') || message.includes('Failed to fetch')) {
      throw new Error('CORS_OR_NETWORK_ERROR: The kernel is unreachable. Ensure the GAS Web App is deployed as "Anyone".');
    }
    throw new Error('LOAD_FAILED: ' + message);
  }
};

/**
 * Submits a new booking request to the kernel.
 */
export const createBooking = async (booking: any) => {
  const url = getScriptUrl();
  try {
    // mode: 'no-cors' is often needed for POST to GAS to avoid preflight issues,
    // although it prevents reading the response.
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'addBooking', data: booking })
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Booking Transmission Error:', error);
    return { status: 'error' };
  }
};

/**
 * Updates a booking's status in the kernel.
 */
export const updateBookingStatus = async (bookingId: string, status: string) => {
  const url = getScriptUrl();
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'updateBooking', data: { id: bookingId, status } })
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Booking Update Error:', error);
    return { status: 'error' };
  }
};

/**
 * Synchronizes an invoice record to the backend.
 */
export const syncInvoiceToSheet = async (invoice: any) => {
  const url = getScriptUrl();
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'addInvoice', data: invoice })
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Invoice Sync Error:', error);
    return { status: 'error' };
  }
};

/**
 * Updates an existing tenant's profile in the database.
 */
export const updateTenantInSheet = async (tenant: any) => {
  const url = getScriptUrl();
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'updateTenant', data: tenant })
    });
    return { status: 'success' };
  } catch (error) {
    console.error('Tenant Update Error:', error);
    return { status: 'error' };
  }
};
