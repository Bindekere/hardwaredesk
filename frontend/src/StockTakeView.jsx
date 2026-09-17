import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

const VARIANCE_THRESHOLD = 5; // require manager approval if abs variance >= this

export default function StockTakeView({ userRole, products, onAdjustStock, onReload }) {
  const [counts, setCounts] = useState([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [submittedResult, setSubmittedResult] = useState(null);
  const [approvalStatus, setApprovalStatus] = useState({}); // { idx: 'APPROVED'|'REJECTED' }
  const [approvalNote, setApprovalNote] = useState({});     // { idx: noteText }
  const [finalized, setFinalized] = useState(false);
  const [excelUploadedCount, setExcelUploadedCount] = useState(0);

  const fileInputRef = useRef(null);

  // Initialize stock count items from live products catalog
  useEffect(() => {
    if (products && products.length > 0) {
      setCounts(products.map(p => ({
        id: p.id || p.sku,
        sku: p.sku,
        name: p.name,
        category: p.category_id || p.category,
        location: p.storage_location_id || p.location || 'Paint Section',
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

  // Parse Excel / CSV Physical Count file to auto-populate counts
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rawJson || rawJson.length < 2) return;

        const headers = rawJson[0].map(h => String(h || '').trim().toLowerCase());
        const dataRows = rawJson.slice(1);

        const skuIdx = headers.findIndex(h => h.includes('sku') || h.includes('code'));
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('item'));
        const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('count') || h.includes('physical') || h.includes('qty') || h.includes('available'));

        let matched = 0;
        setCounts(prevCounts => {
          return prevCounts.map(item => {
            const foundRow = dataRows.find(r => {
              if (skuIdx !== -1 && r[skuIdx] && String(r[skuIdx]).trim().toLowerCase() === item.sku.toLowerCase()) return true;
              if (nameIdx !== -1 && r[nameIdx] && String(r[nameIdx]).trim().toLowerCase() === item.name.toLowerCase()) return true;
              return false;
            });

            if (foundRow && stockIdx !== -1 && foundRow[stockIdx] !== undefined && foundRow[stockIdx] !== '') {
              matched++;
              const parsedVal = parseInt(String(foundRow[stockIdx]).replace(/[^0-9]/g, '')) || 0;
              return { ...item, physical: parsedVal };
            }
            return item;
          });
        });

        setExcelUploadedCount(matched);
      } catch (err) {
        console.error('Error reading stock take excel:', err);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSubmit = () => {
    const results = counts.map(item => {
      const system = item.system || 0;
      const physical = item.physical !== '' && !isNaN(parseInt(item.physical)) ? parseInt(item.physical) : system;
      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        location: item.location,
        system,
        physical,
        unit: item.unit,
        variance: physical - system,
        needsApproval: Math.abs(physical - system) >= VARIANCE_THRESHOLD
      };
    });
    setSubmittedResult(results);
    setApprovalStatus({});
    setApprovalNote({});
    setFinalized(false);
  };

  const handleApprove = (idx, status) => {
    setApprovalStatus(prev => ({ ...prev, [idx]: status }));
  };

  const allApproved = submittedResult && submittedResult.every((res, idx) =>
    !res.needsApproval || approvalStatus[idx] === 'APPROVED' || approvalStatus[idx] === 'REJECTED'
  );

  const handleFinalize = () => {
    if (!submittedResult) return;
    // Apply approved adjustments
    submittedResult.forEach((res, idx) => {
      const isApproved = !res.needsApproval || approvalStatus[idx] === 'APPROVED';
      if (isApproved && res.variance !== 0 && onAdjustStock) {
        onAdjustStock(res.id, res.variance);
      }
    });
    setFinalized(true);
    if (onReload) onReload();
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-800">📋 Blind Stock Take & Physical Inventory Count</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Enter physical counts or upload your stock-take spreadsheet. System quantities are audited after submission.
            Variances ≥ {VARIANCE_THRESHOLD} units require manager review.
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
                className="text-xs bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold px-3 py-2 rounded transition flex items-center space-x-1 shadow-sm"
              >
                <span>📊</span>
                <span>Upload Count Sheet</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => { setSubmittedResult(null); setFinalized(false); }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded transition"
            >
              ↩ New Stock Take
            </button>
          )}
        </div>
      </div>

      {excelUploadedCount > 0 && !submittedResult && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs px-4 py-2.5 rounded-lg flex items-center justify-between font-semibold">
          <span>✅ Auto-filled {excelUploadedCount} items from your uploaded spreadsheet. Review and click submit below.</span>
          <button onClick={() => setExcelUploadedCount(0)} className="text-blue-600 font-bold">✕</button>
        </div>
      )}

      {!submittedResult ? (
        <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
          {/* Quick Filter */}
          <div className="flex justify-between items-center gap-2">
            <input 
              type="text" 
              placeholder="Search products in stock take..." 
              value={filterQuery} 
              onChange={e => setFilterQuery(e.target.value)} 
              className="w-full sm:w-80 border border-gray-300 rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-xs text-gray-500">
              {displayedCounts.length} items to count
            </span>
          </div>

          <div className="overflow-y-auto max-h-[500px] border rounded divide-y divide-gray-100">
            {displayedCounts.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No products found.
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
                      <span className="text-xs text-gray-500 w-8">{item.unit}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button 
              onClick={handleSubmit} 
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-6 py-2.5 rounded text-sm transition shadow"
            >
              Submit Counts & Calculate Variance ({counts.length} Products)
            </button>
          </div>
        </div>
      ) : finalized ? (
        <div className="bg-green-50 border border-green-300 p-8 rounded-lg text-center space-y-3">
          <div className="text-4xl">✅</div>
          <h3 className="font-bold text-green-900 text-base">Stock Take Finalized & Applied</h3>
          <p className="text-xs text-green-700">All approved inventory adjustments have been successfully recorded in the system and database.</p>
          <button onClick={() => { setSubmittedResult(null); setFinalized(false); setCounts(counts.map(c => ({ ...c, physical: '' }))); }}
            className="mt-4 bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold px-5 py-2.5 rounded text-xs shadow">
            Start New Stock Take
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden space-y-4 p-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-bold text-base text-gray-800">Stock Take Variance Audit</h3>
              <p className="text-xs text-gray-500">Compare physical count with system records. Review variances before final sync.</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded font-bold">
                🔴 {submittedResult.filter(r => r.needsApproval).length} High Variances
              </span>
              <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded font-bold">
                🟢 {submittedResult.filter(r => !r.needsApproval).length} Matched / Low Variance
              </span>
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
                        <div className="text-[11px] text-gray-400">{res.sku}</div>
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
                              <span className="text-red-700 font-bold bg-red-100 px-2 py-0.5 rounded">Rejected</span>
                            ) : userRole === 'ADMIN' ? (
                              <>
                                <button onClick={() => handleApprove(idx, 'APPROVED')} className="bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded text-[10px] font-bold">Approve</button>
                                <button onClick={() => handleApprove(idx, 'REJECTED')} className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-[10px] font-bold">Reject</button>
                              </>
                            ) : (
                              <span className="text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded">Needs Manager Approval</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">Auto-Applied</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t">
            <button 
              onClick={() => { setSubmittedResult(null); }}
              className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded"
            >
              Back to Entry
            </button>
            <button 
              onClick={handleFinalize}
              className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-6 py-2 rounded text-xs shadow transition"
            >
              Finalize Stock Count & Update System
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
