'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { getDashboardMetrics, DashboardMetrics } from '@/actions/dashboard';
import { formatCurrency } from '@/lib/formatters';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  ShoppingCart,
  ArrowRight,
  RefreshCw,
  Award,
} from 'lucide-react';

export default function DashboardPage() {
  const { currency, userRole } = useApp();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    todaysRevenue: 0,
    todaysSalesCount: 0,
    totalProductsCount: 0,
    lowStockCount: 0,
    recentSales: [],
    topBestSellers: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-xs sm:text-sm text-slate-500">Live operational metrics & hardware sales performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span>{refreshing ? 'Updating...' : 'Sync Live'}</span>
          </button>
          <span className="text-xs bg-slate-200 text-slate-800 font-bold px-2.5 py-1 rounded-lg">
            Role: {userRole}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-200 hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Revenue</span>
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-green-600 mt-2">
            {loading ? '...' : formatCurrency(metrics.todaysRevenue, currency)}
          </p>
          <span className="text-xs text-green-700 font-semibold mt-1 block">
            {loading ? 'Calculating...' : `${metrics.todaysSalesCount} completed sales today`}
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-200 hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Products</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 mt-2">
            {loading ? '...' : metrics.totalProductsCount}
          </p>
          <span className="text-xs text-slate-500 font-medium mt-1 block">
            Active items in hardware catalog
          </span>
        </div>

        <Link
          href="/inventory"
          className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-slate-200 hover:border-amber-400 hover:shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Low Stock Alerts</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:scale-105 transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-amber-600 mt-2">
            {loading ? '...' : metrics.lowStockCount}
          </p>
          <span className="text-xs text-amber-700 font-semibold mt-1 flex items-center justify-between">
            <span>Items below minimum threshold</span>
            <span className="group-hover:translate-x-0.5 transition flex items-center space-x-0.5">
              <span>View</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                Recent Sales Transactions
              </h2>
              <Link href="/receipt-book" className="text-xs font-semibold text-amber-600 hover:text-amber-700">
                Receipt Book &rarr;
              </Link>
            </div>

            <div className="max-h-72 overflow-y-auto border rounded-xl border-slate-100 divide-y divide-slate-100">
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-xs">Loading sales from database...</div>
              ) : metrics.recentSales.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No sales recorded yet today. Open Quick Sale to make a transaction.
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] sticky top-0 border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Receipt #</th>
                      <th className="py-2.5 px-3">Customer / Items</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-center">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.recentSales.map((sale) => {
                      const firstItem = sale.items && sale.items.length > 0 ? sale.items[0].product_name : 'Item';
                      const extraCount = sale.items && sale.items.length > 1 ? ` +${sale.items.length - 1}` : '';
                      const totalQty = sale.items && sale.items.length > 0 ? sale.items.reduce((s, i) => s + i.quantity, 0) : 1;

                      return (
                        <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {sale.receipt_number}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800 truncate max-w-[150px]">
                              {firstItem} <span className="text-[11px] text-slate-400 font-normal">({totalQty}x){extraCount}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">{sale.customer_name}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(sale.total_amount, currency)}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              sale.payment_method === 'Mobile Money'
                                ? 'bg-blue-100 text-blue-700'
                                : sale.payment_method === 'Credit'
                                ? 'bg-amber-100 text-amber-800'
                                : sale.payment_method === 'Store Credit'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {sale.payment_method}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t flex justify-end">
            <Link
              href="/sales"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs transition shadow-xs flex items-center space-x-1"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Make a Sale</span>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Top Fast-Moving Products</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">Ranked by units sold</span>
            </div>

            <ul className="divide-y divide-slate-100 text-xs sm:text-sm">
              {loading ? (
                <li className="py-8 text-center text-slate-400 text-xs">Loading product sales...</li>
              ) : metrics.topBestSellers.length === 0 ? (
                <li className="py-8 text-center text-slate-400 text-xs">No sales volume calculated yet.</li>
              ) : (
                metrics.topBestSellers.map((item, idx) => (
                  <li key={idx} className="flex justify-between items-center py-2.5">
                    <div className="flex items-center space-x-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-amber-500 text-slate-950 shadow-xs' :
                        idx === 1 ? 'bg-slate-300 text-slate-900' :
                        idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800">{item.name}</span>
                    </div>
                    <span className="text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded-md text-xs">
                      {item.sold} sold
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="pt-3 mt-3 border-t text-xs text-slate-400 text-right">
            Auto-derived from persisted <code className="font-mono text-slate-600">sale_items</code>
          </div>
        </div>
      </div>
    </div>
  );
}
