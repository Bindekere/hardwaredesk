'use client';

import React, { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import { useApp } from '@/components/AppProvider';
import { getProducts, createProduct, adjustStock, getProductMovements, updateProduct, bulkImportProducts } from '@/actions/products';
import { Product, InventoryMovement, MovementType } from '@/lib/types';
import { formatCurrency, formatDateTime, formatQuantity, parseFractionOrDecimal } from '@/lib/formatters';
import * as XLSX from 'xlsx';
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
  Edit3,
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  FileText,
  Coins,
  CircleDollarSign,
  TrendingUp,
  Layers,
} from 'lucide-react';

export default function InventoryPage() {
  const { currency, userRole } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Product | null>(null);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState<Product | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<{ product: Product; movements: InventoryMovement[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    sku: '',
    barcode: '',
    categoryName: 'Building Materials',
    unit: 'pcs',
    costPrice: '',
    sellingPrice: '',
    minimumStock: '5',
    location: 'Main Store',
  });

  // Bulk Import state
  const [parsedBulkProducts, setParsedBulkProducts] = useState<any[]>([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

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

  const stockValuation = useMemo(() => {
    let totalCost = 0;
    let totalRetail = 0;
    let inStockItemsCount = 0;
    let totalUnits = 0;

    products.forEach(p => {
      const stock = Math.max(0, Number(p.current_stock || 0));
      const cost = Math.max(0, Number(p.cost_price || 0));
      const retail = Math.max(0, Number(p.selling_price || 0));

      if (stock > 0) {
        totalCost += stock * cost;
        totalRetail += stock * retail;
        inStockItemsCount += 1;
        totalUnits += stock;
      }
    });

    const potentialProfit = totalRetail - totalCost;
    const marginPercent = totalRetail > 0 ? Number(((potentialProfit / totalRetail) * 100).toFixed(1)) : 0;

    return {
      totalCost,
      totalRetail,
      potentialProfit,
      marginPercent,
      inStockItemsCount,
      totalUnits: Math.round(totalUnits * 100) / 100,
    };
  }, [products]);

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
        initialStock: parseFractionOrDecimal(newProd.initialStock) || 0,
        minimumStock: parseFractionOrDecimal(newProd.minimumStock) || 5,
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

    const delta = parseFractionOrDecimal(adjustDelta);
    if (delta === 0 || isNaN(delta)) {
      setErrorMsg('Quantity change cannot be 0 or invalid');
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

  const handleOpenEdit = (p: Product) => {
    setEditForm({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      categoryName: p.category_name || 'Building Materials',
      unit: p.unit || 'pcs',
      costPrice: String(p.cost_price || 0),
      sellingPrice: String(p.selling_price || 0),
      minimumStock: String(p.minimum_stock ?? 5),
      location: p.location || 'Main Store',
    });
    setErrorMsg(null);
    setShowEditModal(p);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setErrorMsg(null);

    startTransition(async () => {
      const res = await updateProduct({
        id: editForm.id,
        name: editForm.name,
        sku: editForm.sku,
        barcode: editForm.barcode.trim() || null,
        categoryName: editForm.categoryName,
        unit: editForm.unit,
        costPrice: parseFloat(editForm.costPrice) || 0,
        sellingPrice: parseFloat(editForm.sellingPrice) || 0,
        minimumStock: parseFractionOrDecimal(editForm.minimumStock) || 5,
        location: editForm.location,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to update product details');
        return;
      }

      setShowEditModal(null);
      loadData();
    });
  };

  const downloadSampleCSV = () => {
    const headers = ['name', 'sku', 'barcode', 'category', 'unit', 'cost_price', 'selling_price', 'current_stock', 'minimum_stock', 'location'];
    const sampleRows = [
      ['Tororo Portland Cement 50kg', 'CEM-001', '600123456001', 'Building Materials', 'bags', '32000', '36500', '100', '20', 'Yard-Bay 1'],
      ['Corrugated Iron Sheet 30G (3m Blue)', 'IRN-002', '600123456002', 'Roofing & Timber', 'pcs', '38000', '44000', '85', '15', 'Shed A-1'],
      ['PVC Pipe 2 inch (3m)', 'PVC-003', '600123456003', 'Plumbing & Pipes', 'pcs', '24000', '32000', '50', '10', 'A2-S3-B1'],
      ['Steel Wire Nails 3 inch (kg)', 'NAL-004', '600123456004', 'Fasteners & Nails', 'kg', '6000', '8500', '60', '15', 'Bin-F4'],
    ];

    const csvContent = [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'hardwaredesk_inventory_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkErrors([]);
    setImportSuccessMsg(null);

    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array' });
      
      // Auto-detect target sheet (prefer sheets with 'import', 'inventory', 'product', 'paint')
      let targetSheetName = workbook.SheetNames[0];
      for (const sName of workbook.SheetNames) {
        const lower = sName.toLowerCase();
        if (lower.includes('import') || lower.includes('inventory') || lower.includes('product') || lower.includes('paint')) {
          targetSheetName = sName;
          break;
        }
      }

      const worksheet = workbook.Sheets[targetSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (!rawRows || rawRows.length < 2) {
        setBulkErrors([`The selected sheet "${targetSheetName}" is empty or has no data rows.`]);
        setParsedBulkProducts([]);
        return;
      }

      const headerRow = (rawRows[0] || []).map(h => String(h || '').trim().toLowerCase().replace(/[\s_\-()]/g, ''));
      
      const findCol = (aliases: string[]) => {
        return headerRow.findIndex(h => aliases.some(alias => h.includes(alias.toLowerCase().replace(/[\s_\-()]/g, ''))));
      };

      const nameIdx = findCol(['productname', 'itemname', 'description', 'product', 'item', 'name']);
      const paintTypeIdx = findCol(['painttype', 'paint', 'type', 'brand']);
      const colorIdx = findCol(['color', 'colour', 'shade']);
      const sizeIdx = findCol(['size', 'volume', 'capacity', 'can']);

      const skuIdx = findCol(['sku', 'code', 'itemcode', 'skucode', 'partnumber', 'model']);
      const barcodeIdx = findCol(['barcode', 'bar_code', 'upc', 'ean']);
      const catIdx = findCol(['category', 'categoryname', 'dept', 'department']);
      const unitIdx = findCol(['unit', 'uom', 'unitofmeasure', 'measure']);
      const costIdx = findCol(['costprice', 'cost', 'buyingprice', 'buyprice', 'purchaseprice']);
      const sellIdx = findCol(['sellingprice', 'sellprice', 'price', 'retailprice', 'retail']);
      const stockIdx = findCol(['currentstock', 'stock', 'initialstock', 'qty', 'quantity', 'balance', 'stockavailable', 'available']);
      const minIdx = findCol(['minimumstock', 'minstock', 'reorderlevel', 'alertstock', 'stockalert', 'alert', 'min']);
      const locIdx = findCol(['location', 'bin', 'shelf', 'storagelocation', 'bay', 'shed']);

      if (nameIdx === -1 && paintTypeIdx === -1) {
        setBulkErrors(['Could not find a "Product Name" or "Paint Type" column header. Please check your column headers.']);
        setParsedBulkProducts([]);
        return;
      }

      const parsed: any[] = [];
      const errors: string[] = [];

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
          continue;
        }

        let rawName = '';
        if (nameIdx !== -1 && row[nameIdx]) {
          rawName = String(row[nameIdx]).trim();
        } else if (paintTypeIdx !== -1 && row[paintTypeIdx]) {
          const ptype = String(row[paintTypeIdx] || '').trim();
          const pcolor = colorIdx !== -1 && row[colorIdx] ? String(row[colorIdx]).trim() : '';
          const psize = sizeIdx !== -1 && row[sizeIdx] ? String(row[sizeIdx]).trim() : '';
          rawName = [ptype, pcolor, psize].filter(Boolean).join(' ');
        }

        if (!rawName) {
          errors.push(`Row ${i + 1}: Missing product name, skipped.`);
          continue;
        }

        let rawSku = skuIdx !== -1 ? String(row[skuIdx] || '').trim() : '';
        if (!rawSku) {
          const prefix = rawName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'ITM');
          rawSku = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const rawBarcode = barcodeIdx !== -1 && row[barcodeIdx] ? String(row[barcodeIdx]).trim() : '';
        let rawCat = catIdx !== -1 && row[catIdx] ? String(row[catIdx]).trim() : 'General';
        if (rawCat.toLowerCase().includes('paint')) {
          rawCat = 'Paints & Finishes';
        }

        let rawUnit = unitIdx !== -1 && row[unitIdx] ? String(row[unitIdx]).trim() : '';
        if (!rawUnit && sizeIdx !== -1 && row[sizeIdx]) {
          const sizeStr = String(row[sizeIdx]).trim().toLowerCase();
          if (sizeStr.endsWith('l')) rawUnit = 'litres';
          else if (sizeStr.endsWith('kg')) rawUnit = 'kg';
          else if (sizeStr.endsWith('m')) rawUnit = 'meters';
          else rawUnit = 'pcs';
        }
        if (!rawUnit) rawUnit = 'pcs';

        const rawCost = costIdx !== -1 ? parseFloat(String(row[costIdx]).replace(/[^0-9.-]/g, '')) || 0 : 0;
        const rawSell = sellIdx !== -1 ? parseFloat(String(row[sellIdx]).replace(/[^0-9.-]/g, '')) || 0 : 0;
        const rawStock = stockIdx !== -1 ? parseFractionOrDecimal(row[stockIdx]) : 0;
        const rawMin = minIdx !== -1 ? parseFractionOrDecimal(row[minIdx]) || 5 : 5;
        const rawLoc = locIdx !== -1 && row[locIdx] ? String(row[locIdx]).trim() : (rawCat === 'Paints & Finishes' ? 'Paints Section' : 'Main Store');

        parsed.push({
          name: rawName,
          sku: rawSku.toUpperCase(),
          barcode: rawBarcode || null,
          categoryName: rawCat,
          unit: rawUnit,
          costPrice: Math.max(0, rawCost),
          sellingPrice: Math.max(0, rawSell),
          initialStock: Math.max(0, rawStock),
          minimumStock: Math.max(0, rawMin),
          location: rawLoc,
        });
      }

      setParsedBulkProducts(parsed);
      setBulkErrors(errors);
    } catch (err: any) {
      setBulkErrors([`Failed to read spreadsheet file: ${err.message || 'Invalid format'}`]);
      setParsedBulkProducts([]);
    }
  };

  const handleConfirmBulkImport = () => {
    if (parsedBulkProducts.length === 0) return;
    setErrorMsg(null);
    setBulkErrors([]);
    setImportSuccessMsg(null);

    startTransition(async () => {
      const res = await bulkImportProducts(parsedBulkProducts);
      if (!res.success) {
        setErrorMsg(res.error || 'Bulk import failed');
        return;
      }

      setImportSuccessMsg(`Bulk import complete: ${res.created} new products created, ${res.updated} existing items updated (${res.total} total rows processed).`);
      if (res.errors && res.errors.length > 0) {
        setBulkErrors(res.errors);
      }
      setParsedBulkProducts([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadData();
    });
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
            <>
              <button
                onClick={() => {
                  setImportSuccessMsg(null);
                  setBulkErrors([]);
                  setParsedBulkProducts([]);
                  setShowBulkImportModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs sm:text-sm transition shadow-xs flex items-center space-x-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Import CSV / Excel</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold px-3.5 py-1.5 rounded-lg text-xs sm:text-sm transition shadow-xs flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Product</span>
              </button>
            </>
          )}
        </div>
      </div>

      {importSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>
          <button onClick={() => setImportSuccessMsg(null)} className="text-emerald-600 font-bold p-1">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 font-bold p-1">✕</button>
        </div>
      )}

      {/* Admin-Only Tentative Stock Cost & Asset Valuation Ribbon */}
      {userRole === 'ADMIN' && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Stock at Cost
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 mt-1">
              {loading ? '...' : formatCurrency(stockValuation.totalCost, currency)}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Tentative capital invested in stock
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Expected Retail Value
              </span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <CircleDollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl font-black text-amber-600 mt-1">
              {loading ? '...' : formatCurrency(stockValuation.totalRetail, currency)}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Potential turnover upon full sale
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Potential Gross Margin
              </span>
              <div className="p-1.5 rounded-lg bg-green-50 text-green-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl font-black text-green-600 mt-1">
              {loading ? '...' : formatCurrency(stockValuation.potentialProfit, currency)}
            </p>
            <span className="text-[11px] text-green-700 font-semibold mt-0.5 block">
              {loading ? '...' : `${stockValuation.marginPercent}% unrealized margin`}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 hover:border-slate-300 transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                In-Stock Inventory
              </span>
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 mt-1">
              {loading ? '...' : `${formatQuantity(stockValuation.totalUnits)} Units`}
            </p>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {loading ? '...' : `${stockValuation.inStockItemsCount} of ${products.length} products in stock`}
            </span>
          </div>
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
                      {formatQuantity(p.current_stock)} <span className="text-xs text-slate-400 font-normal">{p.unit}</span>
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
                        <>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-semibold transition border border-amber-300 inline-flex items-center space-x-1"
                            title="Edit product details, SKU, and prices"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => setShowAdjustModal(p)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 rounded-lg text-xs font-semibold transition border border-slate-300 inline-flex items-center space-x-1"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Adjust</span>
                          </button>
                        </>
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
                    type="text"
                    placeholder="e.g. 100 or 12 1/2"
                    value={newProd.initialStock}
                    onChange={e => setNewProd({ ...newProd, initialStock: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Stock Alert</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 5 or 2 1/2"
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
                <p className="text-xs text-slate-500">{showAdjustModal.name} (Current: {formatQuantity(showAdjustModal.current_stock)} {showAdjustModal.unit})</p>
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
                <div className="space-y-2">
                  <input
                    required
                    type="text"
                    placeholder="e.g. +10, -5, +1/2, -1/4, +0.5"
                    value={adjustDelta}
                    onChange={e => setAdjustDelta(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-black"
                    autoFocus
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Quick Add:</span>
                    {['+1/4', '+1/2', '+3/4', '+1', '+5', '+10'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAdjustDelta(val)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded text-xs font-bold font-mono transition"
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-semibold mr-1">Quick Deduct:</span>
                    {['-1/4', '-1/2', '-3/4', '-1', '-5', '-10'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAdjustDelta(val)}
                        className="px-2 py-0.5 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 rounded text-xs font-bold font-mono transition"
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
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
                        <span>{m.quantity > 0 ? `+${formatQuantity(m.quantity)}` : formatQuantity(m.quantity)} units</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{formatDateTime(m.created_at)} · By {m.performed_by}</div>
                      {m.reason && <div className="text-[11px] text-slate-600 italic">{m.reason}</div>}
                    </div>
                    <div className="text-right text-slate-600 text-[11px] font-mono">
                      <div>Prev: {formatQuantity(m.previous_stock)}</div>
                      <div className="font-bold text-slate-900">New: {formatQuantity(m.new_stock)}</div>
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

      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 my-8 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Edit Product Details</h3>
                  <p className="text-xs text-slate-500 font-mono">Editing SKU: {showEditModal.sku}</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs sm:text-sm max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product Name *</label>
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKU / Code *</label>
                  <input
                    required
                    type="text"
                    value={editForm.sku}
                    onChange={e => setEditForm({ ...editForm, sku: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Barcode (Optional)</label>
                  <input
                    type="text"
                    value={editForm.barcode}
                    onChange={e => setEditForm({ ...editForm, barcode: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={editForm.categoryName}
                    onChange={e => setEditForm({ ...editForm, categoryName: e.target.value })}
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
                    value={editForm.unit}
                    onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
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
                    value={editForm.costPrice}
                    onChange={e => setEditForm({ ...editForm, costPrice: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Selling Price ({currency})</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={editForm.sellingPrice}
                    onChange={e => setEditForm({ ...editForm, sellingPrice: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-mono font-bold text-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Stock Alert</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 5 or 2 1/2"
                    value={editForm.minimumStock}
                    onChange={e => setEditForm({ ...editForm, minimumStock: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Storage Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
                <span>Current Stock: <strong>{formatQuantity(showEditModal.current_stock)} {showEditModal.unit}</strong></span>
                <span className="text-[10px] text-slate-400">Use "Adjust" button on table to record stock level changes</span>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
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
                  <span>Update Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 space-y-4 my-8 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">Bulk Import Inventory (CSV / Excel)</h3>
                  <p className="text-xs text-slate-500">Upload .csv, .xlsx, or .xls spreadsheets to bulk add or update products</p>
                </div>
              </div>
              <button onClick={() => setShowBulkImportModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800 text-xs">Need a starting template?</div>
                  <div className="text-[11px] text-slate-500">Download the standard hardware inventory CSV with pre-configured headers.</div>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleCSV}
                  className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center justify-center space-x-1.5 shadow-2xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition bg-slate-50/50">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="bulk-file-input"
                />
                <label htmlFor="bulk-file-input" className="cursor-pointer flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-600 hover:underline">Click to browse file</span> or drag and drop
                  </div>
                  <span className="text-[11px] text-slate-400">Supports CSV, Excel (.xlsx, .xls)</span>
                </label>
                {bulkFileName && (
                  <div className="mt-3 inline-flex items-center space-x-2 bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full text-xs font-semibold font-mono">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{bulkFileName}</span>
                  </div>
                )}
              </div>

              {bulkErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs space-y-1 max-h-32 overflow-y-auto font-medium">
                  <div className="font-bold flex items-center space-x-1.5 text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Notes / Warnings:</span>
                  </div>
                  {bulkErrors.map((err, i) => (
                    <div key={i} className="text-[11px]">• {err}</div>
                  ))}
                </div>
              )}

              {parsedBulkProducts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Previewing {parsedBulkProducts.length} detected products (showing first 5):
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-black">
                      Ready to Import
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-mono border-b">
                        <tr>
                          <th className="py-2 px-2.5">SKU</th>
                          <th className="py-2 px-2.5">Name</th>
                          <th className="py-2 px-2.5">Category</th>
                          <th className="py-2 px-2.5 text-center">Stock</th>
                          <th className="py-2 px-2.5 text-right">Cost</th>
                          <th className="py-2 px-2.5 text-right">Selling</th>
                          <th className="py-2 px-2.5">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedBulkProducts.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 font-medium">
                            <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900">{row.sku}</td>
                            <td className="py-1.5 px-2.5 text-slate-800 truncate max-w-[160px]">{row.name}</td>
                            <td className="py-1.5 px-2.5 text-slate-500">{row.categoryName}</td>
                            <td className="py-1.5 px-2.5 text-center font-bold text-slate-900">{row.initialStock} {row.unit}</td>
                            <td className="py-1.5 px-2.5 text-right font-mono">{formatCurrency(row.costPrice, currency)}</td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-amber-600">{formatCurrency(row.sellingPrice, currency)}</td>
                            <td className="py-1.5 px-2.5 text-slate-500">{row.location}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending || parsedBulkProducts.length === 0}
                  onClick={handleConfirmBulkImport}
                  className="px-5 py-2 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl shadow-xs flex items-center space-x-1.5 transition"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importing Products...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Import ({parsedBulkProducts.length} Items)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
