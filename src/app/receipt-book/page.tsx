'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppProvider';
import { getReceiptBook } from '@/actions/sales';
import { Receipt } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import ReceiptModal from '@/components/ReceiptModal';
import { Search, Printer, Eye, Calendar, RefreshCw } from 'lucide-react';

export default function ReceiptBookPage() {
  const { currency, userRole } = useApp();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'TODAY' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      let options: any = { searchTerm };
      if (periodFilter === 'TODAY') {
        const todayStr = new Date().toISOString().slice(0, 10);
        options.startDate = todayStr;
        options.endDate = todayStr;
      } else if (periodFilter === 'CUSTOM' && startDate) {
        options.startDate = startDate;
        options.endDate = endDate || startDate;
      }

      const data = await getReceiptBook(options);
      setReceipts(data);
    } catch (err) {
      console.error('Failed to load receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [periodFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadReceipts();
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Receipt Book Register</h1>
          <p className="text-xs sm:text-sm text-slate-500">Historical register of official sales and payment receipts</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadReceipts()}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <span className="text-xs bg-slate-200 text-slate-800 font-bold px-2.5 py-1 rounded-lg">
            Role: {userRole}
          </span>
        </div>
      </div>

      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Search Receipt # or Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 pl-9 text-xs sm:text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>

          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Recorded Time</option>
            <option value="TODAY">Today Only</option>
            <option value="CUSTOM">Custom Date Range</option>
          </select>
        </form>

        {periodFilter === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-2 text-xs bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-800" />
              <span className="text-amber-800 font-bold">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-amber-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-amber-800 font-bold">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-amber-300 rounded px-2 py-1 bg-white text-xs"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 text-[11px] sm:text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 sm:px-4">Receipt #</th>
                <th className="py-3 px-3 sm:px-4">Date & Time</th>
                <th className="py-3 px-3 sm:px-4">Customer / Party</th>
                <th className="py-3 px-3 sm:px-4">Payment</th>
                <th className="py-3 px-3 sm:px-4 text-center">Items</th>
                <th className="py-3 px-3 sm:px-4 text-right">Total Amount</th>
                <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Loading receipts from database...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No receipts found matching the selected filter.
                  </td>
                </tr>
              ) : (
                receipts.map((r) => {
                  const itemCount = (r.items_snapshot || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
                  return (
                    <tr key={r.id || r.receipt_number} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 sm:px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {r.receipt_number}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-slate-600 text-xs whitespace-nowrap">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {r.party_name}
                      </td>
                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          r.payment_method === 'Mobile Money'
                            ? 'bg-blue-100 text-blue-700'
                            : r.payment_method === 'Credit'
                            ? 'bg-amber-100 text-amber-800'
                            : r.payment_method === 'Store Credit'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {r.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-center font-mono text-slate-600 whitespace-nowrap">
                        {itemCount}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right font-black text-amber-600 whitespace-nowrap">
                        {formatCurrency(r.total_amount, currency)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedReceipt(r)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded-lg text-xs font-semibold transition border border-slate-300 inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => setSelectedReceipt(r)}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center space-x-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        currency={currency}
      />
    </div>
  );
}
