import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createProductApi, deleteProductApi, bulkImportProductsApi } from './api';

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

  // Handle Excel / CSV File Selection
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setImportStatus('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rawJson || rawJson.length < 2) {
          setImportStatus('The file appears to be empty or has no data rows.');
          return;
        }

        const headers = rawJson[0].map(h => String(h || '').trim().toLowerCase());
        const dataRows = rawJson.slice(1);

        // Find column indices
        const findCol = (keywords) => {
          return headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase())));
        };

        const skuIdx = findCol(['sku code', 'sku', 'code', 'item code']);
        const barcodeIdx = findCol(['barcode', 'upc', 'ean']);
        const nameIdx = findCol(['product name', 'item name', 'name', 'description']);
        const paintTypeIdx = findCol(['paint type', 'type']);
        const colorIdx = findCol(['color', 'colour']);
        const sizeIdx = findCol(['size', 'unit size', 'volume']);
        const categoryIdx = findCol(['category', 'cat', 'dept']);
        const stockIdx = findCol(['stock available', 'stock', 'quantity', 'qty', 'physical']);
        const costIdx = findCol(['cost price', 'cost', 'buying price']);
        const sellIdx = findCol(['selling price', 'selling', 'price', 'retail']);
        const alertIdx = findCol(['stock alert', 'minimum stock', 'min stock', 'alert']);

        const items = [];
        dataRows.forEach((r, idx) => {
          if (!r || r.length === 0 || !r.some(v => v !== null && v !== '')) return;

          const sku = skuIdx !== -1 && r[skuIdx] ? String(r[skuIdx]).trim() : `SKU-${idx + 1}`;
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

          const category = categoryIdx !== -1 && r[categoryIdx] ? String(r[categoryIdx]).trim() : 'Paint and Finishings';
          const unit = sizeIdx !== -1 && r[sizeIdx] ? String(r[sizeIdx]).trim() : 'pcs';
          
          const cost = costIdx !== -1 && r[costIdx] ? parseFloat(String(r[costIdx]).replace(/[^0-9.]/g, '')) || 0 : 0;
          const sell = sellIdx !== -1 && r[sellIdx] ? parseFloat(String(r[sellIdx]).replace(/[^0-9.]/g, '')) || 0 : 0;
          const stock = stockIdx !== -1 && r[stockIdx] !== undefined && r[stockIdx] !== '' ? parseInt(String(r[stockIdx]).replace(/[^0-9]/g, '')) || 0 : 0;
          const minStock = alertIdx !== -1 && r[alertIdx] !== undefined && r[alertIdx] !== '' ? parseInt(String(r[alertIdx]).replace(/[^0-9]/g, '')) || 5 : 5;

          items.push({
            sku,
            barcode,
            name,
            category_id: category,
            unit,
            cost_price: cost,
            selling_price: sell,
            stock_quantity: stock,
            minimum_stock: minStock,
            storage_location_id: 'Paint Section',
            active: true
          });
        });

        setParsedRows(items);
        setImportStatus(`Parsed ${items.length} items from spreadsheet ready for import.`);
      } catch (err) {
        console.error('Error parsing excel:', err);
        setImportStatus(`Failed to read file: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit Bulk Import to Backend & Supabase
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    setImportStatus(`Importing ${parsedRows.length} items to database...`);

    const res = await bulkImportProductsApi(parsedRows);
    setIsImporting(false);

    if (res) {
      setImportStatus(`✅ Successfully imported ${parsedRows.length} items!`);
      if (onBulkImport) onBulkImport(parsedRows);
      if (onReload) onReload();
      setTimeout(() => {
        setShowImportModal(false);
        setParsedRows([]);
        setFileName('');
        setImportStatus('');
      }, 1500);
    } else {
      setImportStatus('⚠️ Server error during import. Saved items locally.');
      if (onBulkImport) onBulkImport(parsedRows);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="relative w-full sm:w-96">
          <input 
            type="text" 
            placeholder="Search by name, SKU, barcode, category... (e.g. Weather Guard, Cream)" 
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
                <span>Bulk Import Spreadsheet</span>
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

      {/* Products Stats Overview */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>Showing <strong>{filteredProducts.length}</strong> of <strong>{(products || []).length}</strong> total products</span>
        <button onClick={onReload} className="text-amber-600 hover:text-amber-700 font-semibold">🔄 Refresh List</button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-gray-700 text-xs uppercase border-b sticky top-0 z-10">
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
                    No products found matching your search. Try adjusting the filter or click "Bulk Import Spreadsheet".
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => (
                  <tr key={p.id || p.sku} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-400 font-mono">SKU: {p.sku} | Barcode: {p.barcode || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{p.category_id || p.category}</td>
                    <td className="py-3 px-4 text-gray-600">UGX {(p.cost_price || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">UGX {(p.selling_price || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 font-semibold">{p.stock_quantity} {p.unit || 'pcs'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">{p.storage_location_id || p.location || 'Paint Section'}</td>
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
                            title="Delete / Remove Product"
                          >
                            🗑 Delete
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

      {/* Bulk Import Spreadsheet Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">📥 Bulk Inventory Spreadsheet Import</h3>
                <p className="text-xs text-gray-500">Upload Excel (.xlsx, .xls) or CSV file with your product catalog and initial inventory.</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-gray-300 hover:border-amber-500 bg-gray-50 p-6 rounded-lg text-center cursor-pointer transition"
                 onClick={() => fileInputRef.current && fileInputRef.current.click()}>
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
              <div className="text-3xl mb-2">📊</div>
              <p className="text-sm font-semibold text-gray-700">
                {fileName ? `Selected: ${fileName}` : "Click to browse or drop your Excel / CSV file here"}
              </p>
              <p className="text-xs text-gray-400 mt-1">Supports Paint Inventory files, standard stock sheets with SKU, Name, Type, Color, Size, Stock, Cost, Selling Price</p>
            </div>

            {importStatus && (
              <div className={`p-3 rounded text-xs font-semibold ${importStatus.includes('✅') ? 'bg-green-50 text-green-800 border border-green-200' : importStatus.includes('⚠️') ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
                {importStatus}
              </div>
            )}

            {/* Parsed Rows Preview */}
            {parsedRows.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                  <span>Preview ({parsedRows.length} items ready to import):</span>
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
                          <td className="p-2">{row.name}</td>
                          <td className="p-2 text-gray-500">{row.category_id}</td>
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
                onClick={() => { setShowImportModal(false); setParsedRows([]); setFileName(''); }} 
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
                {isImporting ? 'Importing to Supabase...' : `Confirm & Import ${parsedRows.length} Products`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2">Add New Product (UGX)</h3>
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
                  <input type="text" placeholder="Scan or enter" className="w-full border rounded px-3 py-1.5" value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cost Price (UGX)</label>
                  <input required type="number" placeholder="369500" className="w-full border rounded px-3 py-1.5" value={newProduct.cost_price} onChange={e => setNewProduct({...newProduct, cost_price: e.target.value})} />
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
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-900 rounded">Save & Add to Sales</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-5 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-red-600 border-b pb-2">Delete Product</h3>
            <p className="text-xs text-gray-600">
              Are you sure you want to remove <strong>{confirmDeleteModal.name}</strong> ({confirmDeleteModal.sku})? It will no longer appear in the POS sales screen or inventory list.
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
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Adjust Modal */}
      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 border-b pb-2">Quick Stock Adjust: {showAdjustModal.name}</h3>
            <form onSubmit={handleAdjustStock} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Current Stock</label>
                <div className="font-bold text-lg">{showAdjustModal.stock_quantity} {showAdjustModal.unit || 'pcs'}</div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Adjustment Quantity (+ / -)</label>
                <input required type="number" placeholder="e.g. -2 or +10" className="w-full border rounded px-3 py-1.5" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reason</label>
                <select className="w-full border rounded px-3 py-1.5" value={adjustReason} onChange={e => setAdjustReason(e.target.value)}>
                  <option value="DAMAGE">Damage / Broken</option>
                  <option value="EXPIRED">Defective</option>
                  <option value="AUDIT">Stock Count Variance</option>
                  <option value="RETURN">Customer Return</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAdjustModal(null)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-900 rounded">Apply Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
