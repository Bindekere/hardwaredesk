'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppProvider';
import { getFinancialReport } from '@/actions/reports';
import { FinancialReportSummary } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import {
  BarChart3,
  Calendar,
  Printer,
  Download,
  Lock,
} from 'lucide-react';

export default function ReportsPage() {
  const { currency, userRole } = useApp();
  const [period, setPeriod] = useState<'TODAY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'>('TODAY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<FinancialReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await getFinancialReport(period, startDate, endDate);
      setReport(data);
    } catch (err) {
      console.error('Failed to load financial report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [period, startDate, endDate]);

  if (userRole !== 'ADMIN') {
    return (
      <div className="py-20 text-center space-y-3 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Restricted Access</h2>
        <p className="text-xs text-slate-500">
          Financial analytics and profit reports are restricted to the <strong>ADMIN</strong> role. Please switch roles in the top navigation bar to view.
        </p>
      </div>
    );
  }

  const exportToCSV = () => {
    if (!report) return;

    const salesRows = [
      ['--- SALES REVENUE ---'],
      ['Receipt #', 'Date', 'Customer', 'Items Sold', 'Revenue', 'Est. Gross Profit', 'Payment Method'],
      ...report.salesBreakdown.map(s => [
        s.receipt_number,
        s.date,
        s.customer_name,
        s.items_count,
        s.revenue.toFixed(2),
        s.gross_profit.toFixed(2),
        s.payment_method,
      ]),
    ];

    const expenseRows = [
      [],
      ['--- EXPENSES & PURCHASES ---'],
      ['Ref / PO', 'Date', 'Category', 'Party / Vendor', 'Amount', 'Payment Method'],
      ...report.expensesBreakdown.map(e => [
        e.id,
        e.date,
        e.category,
        e.party_name,
        e.amount.toFixed(2),
        e.payment_method,
      ]),
    ];

    const summaryRows = [
      [],
      ['--- FINANCIAL SUMMARY ---'],
      ['Total Sales Revenue', report.totalRevenue.toFixed(2)],
      ['Cost of Goods Sold (COGS)', report.costOfGoodsSold.toFixed(2)],
      ['Gross Profit', report.grossProfit.toFixed(2)],
      ['Gross Profit Margin', `${report.profitMarginPercent}%`],
      ['Stock Expenses', report.stockExpenses.toFixed(2)],
      ['Other Operating Expenses', report.otherExpenses.toFixed(2)],
      ['Net Cash Flow', report.netCashFlow.toFixed(2)],
      ['Total Transactions', report.totalSalesCount],
      ['Total Units Sold', report.totalItemsSold],
    ];

    const allRows = [
      [`HardwareDesk Uganda — Financial Report (${report.period})`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ...salesRows,
      ...expenseRows,
      ...summaryRows,
    ];

    const csvContent = allRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HardwareDesk_Report_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = () => {
    if (!report) return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Financial Report - ${report.period}</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #0f172a; max-width: 900px; margin: 0 auto; font-size: 13px; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
            .brand h1 { font-size: 22px; font-weight: bold; }
            .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
            .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
            .metric { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
            .label { font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; }
            .val { font-size: 20px; font-weight: bold; margin-top: 4px; }
            .green { color: #16a34a; } .red { color: #dc2626; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
            th { background: #0f172a; color: #fff; font-weight: bold; }
            .right { text-align: right; }
            h3 { margin-top: 25px; color: #0f172a; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <h1>HardwareDesk Uganda</h1>
              <div>Executive Financial Performance Statement</div>
              <div class="meta">Period: <strong>${report.period}</strong> | Generated: ${new Date().toLocaleString()}</div>
            </div>
          </div>

          <div class="metrics">
            <div class="metric"><div class="label">Total Revenue</div><div class="val">${formatCurrency(report.totalRevenue, currency)}</div></div>
            <div class="metric"><div class="label">Cost of Goods (COGS)</div><div class="val red">${formatCurrency(report.costOfGoodsSold, currency)}</div></div>
            <div class="metric"><div class="label">Gross Profit</div><div class="val green">${formatCurrency(report.grossProfit, currency)}</div></div>
            <div class="metric"><div class="label">Stock Expenses</div><div class="val red">${formatCurrency(report.stockExpenses, currency)}</div></div>
            <div class="metric"><div class="label">Net Cash Flow</div><div class="val ${report.netCashFlow >= 0 ? 'green' : 'red'}">${formatCurrency(report.netCashFlow, currency)}</div></div>
            <div class="metric"><div class="label">Profit Margin</div><div class="val">${report.profitMarginPercent}%</div></div>
          </div>

          <h3>Sales Revenue Breakdown (${report.salesBreakdown.length} sales)</h3>
          <table>
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date</th>
                <th>Customer</th>
                <th class="right">Items</th>
                <th class="right">Revenue</th>
                <th class="right">Gross Profit</th>
              </tr>
            </thead>
            <tbody>
              ${report.salesBreakdown.map(s => `
                <tr>
                  <td><strong>${s.receipt_number}</strong></td>
                  <td>${s.date}</td>
                  <td>${s.customer_name}</td>
                  <td class="right">${s.items_count}</td>
                  <td class="right">${formatCurrency(s.revenue, currency)}</td>
                  <td class="right green"><strong>${formatCurrency(s.gross_profit, currency)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3>Stock Expenses & Disbursements (${report.expensesBreakdown.length} records)</h3>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Category</th>
                <th>Party / Vendor</th>
                <th class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${report.expensesBreakdown.map(e => `
                <tr>
                  <td>${e.id}</td>
                  <td>${e.date}</td>
                  <td>${e.category}</td>
                  <td>${e.party_name}</td>
                  <td class="right red">${formatCurrency(e.amount, currency)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">HardwareDesk — Database-Backed Real-Time Accounting Audit</div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-amber-500" />
            <span>Financial Reports & Analytics</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time revenue, gross margins, inventory expenses, and net cash flow
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {(['TODAY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                period === p
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={handlePrintPDF}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-xs flex items-center space-x-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-xs flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {period === 'CUSTOM' && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex flex-wrap items-center gap-3 text-xs">
          <span className="font-bold text-amber-900 flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>Custom Date Range:</span>
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="text-amber-800 font-semibold">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-amber-300 rounded-lg px-2.5 py-1 bg-white text-xs"
            />
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-amber-800 font-semibold">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-amber-300 rounded-lg px-2.5 py-1 bg-white text-xs"
            />
          </div>
        </div>
      )}

      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Revenue</span>
            <p className="text-lg sm:text-xl font-black text-slate-900 mt-1">{formatCurrency(report.totalRevenue, currency)}</p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">{report.totalSalesCount} completed sales</span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Cost of Goods (COGS)</span>
            <p className="text-lg sm:text-xl font-black text-red-600 mt-1">{formatCurrency(report.costOfGoodsSold, currency)}</p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Historical cost basis</span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Gross Profit</span>
            <p className="text-lg sm:text-xl font-black text-green-600 mt-1">{formatCurrency(report.grossProfit, currency)}</p>
            <span className="text-[11px] text-green-700 font-semibold mt-0.5 block">Revenue − COGS</span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Stock Purchases</span>
            <p className="text-lg sm:text-xl font-black text-slate-800 mt-1">{formatCurrency(report.stockExpenses, currency)}</p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Supplier restock cash out</span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Net Cash Flow</span>
            <p className={`text-lg sm:text-xl font-black mt-1 ${report.netCashFlow >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
              {formatCurrency(report.netCashFlow, currency)}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Cash In − Cash Out</span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Profit Margin</span>
            <p className="text-lg sm:text-xl font-black text-indigo-600 mt-1">{report.profitMarginPercent}%</p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">{report.totalItemsSold} total items sold</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b bg-slate-50 flex justify-between items-center">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Sales Revenue Breakdown
            </h2>
            <span className="text-xs text-slate-500">{report?.salesBreakdown.length || 0} sales</span>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right">Est. Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!report || report.salesBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">No sales in selected period.</td>
                  </tr>
                ) : (
                  report.salesBreakdown.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{s.receipt_number}</td>
                      <td className="py-2.5 px-3 text-slate-500">{s.date}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {formatCurrency(s.revenue, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-green-600">
                        {formatCurrency(s.gross_profit, currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b bg-slate-50 flex justify-between items-center">
            <h2 className="text-xs sm:text-sm font-bold text-red-700 uppercase tracking-wider">
              Stock Expenses & Disbursements
            </h2>
            <span className="text-xs text-slate-500">{report?.expensesBreakdown.length || 0} records</span>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Ref / PO #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Category / Party</th>
                  <th className="py-2.5 px-3 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!report || report.expensesBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">No expenses in selected period.</td>
                  </tr>
                ) : (
                  report.expensesBreakdown.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{e.id.slice(0, 10)}</td>
                      <td className="py-2.5 px-3 text-slate-500">{e.date}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{e.category}</div>
                        <div className="text-[10px] text-slate-400">{e.party_name}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-red-600">
                        {formatCurrency(e.amount, currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
