'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useApp } from '@/components/AppProvider';
import { getSuppliers, createSupplier, recordStockPurchase, recordSupplierPayment, getPurchases } from '@/actions/suppliers';
import { getProducts } from '@/actions/products';
import { Supplier, Purchase, Product } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import {
  Truck,
  Plus,
  CreditCard,
  Building2,
  Phone,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export default function PurchasesPage() {
  const { currency, userRole } = useApp();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<Supplier | null>(null);

  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    purchaseNumber: '',
    amountPaid: '',
    paymentMethod: 'Cash',
    items: [{ productId: '', quantity: '10', unitCost: '' }],
    notes: '',
  });

  const [newSup, setNewSup] = useState({
    name: '',
    phone: '',
    email: '',
    contactPerson: '',
    initialBalance: '',
  });

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Mobile Money' | 'Bank Transfer'>('Cash');
  const [payNote, setPayNote] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [supList, purList, prodList] = await Promise.all([
        getSuppliers(),
        getPurchases(),
        getProducts(),
      ]);
      setSuppliers(supList);
      setPurchases(purList);
      setProducts(prodList);

      if (supList.length > 0 && !purchaseForm.supplierId) {
        setPurchaseForm(prev => ({
          ...prev,
          supplierId: supList[0].id,
          purchaseNumber: `PO-${Date.now().toString().slice(-6)}`,
        }));
      }
    } catch (err) {
      console.error('Failed to load purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCreditorDebt = suppliers.reduce((sum, s) => sum + (s.balance_due || 0), 0);

  const handleAddPurchaseLine = () => {
    setPurchaseForm({
      ...purchaseForm,
      items: [...purchaseForm.items, { productId: products[0]?.id || '', quantity: '10', unitCost: '' }],
    });
  };

  const handleRemovePurchaseLine = (idx: number) => {
    setPurchaseForm({
      ...purchaseForm,
      items: purchaseForm.items.filter((_, i) => i !== idx),
    });
  };

  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const sup = suppliers.find(s => s.id === purchaseForm.supplierId);
    if (!sup) {
      setErrorMsg('Please select a supplier');
      return;
    }

    const formattedItems = purchaseForm.items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      const cost = parseFloat(item.unitCost) || (prod ? prod.cost_price : 0);
      return {
        productId: item.productId || (products[0]?.id ?? ''),
        quantity: parseFloat(item.quantity) || 1,
        unitCost: cost,
      };
    });

    startTransition(async () => {
      const res = await recordStockPurchase({
        supplierId: sup.id,
        supplierName: sup.name,
        purchaseNumber: purchaseForm.purchaseNumber || `PO-${Date.now().toString().slice(-6)}`,
        amountPaid: parseFloat(purchaseForm.amountPaid) || 0,
        paymentMethod: purchaseForm.paymentMethod,
        items: formattedItems,
        notes: purchaseForm.notes,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to record stock purchase');
        return;
      }

      setShowNewPurchaseModal(false);
      loadData();
    });
  };

  const handleAddSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const res = await createSupplier({
        name: newSup.name,
        phone: newSup.phone,
        email: newSup.email,
        contactPerson: newSup.contactPerson,
        initialBalance: parseFloat(newSup.initialBalance) || 0,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to create supplier');
        return;
      }

      setShowAddSupplierModal(false);
      setNewSup({ name: '', phone: '', email: '', contactPerson: '', initialBalance: '' });
      loadData();
    });
  };

  const handlePaySupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal) return;
    setErrorMsg(null);

    startTransition(async () => {
      const res = await recordSupplierPayment({
        supplierId: showPayModal.id,
        amount: parseFloat(payAmount) || 0,
        paymentMethod: payMethod,
        note: payNote,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to record payment');
        return;
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Purchases & Suppliers</h1>
          <p className="text-xs sm:text-sm text-slate-500">Inbound supplier shipments, product restock, and creditor balances</p>
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
            onClick={() => setShowAddSupplierModal(true)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-lg text-xs sm:text-sm transition border border-slate-300"
          >
            + Supplier
          </button>
          <button
            onClick={() => setShowNewPurchaseModal(true)}
            className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs sm:text-sm transition shadow-xs flex items-center space-x-1"
          >
            <Truck className="w-4 h-4" />
            <span>+ Record Stock PO</span>
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
        <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Suppliers</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{suppliers.length}</p>
          <span className="text-xs text-slate-500">Registered hardware vendors</span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Purchase Orders</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{purchases.length}</p>
          <span className="text-xs text-slate-500">Inbound inventory receipts</span>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">We Owe Suppliers (Creditors)</span>
          <p className="text-2xl font-black text-red-600 mt-1">{formatCurrency(totalCreditorDebt, currency)}</p>
          <span className="text-xs text-red-600 font-semibold">Unsettled purchase invoices</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Building2 className="w-4 h-4 text-amber-500" />
              <span>Suppliers & Creditor Accounts</span>
            </h2>
            <button
              onClick={() => setShowAddSupplierModal(true)}
              className="text-xs font-bold text-amber-600 hover:text-amber-700"
            >
              + Add
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading suppliers...</div>
            ) : suppliers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">No suppliers recorded. Click + Add Supplier.</div>
            ) : (
              suppliers.map((s) => (
                <div key={s.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                    <div className="text-slate-500 flex items-center space-x-2 mt-0.5">
                      <span>{s.phone || 'No phone'}</span>
                      {s.contact_person && <span>· Attn: {s.contact_person}</span>}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-[11px] text-slate-500">Balance Owed:</div>
                    <div className={`font-black text-sm ${s.balance_due > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {formatCurrency(s.balance_due, currency)}
                    </div>
                    {s.balance_due > 0 && (
                      <button
                        onClick={() => { setShowPayModal(s); setPayAmount(String(s.balance_due)); }}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2.5 py-1 rounded text-xs transition shadow-xs inline-flex items-center space-x-1"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Pay</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <Truck className="w-4 h-4 text-amber-500" />
              <span>Purchase Invoices History</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Automatic stock increase</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Loading purchase history...</div>
            ) : purchases.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">No stock purchases recorded yet.</div>
            ) : (
              purchases.map((p) => (
                <div key={p.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                      <span>{p.purchase_number}</span>
                      <span className="text-slate-400 font-normal">({p.supplier_name})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Received: {formatDateTime(p.created_at)} · Paid: {formatCurrency(p.amount_paid, currency)}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="font-black text-slate-900 text-sm">{formatCurrency(p.total_amount, currency)}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold inline-block ${
                      p.payment_status === 'PAID'
                        ? 'bg-green-100 text-green-800'
                        : p.payment_status === 'PARTIAL'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {p.payment_status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showNewPurchaseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 my-8 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center space-x-2">
                <Truck className="w-5 h-5 text-amber-500" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Record Inbound Stock Purchase</h3>
              </div>
              <button onClick={() => setShowNewPurchaseModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="space-y-3.5 text-xs sm:text-sm max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier *</label>
                  <select
                    value={purchaseForm.supplierId}
                    onChange={e => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white font-semibold"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PO / Invoice Number *</label>
                  <input
                    required
                    type="text"
                    value={purchaseForm.purchaseNumber}
                    onChange={e => setPurchaseForm({ ...purchaseForm, purchaseNumber: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-xs">Products Being Received:</span>
                  <button
                    type="button"
                    onClick={handleAddPurchaseLine}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700"
                  >
                    + Add Product Line
                  </button>
                </div>

                {purchaseForm.items.map((line, idx) => {
                  const selProd = products.find(p => p.id === line.productId);
                  return (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <select
                          value={line.productId}
                          onChange={e => {
                            const newItems = [...purchaseForm.items];
                            newItems[idx].productId = e.target.value;
                            const pr = products.find(p => p.id === e.target.value);
                            if (pr) newItems[idx].unitCost = String(pr.cost_price);
                            setPurchaseForm({ ...purchaseForm, items: newItems });
                          }}
                          className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-semibold"
                        >
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                        {purchaseForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePurchaseLine(idx)}
                            className="text-red-500 font-bold ml-2 p-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold">Qty Received ({selProd?.unit || 'pcs'})</label>
                          <input
                            required
                            type="number"
                            step="any"
                            value={line.quantity}
                            onChange={e => {
                              const newItems = [...purchaseForm.items];
                              newItems[idx].quantity = e.target.value;
                              setPurchaseForm({ ...purchaseForm, items: newItems });
                            }}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold">Unit Cost Price ({currency})</label>
                          <input
                            required
                            type="number"
                            step="any"
                            placeholder={selProd ? String(selProd.cost_price) : '0'}
                            value={line.unitCost}
                            onChange={e => {
                              const newItems = [...purchaseForm.items];
                              newItems[idx].unitCost = e.target.value;
                              setPurchaseForm({ ...purchaseForm, items: newItems });
                            }}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-bold font-mono text-amber-700"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid Immediately ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={purchaseForm.amountPaid}
                    onChange={e => setPurchaseForm({ ...purchaseForm, amountPaid: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={purchaseForm.paymentMethod}
                    onChange={e => setPurchaseForm({ ...purchaseForm, paymentMethod: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Mobile Money">MTN / Airtel Mobile Money</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewPurchaseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl shadow-xs flex items-center space-x-1"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save PO & Restock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Supplier Account</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplierSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Company Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Uganda Baati Ltd"
                  value={newSup.name}
                  onChange={e => setNewSup({ ...newSup, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+256 700 000 000"
                    value={newSup.phone}
                    onChange={e => setNewSup({ ...newSup, phone: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Joseph Kato"
                    value={newSup.contactPerson}
                    onChange={e => setNewSup({ ...newSup, contactPerson: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Initial Balance Owed ({currency})</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={newSup.initialBalance}
                  onChange={e => setNewSup({ ...newSup, initialBalance: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl shadow-xs"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-2.5">
              <h3 className="text-base font-bold text-slate-900">Pay Supplier: {showPayModal.name}</h3>
              <button onClick={() => setShowPayModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaySupplierSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-500">Current Balance Owed</label>
                <div className="text-xl font-black text-red-600 mt-1">{formatCurrency(showPayModal.balance_due, currency)}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Amount ({currency}) *</label>
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
                  Confirm Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
