'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useApp } from '@/components/AppProvider';
import { getProducts } from '@/actions/products';
import { submitStockTake, approveStockTakeItem, finalizeStockTake } from '@/actions/stock-take';
import { Product, StockTakeItem } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const VARIANCE_THRESHOLD = 5;

export default function StockTakePage() {
  const { currency, userRole } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Array<{ id: string; name: string; location: string; unitCost: number; physical: string }>>([]);
  const [submittedResults, setSubmittedResults] = useState<StockTakeItem[] | null>(null);
  const [currentStockTakeId, setCurrentStockTakeId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});
  const [finalizedSuccess, setFinalizedSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
      setCounts(
        data.map(p => ({
          id: p.id,
          name: p.name,
          location: p.location || 'Main Store',
          unitCost: p.cost_price,
          physical: '',
        }))
      );
    } catch (err) {
      console.error('Failed to load stock take products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmitCounts = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const stockTakeNumber = `ST-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const systemQtyMap = new Map(products.map(p => [p.id, p.current_stock]));

    const payloadCounts = counts.map(item => {
      const system = systemQtyMap.get(item.id) ?? 0;
      const physical = item.physical.trim() !== '' ? parseFloat(item.physical) || 0 : system;
      return {
        productId: item.id,
        productName: item.name,
        location: item.location,
        systemQuantity: system,
        physicalQuantity: physical,
        unitCost: item.unitCost,
      };
    });

    startTransition(async () => {
      const res = await submitStockTake({
        stockTakeNumber,
        counts: payloadCounts,
        createdBy: userRole,
      });

      if (!res.success || !res.items) {
        setErrorMsg(res.error || 'Failed to submit stock take');
        return;
      }

      setCurrentStockTakeId(res.stockTakeId || null);
      setSubmittedResults(res.items);
      setFinalizedSuccess(false);
    });
  };

  const handleApproveReject = (itemId: string, status: 'APPROVED' | 'REJECTED') => {
    startTransition(async () => {
      const note = approvalNotes[itemId] || '';
      const res = await approveStockTakeItem(itemId, status, note);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to update approval status');
        return;
      }

      setSubmittedResults(prev =>
        prev
          ? prev.map(item => (item.id === itemId ? { ...item, approval_status: status, manager_note: note } : item))
          : null
      );
    });
  };

  const allApprovedOrResolved =
    submittedResults &&
    submittedResults.every(
      item => item.approval_status === 'AUTO_APPROVED' || item.approval_status === 'APPROVED' || item.approval_status === 'REJECTED'
    );

  const handleFinalize = () => {
    if (!currentStockTakeId) return;
    setErrorMsg(null);

    startTransition(async () => {
      const res = await finalizeStockTake(currentStockTakeId, userRole);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to finalize adjustments');
        return;
      }

      setFinalizedSuccess(true);
      loadData();
    });
  };

  const handleReset = () => {
    setSubmittedResults(null);
    setCurrentStockTakeId(null);
    setFinalizedSuccess(false);
    setApprovalNotes({});
    setCounts(products.map(p => ({ id: p.id, name: p.name, location: p.location || 'Main Store', unitCost: p.cost_price, physical: '' })));
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Blind Stock Take & Audit</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Physical counts remain blind until submitted. Discrepancies ≥ {VARIANCE_THRESHOLD} units require manager authorization.
          </p>
        </div>
        {submittedResults && (
          <button
            onClick={handleReset}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3.5 py-1.5 rounded-lg text-xs transition border border-slate-300 flex items-center space-x-1 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Count Audit</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 font-bold p-1">✕</button>
        </div>
      )}

      {!submittedResults ? (
        <form onSubmit={handleSubmitCounts} className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Step 1: Enter Physical Quantities ({counts.length} Products)
            </span>
            <span className="text-xs text-amber-700 bg-amber-50 font-bold px-2 py-1 rounded border border-amber-200">
              System counts hidden
            </span>
          </div>

          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span>Loading catalog items for stock count...</span>
              </div>
            ) : (
              counts.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-3 rounded-xl border border-slate-100 gap-2 hover:border-amber-300 transition"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-400 font-mono">📍 Bin Location: {item.location}</div>
                  </div>
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Physical count"
                      value={item.physical}
                      onChange={(e) => {
                        const newCounts = [...counts];
                        newCounts[idx].physical = e.target.value;
                        setCounts(newCounts);
                      }}
                      className="w-full sm:w-36 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-black text-center focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition shadow-xs flex items-center justify-center space-x-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            <span>Submit Physical Counts & Calculate Variances</span>
          </button>
        </form>
      ) : finalizedSuccess ? (
        <div className="bg-green-50 border border-green-200 p-8 rounded-2xl text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto text-2xl">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-green-900">Stock Take Finalized & Applied</h2>
          <p className="text-xs sm:text-sm text-green-700 max-w-md mx-auto">
            All approved physical inventory counts have been committed to the database and logged to the movements ledger.
          </p>
          <div className="pt-2">
            <button
              onClick={handleReset}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-xs"
            >
              Start New Stock Take
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">Stock Variance Audit Review</h2>
              <p className="text-xs text-slate-500">Compare physical count against system inventory</p>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-lg">
                🔴 {submittedResults.filter(r => r.approval_status === 'PENDING_APPROVAL').length} Needs Approval
              </span>
              <span className="bg-green-100 text-green-800 font-bold px-2.5 py-1 rounded-lg">
                🟢 {submittedResults.filter(r => r.approval_status !== 'PENDING_APPROVAL').length} Resolved
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
            {submittedResults.map((item) => {
              const isPendingApproval = item.approval_status === 'PENDING_APPROVAL';
              const isApproved = item.approval_status === 'APPROVED' || item.approval_status === 'AUTO_APPROVED';
              const isRejected = item.approval_status === 'REJECTED';
              const canApprove = userRole === 'ADMIN';

              return (
                <div
                  key={item.id || item.product_id}
                  className={`p-4 transition ${isPendingApproval ? 'bg-amber-50/70' : 'hover:bg-slate-50/50'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{item.product_name}</div>
                      <div className="text-xs text-slate-400 font-mono">📍 {item.location}</div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                        <span>System Stock: <strong className="text-slate-900">{item.system_quantity}</strong></span>
                        <span>Physical Count: <strong className="text-slate-900">{item.physical_quantity}</strong></span>
                        <span className={`font-black ${
                          item.variance < 0 ? 'text-red-600' : item.variance > 0 ? 'text-green-600' : 'text-slate-500'
                        }`}>
                          Variance: {item.variance > 0 ? `+${item.variance}` : item.variance} units
                        </span>
                        {item.variance_cost !== 0 && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Cost Impact: {formatCurrency(item.variance_cost, currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-start sm:items-end space-y-1">
                      {item.approval_status === 'AUTO_APPROVED' && (
                        <span className="text-[11px] bg-green-100 text-green-800 font-bold px-2.5 py-1 rounded-lg">
                          ✓ Auto-Approved
                        </span>
                      )}
                      {isPendingApproval && (
                        <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-lg flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Awaiting Manager Approval</span>
                        </span>
                      )}
                      {item.approval_status === 'APPROVED' && (
                        <span className="text-[11px] bg-green-100 text-green-800 font-bold px-2.5 py-1 rounded-lg">
                          ✓ Manager Approved
                        </span>
                      )}
                      {isRejected && (
                        <span className="text-[11px] bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-lg">
                          ✗ Rejected (Recount)
                        </span>
                      )}
                    </div>
                  </div>

                  {isPendingApproval && canApprove && (
                    <div className="mt-3 bg-white p-3 rounded-xl border border-amber-200 space-y-2">
                      <input
                        type="text"
                        placeholder="Manager reason note (e.g. verified broken in stock room)..."
                        value={approvalNotes[item.id] || ''}
                        onChange={(e) => setApprovalNotes({ ...approvalNotes, [item.id]: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => handleApproveReject(item.id, 'APPROVED')}
                          disabled={isPending}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 rounded-lg text-xs transition"
                        >
                          ✓ Authorize Discrepancy
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveReject(item.id, 'REJECTED')}
                          disabled={isPending}
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 rounded-lg text-xs transition"
                        >
                          ✗ Reject / Require Recount
                        </button>
                      </div>
                    </div>
                  )}

                  {isPendingApproval && !canApprove && (
                    <p className="mt-2 text-xs text-amber-800 italic">
                      Discrepancy exceeds threshold. Switch role to ADMIN to approve.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Finalizing will update actual inventory stocks in the database.
            </span>
            <button
              onClick={handleFinalize}
              disabled={!allApprovedOrResolved || isPending}
              className={`px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition shadow-xs flex items-center justify-center space-x-1.5 ${
                allApprovedOrResolved && !isPending
                  ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Applying Inventory Adjustments...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Finalize & Apply Adjustments</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
