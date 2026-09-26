'use client';

import React, { useState, useEffect, useRef, useTransition, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { getProducts } from '@/actions/products';
import { getCustomers } from '@/actions/customers';
import { executeSale } from '@/actions/sales';
import { Product, Customer, CartItem, Receipt, PaymentMethod } from '@/lib/types';
import { formatCurrency, formatQuantity, parseFractionOrDecimal } from '@/lib/formatters';
import ReceiptModal from '@/components/ReceiptModal';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  CreditCard,
  User,
  AlertCircle,
  Loader2,
  RefreshCw,
  LayoutGrid,
  List,
} from 'lucide-react';

function QuickSalesTerminal() {
  const { currency, userRole } = useApp();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [completedReceipt, setCompletedReceipt] = useState<Receipt | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const clearCart = () => {
    setCart([]);
    setDiscountAmount('0');
    setErrorMessage(null);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, custs] = await Promise.all([getProducts(), getCustomers()]);
      setProducts(prods);
      setCustomers(custs);
    } catch (err) {
      console.error('Failed to load products/customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let buffer = '';
    let timer: NodeJS.Timeout | null = null;
    const handleKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          setSearch(buffer);
          if (searchRef.current) searchRef.current.focus();
        }
        buffer = '';
        if (timer) clearTimeout(timer);
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { buffer = ''; }, 120);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const availableStoreCredit = selectedCustomer ? selectedCustomer.store_credit : 0;

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category_name || 'General')))];

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || (p.category_name || 'General') === selectedCategory;
    if (!search.trim()) return matchesCategory;
    const s = search.toLowerCase();
    const matchesSearch = (
      p.name.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s) ||
      (p.barcode && p.barcode.toLowerCase().includes(s)) ||
      (p.category_name && p.category_name.toLowerCase().includes(s))
    );
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    setErrorMessage(null);
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.current_stock) {
        setErrorMessage(`Cannot add more: only ${product.current_stock} units available in stock.`);
        return;
      }
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      if (product.current_stock <= 0) {
        setErrorMessage(`Product ${product.name} is currently out of stock.`);
        return;
      }
      setCart([...cart, {
        id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        cost_price: product.cost_price,
        selling_price: product.selling_price,
        current_stock: product.current_stock,
        quantity: 1,
        discount: 0,
      }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setErrorMessage(null);
    setCart(cart.map(item => {
      if (item.id === id) {
        const targetProd = products.find(p => p.id === id);
        const maxStock = targetProd ? targetProd.current_stock : item.current_stock;
        const newQty = Math.round((item.quantity + delta) * 1000) / 1000;
        if (newQty > maxStock) {
          setErrorMessage(`Max stock reached (${formatQuantity(maxStock)} units) for ${item.name}`);
          return item;
        }
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const setDirectQuantity = (id: string, rawVal: string | number) => {
    setErrorMessage(null);
    const parsedQty = parseFractionOrDecimal(rawVal);
    setCart(cart.map(item => {
      if (item.id === id) {
        const targetProd = products.find(p => p.id === id);
        const maxStock = targetProd ? targetProd.current_stock : item.current_stock;
        if (parsedQty > maxStock) {
          setErrorMessage(`Max stock reached (${formatQuantity(maxStock)} units) for ${item.name}`);
          return { ...item, quantity: maxStock };
        }
        return { ...item, quantity: parsedQty > 0 ? parsedQty : 0.25 };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  const parsedDiscount = Math.max(0, parseFloat(discountAmount) || 0);
  const totalAmount = Math.max(0, subtotal - parsedDiscount);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setErrorMessage(null);

    if (paymentMethod === 'Store Credit') {
      if (!selectedCustomerId) {
        setErrorMessage('Please select a customer to use Store Credit.');
        return;
      }
      if (availableStoreCredit < totalAmount) {
        setErrorMessage(`Insufficient Store Credit: Customer has ${formatCurrency(availableStoreCredit, currency)}, but total is ${formatCurrency(totalAmount, currency)}.`);
        return;
      }
    }

    startTransition(async () => {
      const idempotencyKey = `sale-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const result = await executeSale({
        customerId: selectedCustomerId || null,
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
        paymentMethod,
        amountPaid: paymentMethod === 'Credit' ? 0 : totalAmount,
        discountAmount: parsedDiscount,
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.selling_price,
        })),
        idempotencyKey,
        cashierName: userRole,
      });

      if (!result.success || !result.receipt) {
        setErrorMessage(result.error || 'Checkout failed. Please review stock quantities.');
        return;
      }

      setCompletedReceipt(result.receipt);
      setCart([]);
      setDiscountAmount('0');
      setMobileCartOpen(false);
      loadData();
    });
  };

  return (
    <div className="h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-6.5rem)] flex flex-col space-y-2.5 max-w-7xl mx-auto pb-14 lg:pb-0 overflow-hidden">
      {/* 1. TOP TOOLBAR: Search, Category Filter Chips, View Toggle, Reset */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl shadow-2xs border border-slate-200 space-y-2 shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <input
              ref={searchRef}
              type="text"
              placeholder="🔍 Scan barcode, SKU, or search item name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 pl-8 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white transition"
              autoFocus
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          {/* Right actions: View mode switch, Reset, Found items badge */}
          <div className="flex items-center space-x-1.5 shrink-0 justify-between sm:justify-end">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded-md text-xs font-semibold transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded-md text-xs font-semibold transition ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Dense List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setSearch(''); setSelectedCategory('ALL'); loadData(); }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1"
              title="Reset Filters"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden xs:inline">Reset</span>
            </button>

            <span className="text-[11px] font-bold bg-amber-100 text-amber-900 px-2 py-1 rounded-lg whitespace-nowrap">
              {filteredProducts.length} items
            </span>
          </div>
        </div>

        {/* Category Pills (horizontal scrollable) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-500 font-bold p-1">✕</button>
        </div>
      )}

      {/* 2. MAIN WORKSPACE: Products Catalog (Left) + Pinned Cart (Right) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 overflow-hidden">
        {/* Left Column: Scrollable Catalog */}
        <div className="lg:col-span-2 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              <span>Connecting to database catalog...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs p-8 text-center space-y-1">
              <Search className="w-6 h-6 text-slate-300" />
              <p>No products found matching your filter.</p>
              <button
                type="button"
                onClick={() => { setSearch(''); setSelectedCategory('ALL'); }}
                className="text-amber-600 font-bold hover:underline text-xs mt-1"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.current_stock <= 0;
                    const isLowStock = p.current_stock <= p.minimum_stock && !isOutOfStock;
                    const inCart = cart.find(i => i.id === p.id);

                    return (
                      <div
                        key={p.id}
                        onClick={() => !isOutOfStock && addToCart(p)}
                        className={`rounded-xl border p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between transition select-none ${
                          isOutOfStock
                            ? 'opacity-50 border-slate-200 bg-slate-50 cursor-not-allowed'
                            : 'bg-white hover:border-amber-400 hover:shadow-xs active:scale-[0.99] cursor-pointer border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <div className="flex-1 min-w-0 pr-1">
                              <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-tight line-clamp-2" title={p.name}>
                                {p.name}
                              </h3>
                              <div className="flex items-center space-x-1.5 mt-1">
                                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {p.sku}
                                </span>
                                {p.location && (
                                  <span className="text-[10px] text-slate-400 truncate max-w-[90px]">📍 {p.location}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs sm:text-sm font-black text-amber-600 block">
                                {formatCurrency(p.selling_price, currency)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className={`text-[11px] font-bold ${
                            isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            Stock: {formatQuantity(p.current_stock)} {p.unit}
                          </span>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                              inCart
                                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            <span>{inCart ? `${formatQuantity(inCart.quantity)}` : 'Add'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs">
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.current_stock <= 0;
                    const isLowStock = p.current_stock <= p.minimum_stock && !isOutOfStock;
                    const inCart = cart.find(i => i.id === p.id);

                    return (
                      <div
                        key={p.id}
                        onClick={() => !isOutOfStock && addToCart(p)}
                        className={`px-3 py-2 flex items-center justify-between gap-2 hover:bg-amber-50/60 cursor-pointer transition select-none ${
                          isOutOfStock ? 'opacity-40 bg-slate-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                          <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                            {p.sku}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 text-xs truncate" title={p.name}>{p.name}</div>
                            <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                              <span>{p.category_name}</span>
                              {p.barcode && <span>• {p.barcode}</span>}
                              {p.location && <span>• 📍 {p.location}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <span className={`text-[11px] font-bold ${
                            isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-slate-600'
                          }`}>
                            {formatQuantity(p.current_stock)} {p.unit}
                          </span>
                          <span className="font-extrabold text-amber-600 text-xs min-w-[70px] text-right">
                            {formatCurrency(p.selling_price, currency)}
                          </span>
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                              inCart
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            <span>{inCart ? `${formatQuantity(inCart.quantity)}` : 'Add'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Pinned Desktop Cart */}
        <div className="hidden lg:flex flex-col min-h-0 bg-white rounded-xl shadow-2xs border border-slate-200 p-3.5 justify-between overflow-hidden">
          <div className="flex flex-col min-h-0 flex-1">
            <div className="flex items-center justify-between border-b pb-2.5 shrink-0">
              <div className="flex items-center space-x-1.5">
                <ShoppingCart className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Sale Terminal Cart
                </h2>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                  {formatQuantity(totalItemCount)} items
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-red-500 hover:text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-red-50 transition"
                    title="Clear Cart"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5 flex-1 overflow-y-auto min-h-0 pr-1 divide-y divide-slate-100 my-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs space-y-1 p-6">
                  <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-500">Cart is empty</p>
                  <p className="text-[11px] text-slate-400">Click products or scan barcodes to begin sale</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="pt-2 pb-2 border-b border-slate-100 last:border-b-0 space-y-1 text-xs">
                    <div className="flex justify-between items-start">
                      <div className="pr-1 flex-1 min-w-0">
                        <div className="font-bold text-slate-800 leading-tight truncate" title={item.name}>{item.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {formatCurrency(item.selling_price, currency)} / {item.unit}
                        </div>
                      </div>
                      <div className="text-right font-black text-slate-900 shrink-0 text-xs">
                        {formatCurrency(item.selling_price * item.quantity, currency)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      {/* Fraction quick preset chips */}
                      <div className="flex items-center space-x-0.5">
                        {[0.25, 0.5, 0.75, 1].map((fracVal) => (
                          <button
                            key={fracVal}
                            type="button"
                            onClick={() => setDirectQuantity(item.id, fracVal)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                              item.quantity === fracVal
                                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                            title={`Set to ${formatQuantity(fracVal)}`}
                          >
                            {formatQuantity(fracVal)}
                          </button>
                        ))}
                      </div>

                      {/* Stepper + direct fraction input */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -0.5)}
                          className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center font-bold text-slate-700 text-xs"
                          title="Decrease by ½"
                        >
                          -
                        </button>
                        <input
                          type="text"
                          defaultValue={formatQuantity(item.quantity)}
                          key={`${item.id}-${item.quantity}`}
                          onBlur={(e) => setDirectQuantity(item.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-11 h-5 text-center font-mono font-bold text-[11px] border border-slate-300 rounded bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none"
                          placeholder="1/2"
                          title="Type quantity or fraction e.g. 1/2, 1/4, 2.5"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 0.5)}
                          className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center font-bold text-slate-700 text-xs"
                          title="Increase by ½"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-400 hover:text-red-600 p-0.5 ml-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t pt-2 space-y-2 shrink-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center space-x-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Customer</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.store_credit > 0 ? `(${formatCurrency(c.store_credit, currency)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5 flex items-center space-x-1">
                  <CreditCard className="w-3 h-3 text-slate-400" />
                  <span>Payment Method</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-semibold"
                >
                  <option value="Cash">Cash (Immediate)</option>
                  <option value="Mobile Money">MTN / Airtel Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  {availableStoreCredit > 0 && (
                    <option value="Store Credit">Store Credit ({formatCurrency(availableStoreCredit, currency)})</option>
                  )}
                  <option value="Credit">Customer Credit (Account)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-slate-600 text-[11px] font-medium">Discount ({currency}):</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                className="w-24 border border-slate-300 rounded px-2 py-0.5 text-right text-xs font-mono font-bold"
              />
            </div>

            <div className="pt-1.5 border-t space-y-0.5">
              <div className="flex justify-between items-center text-[11px] text-slate-500">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-sm sm:text-base font-black text-slate-900">
                <span>Total Due:</span>
                <span className="text-amber-600">{formatCurrency(totalAmount, currency)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={cart.length === 0 || isPending}
              className={`w-full py-2.5 rounded-xl font-black text-xs sm:text-sm transition shadow-xs flex items-center justify-center space-x-1.5 ${
                cart.length > 0 && !isPending
                  ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                  <span>Processing Sale...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Sale ({formatCurrency(totalAmount, currency)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900 text-white p-3 z-30 flex items-center justify-between shadow-2xl border-t border-slate-800">
        <div>
          <div className="text-xs text-slate-400">{totalItemCount} items in cart</div>
          <div className="text-base font-black text-amber-400">{formatCurrency(totalAmount, currency)}</div>
        </div>
        <button
          onClick={() => setMobileCartOpen(true)}
          disabled={cart.length === 0}
          className={`px-4 py-2 rounded-lg font-bold text-xs transition ${
            cart.length > 0 ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-slate-700 text-slate-400'
          }`}
        >
          View Cart & Pay 🛒
        </button>
      </div>

      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-2xl p-4 max-h-[85vh] flex flex-col justify-between shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <span className="font-bold text-slate-900 text-sm">Cart ({totalItemCount} items)</span>
              <button onClick={() => setMobileCartOpen(false)} className="text-slate-400 font-bold p-1">✕</button>
            </div>
            <div className="overflow-y-auto space-y-2 max-h-48 divide-y divide-slate-100">
              {cart.map(item => (
                <div key={item.id} className="pt-2.5 pb-2 border-b border-slate-100 space-y-1.5 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-slate-500">{formatCurrency(item.selling_price, currency)} / {item.unit}</div>
                    </div>
                    <div className="font-black text-slate-900">
                      {formatCurrency(item.selling_price * item.quantity, currency)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center space-x-1">
                      {[0.25, 0.5, 0.75, 1].map((fracVal) => (
                        <button
                          key={fracVal}
                          type="button"
                          onClick={() => setDirectQuantity(item.id, fracVal)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            item.quantity === fracVal ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {formatQuantity(fracVal)}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button onClick={() => updateQuantity(item.id, -0.5)} className="w-5 h-5 bg-slate-100 rounded font-bold text-xs">-</button>
                      <input
                        type="text"
                        defaultValue={formatQuantity(item.quantity)}
                        key={`m-${item.id}-${item.quantity}`}
                        onBlur={(e) => setDirectQuantity(item.id, e.target.value)}
                        className="w-12 h-6 text-center font-mono font-bold text-xs border border-slate-300 rounded bg-white"
                      />
                      <button onClick={() => updateQuantity(item.id, 0.5)} className="w-5 h-5 bg-slate-100 rounded font-bold text-xs">+</button>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 space-y-2 mt-3">
              <div className="flex justify-between font-black text-base text-slate-900">
                <span>Total Due:</span>
                <span className="text-amber-600">{formatCurrency(totalAmount, currency)}</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={isPending}
                className="w-full py-3 bg-amber-500 text-slate-950 font-black rounded-xl text-xs sm:text-sm"
              >
                {isPending ? 'Committing...' : `Complete Sale (${formatCurrency(totalAmount, currency)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptModal
        receipt={completedReceipt}
        onClose={() => setCompletedReceipt(null)}
        currency={currency}
      />
    </div>
  );
}

export default function QuickSalesPage() {
  return (
    <Suspense fallback={
      <div className="py-20 text-center text-slate-400 text-sm flex items-center justify-center space-x-2">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Loading Quick Sales Terminal...</span>
      </div>
    }>
      <QuickSalesTerminal />
    </Suspense>
  );
}
