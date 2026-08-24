'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useApp } from '@/components/AppProvider';
import { getCustomers, createCustomer, recordDebtorPayment, recordPrepayment, getCustomerTransactions } from '@/actions/customers';
import { getSuppliers, createSupplier, recordSupplierPayment, getSupplierTransactions } from '@/actions/suppliers';
import { Customer, Supplier, LedgerTransaction, Receipt } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import AuditDrawer from '@/components/AuditDrawer';
import ReceiptModal from '@/components/ReceiptModal';
import {
  BookOpen,
  Search,
  Plus,
  CreditCard,
  History,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export default function LedgerPage() {
  const { currency, userRole } = useApp();
  const [activeTab, setActiveTab] = useState<'DEBTORS' | 'CREDITORS'>('DEBTORS');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<Customer | Supplier | null>(null);
  const [auditEntity, setAuditEntity] = useState<any>(null);
  const [auditTransactions, setAuditTransactions] = useState<LedgerTransaction[]>([]);
  const [generatedReceipt, setGeneratedReceipt] = useState<Receipt | null>(null);

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Mobile Money' | 'Bank Transfer'>('Cash');
  const [payNote, setPayNote] = useState('');

  const [newEntry, setNewEntry] = useState({
    type: 'DEBTOR' as 'DEBTOR' | 'PREPAYMENT' | 'CREDITOR',
    name: '',
    phone: '',
    email: '',
    address: '',
    amount: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [cList, sList] = await Promise.all([getCustomers(), getSuppliers()]);
      setCustomers(cList);
      setSuppliers(sList);
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalDebtorsBalance = customers.reduce((sum, c) => sum + (c.balance_due || 0), 0);
  const totalStoreCredits = customers.reduce((sum, c) => sum + (c.store_credit || 0), 0);
  const totalCreditorsBalance = suppliers.reduce((sum, s) => sum + (s.balance_due || 0), 0);

  const currentList = activeTab === 'DEBTORS' ? customers : suppliers;

  const filteredList = currentList.filter((item: any) => {
    const s = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(s) ||
      (item.phone && item.phone.toLowerCase().includes(s)) ||
      (item.email && item.email.toLowerCase().includes(s))
    );
  });

  const handleOpenAudit = async (item: Customer | Supplier) => {
    if (activeTab === 'DEBTORS') {
      const txns = await getCustomerTransactions(item.id);
      setAuditEntity({
        id: item.id,
        name: item.name,
        phone: item.phone,
        totalAmount: (item as Customer).total_credit_sales,
        amountPaid: (item as Customer).total_payments_made,
        balanceDue: item.balance_due,
        storeCredit: (item as Customer).store_credit,
      });
      setAuditTransactions(txns);
    } else {
      const txns = await getSupplierTransactions(item.id);
      setAuditEntity({
        id: item.id,
        name: item.name,
        phone: item.phone,
        totalAmount: (item as Supplier).total_purchases,
        amountPaid: (item as Supplier).total_payments_made,
        balanceDue: item.balance_due,
      });
      setAuditTransactions(txns);
    }
  };

  const handleAddEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const amountVal = parseFloat(newEntry.amount) || 0;

    startTransition(async () => {
      if (newEntry.type === 'DEBTOR') {
        const res = await createCustomer({
          name: newEntry.name,
          phone: newEntry.phone,
          email: newEntry.email,
          address: newEntry.address,
          initialCredit: amountVal,
        });
        if (!res.success) { setErrorMsg(res.error || 'Failed to create customer debtor'); return; }
      } else if (newEntry.type === 'PREPAYMENT') {
        const res = await recordPrepayment({
          customerName: newEntry.name,
          phone: newEntry.phone,
          amount: amountVal,
          paymentMethod: 'Cash',
        });
        if (!res.success || !res.receipt) { setErrorMsg(res.error || 'Failed to record prepayment'); return; }
        setGeneratedReceipt(res.receipt);
      } else if (newEntry.type === 'CREDITOR') {
        const res = await createSupplier({
          name: newEntry.name,
          phone: newEntry.phone,
          email: newEntry.email,
          initialBalance: amountVal,
        });
        if (!res.success) { setErrorMsg(res.error || 'Failed to create supplier creditor'); return; }
      }

      setShowAddEntryModal(false);
      setNewEntry({ type: 'DEBTOR', name: '', phone: '', email: '', address: '', amount: '' });
      loadData();
    });
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal) return;
    setErrorMsg(null);
    const amountVal = parseFloat(payAmount) || 0;

    startTransition(async () => {
      if (activeTab === 'DEBTORS') {
        const res = await recordDebtorPayment({
          customerId: showPayModal.id,
          amount: amountVal,
          paymentMethod: payMethod,
          note: payNote,
        });
        if (!res.success || !res.receipt) { setErrorMsg(res.error || 'Failed to record debtor payment'); return; }
        setGeneratedReceipt(res.receipt);
      } else {
        const res = await recordSupplierPayment({
          supplierId: showPayModal.id,
          amount: amountVal,
          paymentMethod: payMethod,
          note: payNote,
        });
        if (!res.success) { setErrorMsg(res.error || 'Failed to record supplier payment'); return; }
      }

      setShowPayModal(null);
      setPayAmount('');
      setPayNote('');
      loadData();
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Debtors & Creditors Ledger</h1>
          <p className="text-xs sm:text-sm text-slate-500">Track customer credit accounts, store prepayments, and supplier obligations</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddEntryModal(true)}
            className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs sm:text-sm transition shadow-xs flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Account</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 font-bold p-1">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div
          onClick={() => setActiveTab('DEBTORS')}
          className={`p-4 sm:p-5 rounded-2xl shadow-xs border cursor-pointer transition ${
            activeTab === 'DEBTORS' ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/50' : 'bg-white border-slate-200'
          }`}
        >
          <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">Customers Owe Us (Debtors)</span>
          <p className="text-xl sm:text-2xl font-black text-red-600 mt-1.5">{formatCurrency(totalDebtorsBalance, currency)}</p>
          <span className="text-xs text-slate-500 mt-1 block">Uncollected customer credit sales</span>
        </div>

        <div
          onClick={() => setActiveTab('DEBTORS')}
          className="p-4 sm:p-5 rounded-2xl shadow-xs border bg-green-50/70 border-green-200 cursor-pointer hover:border-green-400 transition"
        >
          <span className="text-xs font-bold text-green-900 uppercase tracking-wider block">Customer Store Credits</span>
          <p className="text-xl sm:text-2xl font-black text-green-700 mt-1.5">{formatCurrency(totalStoreCredits, currency)}</p>
          <span className="text-xs text-green-800 mt-1 block">Prepaid deposits & advance orders</span>
        </div>

        <div
          onClick={() => setActiveTab('CREDITORS')}
          className={`p-4 sm:p-5 rounded-2xl shadow-xs border cursor-pointer transition ${
            activeTab === 'CREDITORS' ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <span className={`text-xs font-bold uppercase tracking-wider block ${activeTab === 'CREDITORS' ? 'text-slate-300' : 'text-slate-600'}`}>
            We Owe Suppliers (Creditors)
          </span>
          <p className={`text-xl sm:text-2xl font-black mt-1.5 ${activeTab === 'CREDITORS' ? 'text-amber-400' : 'text-slate-900'}`}>
            {formatCurrency(totalCreditorsBalance, currency)}
          </p>
          <span className={`text-xs mt-1 block ${activeTab === 'CREDITORS' ? 'text-slate-400' : 'text-slate-500'}`}>
            Unpaid stock purchase invoices
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('DEBTORS')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                activeTab === 'DEBTORS' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Debtors & Store Credits
            </button>
            <button
              onClick={() => setActiveTab('CREDITORS')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                activeTab === 'CREDITORS' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Creditors Ledger
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder={`Search ${activeTab === 'DEBTORS' ? 'customer' : 'supplier'} name or phone...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 pl-9 text-xs sm:text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 text-[11px] sm:text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 sm:px-4">{activeTab === 'DEBTORS' ? 'Customer Account' : 'Supplier Company'}</th>
                <th className="py-3 px-3 sm:px-4">Phone Number</th>
                <th className="py-3 px-3 sm:px-4 text-right">{activeTab === 'DEBTORS' ? 'Total Credit' : 'Total Invoiced'}</th>
                <th className="py-3 px-3 sm:px-4 text-right">Amount Paid</th>
                <th className="py-3 px-3 sm:px-4 text-right">Balance Due</th>
                {activeTab === 'DEBTORS' && <th className="py-3 px-3 sm:px-4 text-right">Store Credit</th>}
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">Loading ledger accounts...</td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">No accounts found matching search.</td>
                </tr>
              ) : (
                filteredList.map((item: any) => {
                  const isDebtor = activeTab === 'DEBTORS';
                  const total = isDebtor ? item.total_credit_sales : item.total_purchases;
                  const paid = isDebtor ? item.total_payments_made : item.total_payments_made;
                  const balance = item.balance_due || 0;
                  const storeCredit = isDebtor ? (item.store_credit || 0) : 0;
                  const isPrepaid = storeCredit > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 whitespace-nowrap">
                        {item.name}
                      </td>
                      <td className="py-3 px-3 sm:px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {item.phone || '-'}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right font-mono text-slate-700 whitespace-nowrap">
                        {formatCurrency(total, currency)}
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right font-mono text-green-600 font-bold whitespace-nowrap">
                        {formatCurrency(paid, currency)}
                      </td>
                      <td className={`py-3 px-3 sm:px-4 text-right font-mono font-black whitespace-nowrap ${
                        balance > 0 ? 'text-red-600' : 'text-slate-900'
                      }`}>
                        {formatCurrency(balance, currency)}
                      </td>
                      {isDebtor && (
                        <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                          {isPrepaid ? formatCurrency(storeCredit, currency) : '-'}
                        </td>
                      )}
                      <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                          isPrepaid ? 'bg-blue-100 text-blue-800' :
                          balance === 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {isPrepaid ? 'PREPAID' : balance === 0 ? 'CLEARED' : 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right space-x-1.5 whitespace-nowrap">
                        {balance > 0 && (
                          <button
                            onClick={() => { setShowPayModal(item); setPayAmount(String(balance)); }}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center space-x-1"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Pay</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenAudit(item)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold transition border border-slate-300 inline-flex items-center space-x-1"
                          title="View Historical Ledger History"
                        >
                          <History className="w-3 h-3" />
                          <span>Audit</span>
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

      {showPayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-2.5">
              <h3 className="text-base font-bold text-slate-900">
                Record Payment: {showPayModal.name}
              </h3>
              <button onClick={() => setShowPayModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500">Balance Due</label>
                <div className="text-xl font-black text-red-600 mt-0.5">
                  {formatCurrency(showPayModal.balance_due, currency)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Amount ({currency}) *
                </label>
                <input
                  required
                  type="number"
                  step="any"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-base font-mono font-black"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Channel</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white font-semibold"
                >
                  <option value="Cash">Cash</option>
                  <option value="Mobile Money">MTN / Airtel Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Partial cash instalment"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPayModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl shadow-xs"
                >
                  {isPending ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddEntryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Add New Account Entry</h3>
              <button onClick={() => setShowAddEntryModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEntrySubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Entry Type</label>
                <select
                  value={newEntry.type}
                  onChange={e => setNewEntry({ ...newEntry, type: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white font-bold"
                >
                  <option value="DEBTOR">Customer Credit Account (Debtor)</option>
                  <option value="PREPAYMENT">Customer Advance Deposit (Store Credit)</option>
                  <option value="CREDITOR">Supplier Purchase Invoice (Creditor)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Party / Company Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Mukasa Construction Ltd"
                  value={newEntry.name}
                  onChange={e => setNewEntry({ ...newEntry, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+256 700 000 000"
                    value={newEntry.phone}
                    onChange={e => setNewEntry({ ...newEntry, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {newEntry.type === 'PREPAYMENT' ? 'Prepayment Deposit' : 'Initial Balance'} ({currency})
                  </label>
                  <input
                    required={newEntry.type === 'PREPAYMENT'}
                    type="number"
                    step="any"
                    placeholder="0"
                    value={newEntry.amount}
                    onChange={e => setNewEntry({ ...newEntry, amount: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddEntryModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl shadow-xs"
                >
                  {isPending ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AuditDrawer
        entity={auditEntity}
        transactions={auditTransactions}
        onClose={() => setAuditEntity(null)}
        currency={currency}
      />

      <ReceiptModal
        receipt={generatedReceipt}
        onClose={() => setGeneratedReceipt(null)}
        currency={currency}
      />
    </div>
  );
}
