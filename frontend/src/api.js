const API_BASE = 'http://127.0.0.1:8000';

export async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE}/products/`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Backend offline, using local state:', err);
    return null;
  }
}

export async function createProductApi(product) {
  try {
    const res = await fetch(`${API_BASE}/products/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    return await res.json();
  } catch (err) {
    console.warn('Backend offline, saved locally:', err);
    return null;
  }
}

export async function bulkImportProductsApi(products) {
  try {
    const res = await fetch(`${API_BASE}/products/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(products)
    });
    if (!res.ok) throw new Error('Bulk import failed');
    return await res.json();
  } catch (err) {
    console.warn('Backend bulk import error:', err);
    return null;
  }
}

export async function deleteProductApi(productId) {
  try {
    const res = await fetch(`${API_BASE}/products/${productId}`, {
      method: 'DELETE'
    });
    return await res.json();
  } catch (err) {
    console.warn('Backend offline, deleted locally:', err);
    return null;
  }
}

export async function processSaleApi(sale) {
  try {
    const res = await fetch(`${API_BASE}/sales/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale)
    });
    return await res.json();
  } catch (err) {
    console.warn('Backend offline, processed locally:', err);
    return null;
  }
}

export async function fetchDebtorsApi() {
  try {
    const res = await fetch(`${API_BASE}/ledger/debtors`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchCreditorsApi() {
  try {
    const res = await fetch(`${API_BASE}/ledger/creditors`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function addLedgerEntryApi(entry) {
  try {
    const res = await fetch(`${API_BASE}/ledger/entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function recordLedgerPaymentApi(payment) {
  try {
    const res = await fetch(`${API_BASE}/ledger/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment)
    });
    return await res.json();
  } catch (err) {
    return null;
  }
}
