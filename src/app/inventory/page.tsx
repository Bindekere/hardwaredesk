'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useApp } from '@/components/AppProvider';
import { getProducts, createProduct, adjustStock, getProductMovements } from '@/actions/products';
import { Product, InventoryMovement, MovementType } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import {
  Search,
  Plus,
  Sliders,
  History,
  AlertTriangle,
  Package,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export default function InventoryPage() {
  const { currency, userRole } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState<Product | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<{ product: Product; movements: InventoryMovement[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [newProd, setNewProd] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryName: 'Building Materials',
    unit: 'pcs',
    costPrice: '',
    sellingPrice: '',
    initialStock: '',
    minimumStock: '5',
    location: 'Main Store',
  });

  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState<MovementType>('MANUAL_ADJUSTMENT');
  const [adjustNotes, setAdjustNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category_name || 'General')))];

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.location && p.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || (p.category_name || 'General') === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getStockBadge = (stock: number, min: number) => {
    if (stock <= 0) {
      return <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">OUT OF STOCK</span>;
    }
    if (stock <= min) {
      return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">LOW STOCK</span>;
    }
    return <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">IN STOCK</span>;
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    startTransition(async () => {
      const res = await createProduct({
        name: newProd.name,
        sku: newProd.sku,
        barcode: newProd.barcode || null,
        categoryName: newProd.categoryName,
        unit: newProd.unit,
        costPrice: parseFloat(newProd.costPrice) || 0,
        sellingPrice: parseFloat(newProd.sellingPrice) || 0,
        initialStock: parseFloat(newProd.initialStock) || 0,
        minimumStock: parseFloat(newProd.minimumStock) || 5,
        location: newProd.location,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to save product');
        return;
      }

      setShowAddModal(false);
      setNewProd({
        name: '',
        sku: '',
        barcode: '',
        categoryName: 'Building Materials',
        unit: 'pcs',
        costPrice: '',
        sellingPrice: '',
        initialStock: '',
        minimumStock: '5',
        location: 'Main Store',
      });
      loadData();
    });
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustModal) return;
    setErrorMsg(null);

    const delta = parseFloat(adjustDelta) || 0;
    if (delta === 0) {
      setErrorMsg('Quantity change cannot be 0');
      return;
    }

    startTransition(async () => {
      const res = await adjustStock({
        productId: showAdjustModal.id,
        quantityDelta: delta,
        reason: adjustReason,
        performedBy: userRole,
        notes: adjustNotes,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to apply adjustment');
        return;
      }

      setShowAdjustModal(null);
      setAdjustDelta('');
      setAdjustNotes('');
      loadData();
    });
  };

  const handleOpenHistory = async (p: Product) => {
    const movements = await getProductMovements(p.id);
    setShowHistoryModal({ product: p, movements });
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Inventory & Products</h1>
          <p className="text-xs sm:text-sm text-slate-500">Database-backed catalog, warehouse locations & stock movements</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {userRole !== 'CASHIER' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs sm:text-sm transition shadow-xs flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Product</span>
            </button>
          )}
        </div>
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

      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Filter by Product Name, SKU, Barcode, Bin Location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pl-9 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 text-[11px] sm:text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 sm:px-4">SKU / Barcode</th>
                <th className="py-3 px-3 sm:px-4">Product Name</th>
                <th className="py-3 px-3 sm:px-4">Category</th>
                <th className="py-3 px-3 sm:px-4 text-center">Stock</th>
                <th className="py-3 px-3 sm:px-4 text-right">Cost Price</th>
                <th className="py-3 px-3 sm:px-4 text-right">Selling Price</th>
                <th className="py-3 px-3 sm:px-4">Location</th>
                <th className="py-3 px-3 sm:px-4">Status</th>
                <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    Loading inventory catalog from Supabase...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    No products matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 sm:px-4">
                      <div className="font-mono text-xs font-bold text-slate-900">{p.sku}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.barcode || 'No barcode'}</div>
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-bold text-slate-900 min-w-[160px]">
                      {p.name}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-600 whitespace-nowrap text-xs">
                      {p.category_name}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-center font-black text-slate-900 whitespace-nowrap">
                      {p.current_stock} <span className="text-xs text-slate-400 font-normal">{p.unit}</span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right text-slate-600 whitespace-nowrap">
                      {formatCurrency(p.cost_price, currency)}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right font-black text-amber-600 whitespace-nowrap">
                      {formatCurrency(p.selling_price, currency)}
                    </td>
                    <td className="py-3 px-3 sm:px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                      📍 {p.location}
                    </td>
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      {getStockBadge(p.current_stock, p.minimum_stock)}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right space-x-1 whitespace-nowrap">
                      {userRole !== 'CASHIER' && (
                        <button
                          onClick={() => setShowAdjustModal(p)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded-lg text-xs font-semibold transition border border-slate-300 inline-flex items-center space-x-1"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Adjust</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenHistory(p)}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs font-semibold transition border border-slate-200"
                        title="View Movement History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 my-8 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-amber-500" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Add New Hardware Product</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-3.5 text-xs sm:text-sm max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Tororo Portland Cement 50kg"
                  value={newProd.name}
                  onChange={e => setNewProd({ ...newProd, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKU / Code *</label>
                  <input
                    required
                    type="text"
                    placeholder="CEM-001"
                    value={newProd.sku}
                    onChange={e => setNewProd({ ...newProd, sku: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Barcode (Optional)</label>
                  <input
                    type="text"
                    placeholder="600123456..."
                    value={newProd.barcode}
                    onChange={e => setNewProd({ ...newProd, barcode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newProd.categoryName}
                    onChange={e => setNewProd({ ...newProd, categoryName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white"
                  >
                    <option value="Building Materials">Building Materials</option>
                    <option value="Plumbing & Pipes">Plumbing & Pipes</option>
                    <option value="Roofing & Timber">Roofing & Timber</option>
                    <option value="Fasteners & Nails">Fasteners & Nails</option>
                    <option value="Paints & Finishes">Paints & Finishes</option>
                    <option value="Electrical & Lighting">Electrical & Lighting</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit of Measure</label>
                  <select
                    value={newProd.unit}
                    onChange={e => setNewProd({ ...newProd, unit: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white font-semibold"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="bags">Bags (bags)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="meters">Meters (m)</option>
                    <option value="litres">Litres (L)</option>
                    <option value="rolls">Rolls (rolls)</option>
                    <option value="boxes">Boxes (boxes)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cost Price ({currency})</label>
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="32000"
                    value={newProd.costPrice}
                    onChange={e => setNewProd({ ...newProd, costPrice: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selling Price ({currency})</label>
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="36500"
                    value={newProd.sellingPrice}
                    onChange={e => setNewProd({ ...newProd, sellingPrice: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold text-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Stock</label>
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="100"
                    value={newProd.initialStock}
                    onChange={e => setNewProd({ ...newProd, initialStock: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Stock Alert</label>
                  <input
                    required
                    type="number"
                    step="any"
                    placeholder="10"
                    value={newProd.minimumStock}
                    onChange={e => setNewProd({ ...newProd, minimumStock: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Storage Location</label>
                  <input
                    type="text"
                    placeholder="Yard-Bay 1"
                    value={newProd.location}
                    onChange={e => setNewProd({ ...newProd, location: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdjustModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Adjust Stock Quantity</h3>
                <p className="text-xs text-slate-500">{showAdjustModal.name} (Current: {showAdjustModal.current_stock} {showAdjustModal.unit})</p>
              </div>
              <button onClick={() => setShowAdjustModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity Delta (+ to Add, - to Deduct)
                </label>
                <input
                  required
                  type="number"
                  step="any"
                  placeholder="e.g. -5 for broken / +10 for found"
                  value={adjustDelta}
                  onChange={e => setAdjustDelta(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-black"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment Reason</label>
                <select
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white font-semibold"
                >
                  <option value="DAMAGE">DAMAGE (Damaged in transport/handling)</option>
                  <option value="LOSS">LOSS (Miscounted / Missing)</option>
                  <option value="THEFT">THEFT (Reported shrinkage)</option>
                  <option value="RETURN">RETURN (Returned to supplier / customer return)</option>
                  <option value="MANUAL_ADJUSTMENT">MANUAL ADJUSTMENT (Audit correction)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Audit Notes</label>
                <input
                  type="text"
                  placeholder="e.g. 2 bags burst in rain"
                  value={adjustNotes}
                  onChange={e => setAdjustNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(null)}
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
                  <span>Apply Movement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">{showHistoryModal.product.name}</h3>
                <p className="text-xs text-slate-400">Inventory Movement Ledger (SKU: {showHistoryModal.product.sku})</p>
              </div>
              <button onClick={() => setShowHistoryModal(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 divide-y divide-slate-100 text-xs">
              {showHistoryModal.movements.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No recorded movements for this product.</div>
              ) : (
                showHistoryModal.movements.map((m) => (
                  <div key={m.id} className="py-2.5 flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-800 flex items-center space-x-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                          m.movement_type === 'SALE' ? 'bg-red-100 text-red-800' :
                          m.movement_type === 'PURCHASE' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {m.movement_type}
                        </span>
                        <span>{m.quantity > 0 ? `+${m.quantity}` : m.quantity} units</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{formatDateTime(m.created_at)} · By {m.performed_by}</div>
                      {m.reason && <div className="text-[11px] text-slate-600 italic">{m.reason}</div>}
                    </div>
                    <div className="text-right text-slate-600 text-[11px] font-mono">
                      <div>Prev: {m.previous_stock}</div>
                      <div className="font-bold text-slate-900">New: {m.new_stock}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(null)}
                className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
