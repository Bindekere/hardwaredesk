import React, { useState, useEffect, useRef } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import { submitStockTakeApi } from './api';

const VARIANCE_THRESHOLD = 5; // require manager approval if abs variance >= this

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

export default function StockTakeView({ userRole, products, onStockTakeFinalize, onReload }) {
  const [counts, setCounts] = useState([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [submittedResult, setSubmittedResult] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState({}); // { idx: 'APPROVED'|'REJECTED' }
  const [approvalNote, setApprovalNote] = useState({});     // { idx: noteText }
  const [finalized, setFinalized] = useState(false);
  const [excelUploadedCount, setExcelUploadedCount] = useState(0);
  const [includeUncountedAsZero, setIncludeUncountedAsZero] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

  const fileInputRef = useRef(null);

  // Initialize stock count items from live products catalog
  useEffect(() => {
    if (products && products.length > 0) {
      setCounts(products.map(p => ({
        id: p.id || p.sku,
        sku: p.sku,
        name: p.name,
        category: p.category_id || p.category || 'General',
        location: p.storage_location_id || p.location || 'Main Store',
        system: p.stock_quantity || 0,
        unit: p.unit || 'pcs',
        physical: ''
      })));
    }
  }, [products]);

  // Filter counts by query
  const displayedCounts = counts.filter(c => 
    (c.name || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (c.sku || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (c.category || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  const totalCounted = counts.filter(c => c.physical !== '' && !isNaN(parseInt(c.physical))).length;

  // Process rows from uploaded count sheet (CSV or XLSX)
  const processCountRows = (rawRows) => {
    if (!rawRows || rawRows.length < 2) return;

    const headers = rawRows[0].map(h => String(h || '').trim().toLowerCase());
    const dataRows = rawRows.slice(1);

    const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('code') || h.includes('part'));
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('item') || h.includes('description'));
    const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('count') || h.includes('physical') || h.includes('qty') || h.includes('available'));

    if (stockIdx === -1) {
      alert('Could not find a count / quantity column in the uploaded sheet.');
      return;
    }

    let matched = 0;
    setCounts(prevCounts => {
      return prevCounts.map(item => {
        const foundRow = dataRows.find(r => {
          if (skuIdx !== -1 && r[skuIdx] && String(r[skuIdx]).trim().toLowerCase() === item.sku.toLowerCase()) return true;
          if (nameIdx !== -1 && r[nameIdx] && String(r[nameIdx]).trim().toLowerCase() === item.name.toLowerCase()) return true;
          return false;
        });

        if (foundRow && foundRow[stockIdx] !== undefined && foundRow[stockIdx] !== null && foundRow[stockIdx] !== '') {
          matched++;
          const parsedVal = parseInt(String(foundRow[stockIdx]).replace(/[^0-9]/g, '')) || 0;
          return { ...item, physical: parsedVal };
        }
        return item;
      });
    });

    setExcelUploadedCount(matched);
  };

  // Handle Count Sheet file selection
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const text = evt.target.result;
            const rows = parseCSV(text);
            processCountRows(rows);
          } catch (err) {
            console.error('Error reading CSV:', err);
          }
        };
        reader.readAsText(file);
      } else {
        const rows = await readXlsxFile(file);
        processCountRows(rows);
      }
    } catch (err) {
      console.error('Error reading stock take file:', err);
    }
  };

  const handleSubmit = () => {
    // Determine which items to audit
    const itemsToAudit = includeUncountedAsZero 
      ? counts 
      : counts.filter(c => c.physical !== '' && !isNaN(parseInt(c.physical)));

    if (itemsToAudit.length === 0) {
      alert('Please enter a physical count for at least one product before submitting.');
      return;
    }

    const results = itemsToAudit.map(item => {
      const system = item.system || 0;
      const physical = item.physical !== '' && !isNaN(parseInt(item.physical)) ? parseInt(item.physical) : 0;
      const variance = physical - system;
      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        location: item.location,
        system,
        physical,
        unit: item.unit,
        variance,
        needsApproval: Math.abs(variance) >= VARIANCE_THRESHOLD
      };
    });

    setSubmittedResult(results);
    setApprovalStatus({});
    setApprovalNote({});
    setFinalized(false);
    setFinalizeError('');
  };

  const handleApprove = (idx, status) => {
    setApprovalStatus(prev => ({ ...prev, [idx]: status }));
  };

  const handleApproveAll = () => {
    const newStatuses = {};
    submittedResult.forEach((res, idx) => {
      if (res.needsApproval) {
        newStatuses[idx] = 'APPROVED';
      }
    });
    setApprovalStatus(prev => ({ ...prev, ...newStatuses }));
  };

  const pendingApprovalsCount = submittedResult ? submittedResult.filter((res, idx) => res.needsApproval && !approvalStatus[idx]).length : 0;
  const canFinalize = userRole === 'ADMIN' || pendingApprovalsCount === 0;

  const handleFinalize = async () => {
    if (!submittedResult) return;

    if (!canFinalize) {
      setFinalizeError(`Cannot finalize: ${pendingApprovalsCount} variance items require Admin/Manager approval.`);
      return;
    }

    setIsSubmitting(true);
    setFinalizeError('');

    // Filter approved adjustments that actually have a non-zero variance
    const approvedAdjustments = submittedResult.filter((res, idx) => {
      const isApproved = !res.needsApproval || approvalStatus[idx] === 'APPROVED';
      return isApproved && res.variance !== 0;
    });

    // Format payload for backend
    const payloadItems = approvedAdjustments.map(res => ({
      product_id: res.id,
      physical_quantity: res.physical,
      system_quantity: res.system,
      variance: res.variance,
      reason: approvalNote[submittedResult.indexOf(res)] || 'Stock Take Adjustment'
    }));

    // Submit to backend API
    const apiRes = await submitStockTakeApi(payloadItems, `Blind Stock Take audited on ${new Date().toLocaleDateString()}`);

    // Update in-memory / React state in App.jsx
    if (onStockTakeFinalize) {
      const updatedProducts = approvedAdjustments.map(res => ({
        id: res.id,
        sku: res.sku,
        stock_quantity: res.physical
      }));
      onStockTakeFinalize(updatedProducts);
    }

    // Trigger background product reload if connected
    if (onReload) {
      onReload();
    }

    setIsSubmitting(false);
    setFinalized(true);
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-800">📋 Blind Stock Take & Physical Inventory Count</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Enter physical counts or upload your count sheet. System quantities remain hidden until submission.
            Variances ≥ {VARIANCE_THRESHOLD} units require manager approval.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {!submittedResult ? (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".xlsx,.xls,.csv" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
              <button 
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="text-xs bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold px-3 py-2 rounded transition flex items-center space-x-1.5 shadow-sm"
              >
                <span>📊</span>
                <span>Upload Count Sheet</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => { setSubmittedResult(null); setFinalized(false); setFinalizeError(''); }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded transition"
            >
              ↩ New Stock Take
            </button>
          )}
        </div>
      </div>

      {excelUploadedCount > 0 && !submittedResult && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between font-semibold">
          <span>✅ Auto-matched {excelUploadedCount} items from your uploaded count sheet! Review counts below and click submit.</span>
          <button onClick={() => setExcelUploadedCount(0)} className="text-blue-600 font-bold">✕</button>
        </div>
      )}

      {!submittedResult ? (
        <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
          {/* Controls bar inside entry */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
            <input 
              type="text" 
              placeholder="Search products in stock take... (e.g. Nails, Cement, IRN)" 
              value={filterQuery} 
              onChange={e => setFilterQuery(e.target.value)} 
              className="w-full sm:w-80 border border-gray-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            
            <div className="flex items-center space-x-4 text-xs">
              <label className="flex items-center space-x-1.5 cursor-pointer text-gray-700">
                <input 
                  type="checkbox"
                  checked={includeUncountedAsZero}
                  onChange={e => setIncludeUncountedAsZero(e.target.checked)}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
                />
                <span>Mark uncounted items as 0 (Full Warehouse Reset)</span>
              </label>
              <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                Counted: <strong>{totalCounted}</strong> / {counts.length}
              </span>
            </div>
          </div>

          {/* Product Counts List */}
          <div className="overflow-y-auto max-h-[500px] border rounded divide-y divide-gray-100">
            {displayedCounts.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No products found matching your search.
              </div>
            ) : (
              displayedCounts.map((item) => {
                const originalIdx = counts.findIndex(c => c.id === item.id);
                return (
                  <div key={item.id} className="flex justify-between items-center p-3 hover:bg-gray-50 text-sm">
                    <div>
                      <div className="font-semibold text-gray-800">{item.name}</div>
                      <div className="text-xs text-gray-400 font-mono">
                        SKU: {item.sku} | 📍 {item.location} | Category: {item.category}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="Physical Qty"
                        value={item.physical !== undefined ? item.physical : ''}
                        onChange={e => {
                          const newCounts = [...counts];
                          if (originalIdx !== -1) {
                            newCounts[originalIdx].physical = e.target.value;
                            setCounts(newCounts);
                          }
                        }}
                        className="w-28 border border-gray-300 rounded px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                      />
                      <span className="text-xs text-gray-500 w-10">{item.unit}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-gray-500">
              {includeUncountedAsZero 
                ? `Will audit all ${counts.length} catalog items (uncounted will adjust to 0).`
                : `Will audit ${totalCounted} counted products. Uncounted items remain unaffected.`}
            </span>
            <button 
              onClick={handleSubmit} 
              disabled={totalCounted === 0 && !includeUncountedAsZero}
              className={`font-bold px-6 py-2.5 rounded text-sm transition shadow ${
                totalCounted === 0 && !includeUncountedAsZero
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 text-slate-900'
              }`}
            >
              Submit Counts & Calculate Variance ({includeUncountedAsZero ? counts.length : totalCounted} Products)
            </button>
          </div>
        </div>
      ) : finalized ? (
        <div className="bg-green-50 border border-green-300 p-8 rounded-lg text-center space-y-3">
          <div className="text-4xl">✅</div>
          <h3 className="font-bold text-green-900 text-lg">Stock Take Finalized & Applied</h3>
          <p className="text-xs text-green-700 max-w-md mx-auto">
            All approved inventory adjustments have been successfully recorded in the system and database.
            Products stock levels are now updated.
          </p>
          <button 
            onClick={() => { 
              setSubmittedResult(null); 
              setFinalized(false); 
              setCounts(counts.map(c => ({ ...c, physical: '' }))); 
            }}
            className="mt-4 bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold px-5 py-2.5 rounded text-xs shadow"
          >
            Start New Stock Take
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="font-bold text-base text-gray-800">Stock Take Variance Audit</h3>
              <p className="text-xs text-gray-500">System quantities vs physical count. High variances require manager review.</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded font-bold">
                🔴 {submittedResult.filter(r => r.needsApproval).length} High Variances
              </span>
              <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded font-bold">
                🟢 {submittedResult.filter(r => !r.needsApproval).length} Auto-Approved / Matched
              </span>
              {userRole === 'ADMIN' && pendingApprovalsCount > 0 && (
                <button 
                  onClick={handleApproveAll}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-2.5 py-1 rounded text-xs transition"
                >
                  ✓ Approve All ({pendingApprovalsCount})
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px] border rounded">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-gray-700 sticky top-0 border-b">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-center">System Qty</th>
                  <th className="py-2.5 px-3 text-center">Physical Qty</th>
                  <th className="py-2.5 px-3 text-center">Variance</th>
                  <th className="py-2.5 px-3">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {submittedResult.map((res, idx) => {
                  const hasVariance = res.variance !== 0;
                  return (
                    <tr key={res.id || idx} className={res.needsApproval ? 'bg-amber-50/50' : ''}>
                      <td className="py-2 px-3 font-sans">
                        <div className="font-semibold text-gray-900">{res.name}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{res.sku} | 📍 {res.location}</div>
                        {res.needsApproval && (
                          <input 
                            type="text"
                            placeholder="Optional variance reason (damaged, count error)..."
                            value={approvalNote[idx] || ''}
                            onChange={(e) => setApprovalNote({ ...approvalNote, [idx]: e.target.value })}
                            className="mt-1 w-full border rounded px-2 py-0.5 text-[11px] font-sans"
                          />
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-gray-600">{res.system} {res.unit}</td>
                      <td className="py-2 px-3 text-center font-bold text-gray-900">{res.physical} {res.unit}</td>
                      <td className={`py-2 px-3 text-center font-bold ${res.variance > 0 ? 'text-blue-600' : res.variance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {res.variance > 0 ? `+${res.variance}` : res.variance}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        {!hasVariance ? (
                          <span className="text-green-600 font-bold">Exact Match</span>
                        ) : res.needsApproval ? (
                          <div className="flex items-center space-x-1">
                            {approvalStatus[idx] === 'APPROVED' ? (
                              <span className="text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded">Approved</span>
                            ) : approvalStatus[idx] === 'REJECTED' ? (
                              <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded">Rejected (Recount)</span>
                            ) : userRole === 'ADMIN' ? (
                              <div className="flex items-center space-x-1">
                                <button 
                                  onClick={() => handleApprove(idx, 'APPROVED')} 
                                  className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded text-[10px] font-bold"
                                >
                                  Approve
                                </button>
                                <button 
                                  onClick={() => handleApprove(idx, 'REJECTED')} 
                                  className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-[10px] font-bold"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded">
                                Needs Manager Approval
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 font-medium">Auto-Approved (Low Var)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {finalizeError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded font-medium">
              {finalizeError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t">
            <span className="text-xs text-gray-500">
              {pendingApprovalsCount > 0 
                ? `⚠️ ${pendingApprovalsCount} variance items awaiting manager review.` 
                : '✓ All variances reviewed and ready to apply.'}
            </span>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => { setSubmittedResult(null); setFinalizeError(''); }}
                className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded"
              >
                Back to Entry
              </button>
              <button 
                onClick={handleFinalize}
                disabled={!canFinalize || isSubmitting}
                className={`font-bold px-6 py-2 rounded text-xs shadow transition ${
                  !canFinalize || isSubmitting
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 text-amber-400'
                }`}
              >
                {isSubmitting ? 'Applying Adjustments...' : canFinalize ? 'Finalize Stock Count & Apply Adjustments' : `Awaiting Manager Approval (${pendingApprovalsCount})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
