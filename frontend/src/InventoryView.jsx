import React, { useState, useRef } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import { createProductApi, deleteProductApi, bulkImportProductsApi } from './api';

function parseCSV(text) {
  const lines = [];
  let row = [''];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      if (row.length > 1 || row[0] !== '') {
        lines.push(row);
      }
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  return lines;
}

export default function InventoryView({ userRole, products, onAddProduct, onDeleteProduct, onAdjustStock, onBulkImport, onReload }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);

  // Bulk Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [defaultCategory, setDefaultCategory] = useState('Building');
  const [defaultLocation, setDefaultLocation] = useState('Main Store');
  const fileInputRef = useRef(null);

  const [newProduct, setNewProduct] = useState({
    name: '', sku: '', barcode: '', category: 'Building', cost_price: '', selling_price: '', stock_quantity: '', minimum_stock: 5, location: 'A1-S1-B1'
  });

  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('DAMAGE');

  const filteredProducts = (products || []).filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm)) ||
    (p.category_id && p.category_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStockBadge = (qty, min) => {
    if (qty === 0) return <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded">OUT OF STOCK</span>;
    if (qty <= min) return <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded">LOW STOCK</span>;
    return <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded">IN STOCK</span>;
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const created = {
      ...newProduct,
      id: `prod-${Date.now()}`,
      cost_price: parseFloat(newProduct.cost_price) || 0,
      selling_price: parseFloat(newProduct.selling_price) || 0,
      stock_quantity: parseInt(newProduct.stock_quantity) || 0,
      minimum_stock: parseInt(newProduct.minimum_stock) || 5
    };
    
    if (onAddProduct) {
      onAddProduct(created);
    }
    await createProductApi(created);

    setShowAddModal(false);
    setNewProduct({ name: '', sku: '', barcode: '', category: 'Building', cost_price: '', selling_price: '', stock_quantity: '', minimum_stock: 5, location: 'A1-S1-B1' });
  };

  const handleDeleteProduct = async (prodId) => {
    if (onDeleteProduct) {
      onDeleteProduct(prodId);
    }
    await deleteProductApi(prodId);
    setConfirmDeleteModal(null);
  };

  const handleAdjustStock = (e) => {
    e.preventDefault();
    const change = parseInt(adjustQty) || 0;
    if (onAdjustStock && showAdjustModal) {
      onAdjustStock(showAdjustModal.id, change);
    }
    setShowAdjustModal(null);
    setAdjustQty('');
  };

  // Convert raw 2D row array to product objects
  const processRawRows = (rawRows) => {
    if (!rawRows || rawRows.length < 2) {
      setImportStatus('The file appears to be empty or has no data rows.');
      return;
    }

    const headers = rawRows[0].map(h => String(h || '').trim().toLowerCase());
    const dataRows = rawRows.slice(1);

    const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));

    const skuIdx = findCol(['sku code', 'sku', 'code', 'item code', 'part number']);
    const barcodeIdx = findCol(['barcode', 'upc', 'ean']);
    const nameIdx = findCol(['product name', 'item name', 'name', 'description', 'title']);
    const paintTypeIdx = findCol(['paint type', 'type']);
    const colorIdx = findCol(['color', 'colour']);
    const sizeIdx = findCol(['size', 'unit size', 'volume']);
    const categoryIdx = findCol(['category', 'cat', 'dept', 'department']);
    const stockIdx = findCol(['stock available', 'stock', 'quantity', 'qty', 'physical', 'balance']);
    const costIdx = findCol(['cost price', 'cost', 'buying price', 'purchase price']);
    const sellIdx = findCol(['selling price', 'selling', 'price', 'retail']);
    const alertIdx = findCol(['stock alert', 'minimum stock', 'min stock', 'alert', 'reorder']);
    const locIdx = findCol(['location', 'storage', 'shelf', 'bin', 'aisle']);

    const items = [];
    dataRows.forEach((r, idx) => {
      if (!r || r.length === 0 || !r.some(v => v !== null && v !== '')) return;

      const sku = skuIdx !== -1 && r[skuIdx] ? String(r[skuIdx]).trim() : `SKU-${Date.now().toString().slice(-4)}-${idx + 1}`;
      const barcode = barcodeIdx !== -1 && r[barcodeIdx] ? String(r[barcodeIdx]).trim() : null;

      let name = '';
      if (nameIdx !== -1 && r[nameIdx]) {
        name = String(r[nameIdx]).trim();
      } else {
        const pType = paintTypeIdx !== -1 && r[paintTypeIdx] ? String(r[paintTypeIdx]).trim() : '';
        const pColor = colorIdx !== -1 && r[colorIdx] ? String(r[colorIdx]).trim() : '';
        const pSize = sizeIdx !== -1 && r[sizeIdx] ? String(r[sizeIdx]).trim() : '';
        const parts = [pType, pColor, pSize ? `(${pSize})` : ''].filter(Boolean);
        name = parts.join(' ').trim() || sku;
      }

      const category = categoryIdx !== -1 && r[categoryIdx] ? String(r[categoryIdx]).trim() : defaultCategory;
      const unit = sizeIdx !== -1 && r[sizeIdx] ? String(r[sizeIdx]).trim() : 'pcs';
      const location = locIdx !== -1 && r[locIdx] ? String(r[locIdx]).trim() : defaultLocation;

      const cost = costIdx !== -1 && r[costIdx] !== undefined && r[costIdx] !== null
        ? parseFloat(String(r[costIdx]).replace(/[^0-9.]/g, '')) || 0 : 0;
      const sell = sellIdx !== -1 && r[sellIdx] !== undefined && r[sellIdx] !== null
        ? parseFloat(String(r[sellIdx]).replace(/[^0-9.]/g, '')) || 0 : 0;
      const stock = stockIdx !== -1 && r[stockIdx] !== undefined && r[stockIdx] !== null
        ? parseInt(String(r[stockIdx]).replace(/[^0-9]/g, '')) || 0 : 0;
      const minStock = alertIdx !== -1 && r[alertIdx] !== undefined && r[alertIdx] !== null
        ? parseInt(String(r[alertIdx]).replace(/[^0-9]/g, '')) || 5 : 5;

      items.push({
        id: `prod-bulk-${Date.now()}-${idx}`,
        sku,
        barcode,
        name,
        category_id: category,
        category,
        unit,
        cost_price: cost,
        selling_price: sell,
        stock_quantity: stock,
        minimum_stock: minStock,
        storage_location_id: location,
        location,
        active: true
      });
    });

    setParsedRows(items);
    setImportStatus(`Successfully parsed ${items.length} items. Review below and confirm.`);
  };

  // Handle Excel or CSV file selection
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setImportStatus('Reading file...');

    try {
      if (file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const text = evt.target.result;
            const rows = parseCSV(text);
            processRawRows(rows);
          } catch (err) {
            setImportStatus(`Failed to read CSV: ${err.message}`);
          }
        };
        reader.readAsText(file);
      } else {
        // Read .xlsx / .xls using read-excel-file
        const rows = await readXlsxFile(file);
        processRawRows(rows);
      }
    } catch (err) {
      console.error('File parse error:', err);
      setImportStatus(`Failed to read spreadsheet: ${err.message}`);
    }
  };

  // Submit Bulk Import to Backend & Local State
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    setImportStatus(`Importing ${parsedRows.length} items to database...`);

    // Ensure fallback defaults are applied if user changed them in modal
    const finalRows = parsedRows.map(item => ({
      ...item,
      category_id: item.category_id || defaultCategory,
      storage_location_id: item.storage_location_id || defaultLocation
    }));

    const res = await bulkImportProductsApi(finalRows);
    setIsImporting(false);

    if (res) {
      setImportStatus(`✅ Successfully imported ${finalRows.length} products to database!`);
      if (onBulkImport) onBulkImport(res.data || finalRows);
      if (onReload) onReload();
      setTimeout(() => {
        setShowImportModal(false);
        setParsedRows([]);
        setFileName('');
        setImportStatus('');
      }, 1400);
    } else {
      // Backend offline or error: Genuine local fallback
      setImportStatus(`⚠️ Backend offline. Successfully added ${finalRows.length} products to local session!`);
      if (onBulkImport) onBulkImport(finalRows);
      setTimeout(() => {
        setShowImportModal(false);
        setParsedRows([]);
        setFileName('');
        setImportStatus('');
      }, 1800);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative w-full sm:w-96">
          <input 
            type="text" 
            placeholder="Search by name, SKU, barcode, category... (/)" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {userRole !== 'VIEWER' && (
            <>
              <button 
                onClick={() => setShowImportModal(true)}
                className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold px-3 py-1.5 rounded text-sm transition shadow-sm flex items-center space-x-1.5"
              >
                <span>📥</span>
                <span>Bulk Import (Excel/CSV)</span>
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-3 py-1.5 rounded text-sm transition shadow-sm"
              >
                + Add Single Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-gray-700 text-xs uppercase border-b">
              <tr>
                <th className="py-3 px-4">Item & SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Cost Price (UGX)</th>
                <th className="py-3 px-4">Selling Price (UGX)</th>
                <th className="py-3 px-4">Stock Level</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Status</th>
                {userRole !== 'VIEWER' && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-gray-400 text-xs">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-400 font-mono">SKU: {p.sku} | Barcode: {p.barcode || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{p.category_id || p.category || 'General'}</td>
                    <td className="py-3 px-4 text-gray-600">UGX {(p.cost_price || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">UGX {(p.selling_price || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 font-semibold">{p.stock_quantity} {p.unit || 'pcs'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{p.storage_location_id || p.location || 'Store'}</td>
                    <td className="py-3 px-4">{getStockBadge(p.stock_quantity, p.minimum_stock)}</td>
                    {userRole !== 'VIEWER' && (
                      <td className="py-3 px-4 text-right space-x-1">
                        <button 
                          onClick={() => setShowAdjustModal(p)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded"
                        >
                          Adjust
                        </button>
                        {(userRole === 'ADMIN' || userRole === 'STOREKEEPER') && (
                          <button 
                            onClick={() => setConfirmDeleteModal(p)}
                            className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-2 py-1 rounded border border-red-200"
                            title="Delete Product"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">📥 Bulk Import Products (Excel / CSV)</h3>
                <p className="text-xs text-gray-500">Upload product sheets from suppliers, distributors, or inventory taking.</p>
              </div>
              <button 
                onClick={() => { setShowImportModal(false); setParsedRows([]); setFileName(''); setImportStatus(''); }}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* File Selector & Defaults */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select File (.xlsx, .xls, .csv)</label>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".xlsx,.xls,.csv" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-1.5 px-3 rounded text-xs transition truncate"
                >
                  {fileName ? `📄 ${fileName}` : 'Choose File...'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Default Category (if blank)</label>
                <input 
                  type="text" 
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value)}
                  placeholder="e.g. Building, Paint, Electrical"
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Default Location (if blank)</label>
                <input 
                  type="text" 
                  value={defaultLocation}
                  onChange={(e) => setDefaultLocation(e.target.value)}
                  placeholder="e.g. Main Store, A1-S1-B1"
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white"
                />
              </div>
            </div>

            {importStatus && (
              <div className={`p-2.5 rounded text-xs font-medium ${
                importStatus.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
                importStatus.includes('⚠️') ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                'bg-blue-50 text-blue-800 border border-blue-200'
              }`}>
                {importStatus}
              </div>
            )}

            {/* Parsed Rows Preview */}
            {parsedRows.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                  <span>Preview ({parsedRows.length} items ready to import):</span>
                  <span className="text-gray-400 font-normal">Columns: SKU, Name, Category, Stock, Cost, Selling</span>
                </div>
                <div className="border rounded overflow-y-auto max-h-56 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-gray-100 text-gray-600 sticky top-0 border-b">
                      <tr>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Product Name</th>
                        <th className="p-2">Category</th>
                        <th className="p-2">Stock</th>
                        <th className="p-2">Cost (UGX)</th>
                        <th className="p-2">Selling (UGX)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {parsedRows.slice(0, 15).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="p-2 font-bold text-slate-800">{row.sku}</td>
                          <td className="p-2 font-sans">{row.name}</td>
                          <td className="p-2 text-gray-500 font-sans">{row.category_id}</td>
                          <td className="p-2 font-bold text-amber-600">{row.stock_quantity} {row.unit}</td>
                          <td className="p-2">{(row.cost_price || 0).toLocaleString()}</td>
                          <td className="p-2 font-bold">{(row.selling_price || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 15 && (
                    <div className="p-2 text-center text-xs text-gray-400 bg-gray-50">
                      ...and {parsedRows.length - 15} more items
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => { setShowImportModal(false); setParsedRows([]); setFileName(''); setImportStatus(''); }} 
                className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded font-medium"
              >
                Cancel
              </button>
              <button 
                type="button" 
                disabled={parsedRows.length === 0 || isImporting}
                onClick={handleConfirmImport} 
                className={`px-5 py-2 text-xs font-bold rounded shadow transition ${
                  parsedRows.length === 0 || isImporting 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-900'
                }`}
              >
                {isImporting ? 'Importing Products...' : `Confirm & Import ${parsedRows.length} Products`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-gray-800 text-base">Add New Hardware Product</h3>
            <form onSubmit={handleAddProduct} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name</label>
                <input required type="text" placeholder="e.g. Weather Guard Cream 20L" className="w-full border rounded px-3 py-1.5" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">SKU</label>
                  <input required type="text" placeholder="WGC-20L" className="w-full border rounded px-3 py-1.5" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Barcode (Optional)</label>
                  <input type="text" placeholder="890..." className="w-full border rounded px-3 py-1.5" value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cost Price (UGX)</label>
                  <input required type="number" placeholder="360000" className="w-full border rounded px-3 py-1.5" value={newProduct.cost_price} onChange={e => setNewProduct({...newProduct, cost_price: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Selling Price (UGX)</label>
                  <input required type="number" placeholder="380000" className="w-full border rounded px-3 py-1.5" value={newProduct.selling_price} onChange={e => setNewProduct({...newProduct, selling_price: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Initial Stock Qty</label>
                  <input required type="number" placeholder="5" className="w-full border rounded px-3 py-1.5" value={newProduct.stock_quantity} onChange={e => setNewProduct({...newProduct, stock_quantity: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Storage Location</label>
                  <input type="text" placeholder="Paint Section" className="w-full border rounded px-3 py-1.5" value={newProduct.location} onChange={e => setNewProduct({...newProduct, location: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-gray-800 text-base">Adjust Stock: {showAdjustModal.name}</h3>
            <p className="text-xs text-gray-500">Current Stock: <strong>{showAdjustModal.stock_quantity} {showAdjustModal.unit || 'pcs'}</strong></p>
            <form onSubmit={handleAdjustStock} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity Change (e.g. +5 or -2)</label>
                <input required type="number" placeholder="+/- Qty" className="w-full border rounded px-3 py-1.5" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reason</label>
                <select className="w-full border rounded px-3 py-1.5" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}>
                  <option value="DAMAGE">Damaged Goods</option>
                  <option value="LOSS">Loss / Missing</option>
                  <option value="THEFT">Theft</option>
                  <option value="CORRECTION">Inventory Count Correction</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAdjustModal(null)} className="px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded">Apply Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {confirmDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-5 space-y-3 shadow-xl">
            <h3 className="font-bold text-gray-900 text-base">Delete Product?</h3>
            <p className="text-xs text-gray-600">
              Are you sure you want to remove <strong>{confirmDeleteModal.name}</strong> (SKU: {confirmDeleteModal.sku})?
            </p>
            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button 
                type="button" 
                onClick={() => setConfirmDeleteModal(null)} 
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => handleDeleteProduct(confirmDeleteModal.id)} 
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-bold rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
