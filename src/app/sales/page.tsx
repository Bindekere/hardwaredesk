'use client';

import React, { useState, useEffect, useRef, useTransition, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppProvider';
import { getProducts } from '@/actions/products';
import { getCustomers } from '@/actions/customers';
import { executeSale } from '@/actions/sales';
import { Product, Customer, CartItem, Receipt, PaymentMethod } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
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
} from 'lucide-react';

function QuickSalesTerminal() {
  const { currency, userRole } = useApp();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState(initialQuery);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [completedReceipt, setCompletedReceipt] = useState<Receipt | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const filteredProducts = products.filter(p => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(s) ||
      p.sku.toLowerCase().includes(s) ||
      (p.barcode && p.barcode.toLowerCase().includes(s)) ||
      (p.category_name && p.category_name.toLowerCase().includes(s))
    );
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
        const newQty = item.quantity + delta;
        if (newQty > maxStock) {
          setErrorMessage(`Max stock reached (${maxStock} units) for ${item.name}`);
          return item;
        }
        return newQty > 0 ? { ...item, quantity: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
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
    <div className="space-y-4 max-w-7xl mx-auto pb-16 lg:pb-0">
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <input
            ref={searchRef}
            type="text"
            placeholder="🔍 Scan barcode, SKU, or search item name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 pl-9 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white transition"
            autoFocus
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => { setSearch(''); loadData(); }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg text-xs transition flex items-center space-x-1"
            title="Reset Filters"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-1.5 rounded-lg">
            {filteredProducts.length} items found
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 font-bold p-1">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span>Connecting to database catalog...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs sm:text-sm">
              No products found matching "{search}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.current_stock <= 0;
                const isLowStock = p.current_stock <= p.minimum_stock && !isOutOfStock;
                const inCart = cart.find(i => i.id === p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`bg-white rounded-xl border p-3.5 shadow-xs flex flex-col justify-between transition relative select-none ${
                      isOutOfStock
                        ? 'opacity-50 border-slate-200 bg-slate-50 cursor-not-allowed'
                        : 'hover:border-amber-500 hover:shadow-sm active:scale-[0.99] cursor-pointer border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="pr-2">
                          <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">{p.name}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {p.sku}
                            </span>
                            <span className="text-[10px] text-slate-400">📍 {p.location}</span>
                          </div>
                        </div>
                        <span className="text-sm sm:text-base font-extrabold text-amber-600 shrink-0">
                          {formatCurrency(p.selling_price, currency)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className={`font-bold ${
                        isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        Stock: {p.current_stock} {p.unit}
                      </span>
                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                          inCart
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{inCart ? `${inCart.quantity} in Cart` : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden lg:flex bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex-col justify-between min-h-[580px] sticky top-20">
          <div>
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Sale Terminal Cart
                </h2>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs space-y-1">
                  <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>Cart is empty.</p>
                  <p className="text-[11px] text-slate-400">Click products or scan barcodes on the left.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="pt-2 flex justify-between items-center text-xs">
                    <div className="pr-2 flex-1">
                      <div className="font-bold text-slate-800 leading-tight truncate max-w-[160px]">{item.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatCurrency(item.selling_price, currency)} / {item.unit}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center font-bold text-slate-700"
                      >
                        -
                      </button>
                      <span className="font-bold text-xs w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center font-bold text-slate-700"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-400 hover:text-red-600 p-1 ml-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t pt-3 space-y-3 mt-3">
            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Customer (Optional)</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.store_credit > 0 ? `(${formatCurrency(c.store_credit, currency)} Credit)` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center space-x-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Payment Channel</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white font-semibold"
                >
                  <option value="Cash">Cash (Immediate)</option>
                  <option value="Mobile Money">MTN / Airtel Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  {availableStoreCredit > 0 && (
                    <option value="Store Credit">Use Store Credit ({formatCurrency(availableStoreCredit, currency)})</option>
                  )}
                  <option value="Credit">Customer Credit Debt (Account)</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Discount Amount:</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-28 border border-slate-300 rounded px-2 py-1 text-right text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="pt-2 border-t space-y-1">
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between items-center text-base sm:text-lg font-black text-slate-900">
                <span>Total Due:</span>
                <span className="text-amber-600">{formatCurrency(totalAmount, currency)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isPending}
              className={`w-full py-3 rounded-xl font-black text-xs sm:text-sm transition shadow-sm flex items-center justify-center space-x-2 ${
                cart.length > 0 && !isPending
                  ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                  <span>Committing Transaction...</span>
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
                <div key={item.id} className="pt-2 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{item.name}</div>
                    <div className="text-slate-500">{formatCurrency(item.selling_price, currency)}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 bg-slate-100 rounded font-bold">-</button>
                    <span className="font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 bg-slate-100 rounded font-bold">+</button>
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
