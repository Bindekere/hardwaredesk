'use server';

import { getAdminClient } from '@/lib/supabase';
import { FinancialReportSummary } from '@/lib/types';

export async function getFinancialReport(
  period: 'TODAY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM' = 'TODAY',
  customStart?: string,
  customEnd?: string
): Promise<FinancialReportSummary> {
  const supabase = getAdminClient();

  let startDate: Date;
  let endDate = new Date();

  if (period === 'TODAY') {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (period === 'WEEKLY') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === 'MONTHLY') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
  } else {
    startDate = customStart ? new Date(customStart) : new Date(Date.now() - 30 * 86400000);
    if (customEnd) {
      endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
    }
  }

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  // 1. Fetch Sales within period
  const { data: sales } = await supabase
    .from('sales')
    .select('*, sale_items(*)')
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false });

  // 2. Fetch Financial Transactions (Expenses & Cash Flow)
  const { data: finTxs } = await supabase
    .from('financial_transactions')
    .select('*')
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false });

  let totalRevenue = 0;
  let totalCogs = 0;
  let totalItemsSold = 0;

  const salesBreakdown = (sales || []).map(s => {
    const rev = Number(s.total_amount || 0);
    const cogs = Number(s.cost_of_goods_sold || 0);
    const itemsCount = (s.sale_items || []).reduce((sum: number, i: any) => sum + Number(i.quantity || 1), 0);

    totalRevenue += rev;
    totalCogs += cogs;
    totalItemsSold += itemsCount;

    return {
      id: s.id,
      receipt_number: s.receipt_number,
      date: new Date(s.created_at).toLocaleDateString('en-GB'),
      customer_name: s.customer_name,
      items_count: itemsCount,
      revenue: rev,
      gross_profit: rev - cogs,
      payment_method: s.payment_method,
    };
  });

  const grossProfit = totalRevenue - totalCogs;
  const profitMarginPercent = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;

  let stockExpenses = 0;
  let otherExpenses = 0;
  let totalCashIn = 0;
  let totalCashOut = 0;

  const expensesBreakdown: any[] = [];

  (finTxs || []).forEach(tx => {
    const amt = Number(tx.amount || 0);
    if (tx.transaction_type === 'EXPENSE') {
      totalCashOut += amt;
      if (tx.category === 'STOCK_PURCHASE' || tx.category === 'SUPPLIER_PAYMENT') {
        stockExpenses += amt;
      } else {
        otherExpenses += amt;
      }
      expensesBreakdown.push({
        id: tx.id,
        date: new Date(tx.created_at).toLocaleDateString('en-GB'),
        category: tx.category,
        party_name: tx.party_name || 'Vendor',
        amount: amt,
        payment_method: tx.payment_method,
      });
    } else if (tx.transaction_type === 'INCOME') {
      totalCashIn += amt;
    }
  });

  const netCashFlow = totalCashIn - totalCashOut;

  // 3. Fetch Current Inventory Asset Valuation (Cost & Retail)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, category_name, current_stock, cost_price, selling_price')
    .eq('is_active', true);

  let totalStockCost = 0;
  let totalStockRetail = 0;
  let totalStockUnits = 0;
  const categoryMap: Record<
    string,
    { itemCount: number; totalUnits: number; costValue: number; retailValue: number }
  > = {};

  (products || []).forEach(p => {
    const stock = Math.max(0, Number(p.current_stock || 0));
    const cost = Math.max(0, Number(p.cost_price || 0));
    const retail = Math.max(0, Number(p.selling_price || 0));

    if (stock > 0) {
      const itemCostVal = stock * cost;
      const itemRetailVal = stock * retail;
      totalStockCost += itemCostVal;
      totalStockRetail += itemRetailVal;
      totalStockUnits += stock;

      const cat = p.category_name || 'General';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { itemCount: 0, totalUnits: 0, costValue: 0, retailValue: 0 };
      }
      categoryMap[cat].itemCount += 1;
      categoryMap[cat].totalUnits += stock;
      categoryMap[cat].costValue += itemCostVal;
      categoryMap[cat].retailValue += itemRetailVal;
    }
  });

  const categoryBreakdown = Object.entries(categoryMap)
    .map(([category, stats]) => {
      const potProfit = stats.retailValue - stats.costValue;
      const marginPct = stats.retailValue > 0 ? Number(((potProfit / stats.retailValue) * 100).toFixed(1)) : 0;
      return {
        category,
        itemCount: stats.itemCount,
        totalUnits: Math.round(stats.totalUnits * 100) / 100,
        costValue: stats.costValue,
        retailValue: stats.retailValue,
        potentialProfit: potProfit,
        profitMarginPercent: marginPct,
      };
    })
    .sort((a, b) => b.costValue - a.costValue);

  const totalPotProfit = totalStockRetail - totalStockCost;
  const totalMarginPct = totalStockRetail > 0 ? Number(((totalPotProfit / totalStockRetail) * 100).toFixed(1)) : 0;

  return {
    period,
    totalRevenue,
    costOfGoodsSold: totalCogs,
    grossProfit,
    profitMarginPercent,
    stockExpenses,
    otherExpenses,
    netCashFlow,
    totalSalesCount: (sales || []).length,
    totalItemsSold,
    inventoryValuation: {
      totalCostValue: totalStockCost,
      totalRetailValue: totalStockRetail,
      potentialProfit: totalPotProfit,
      profitMarginPercent: totalMarginPct,
      totalProductsCount: (products || []).length,
      totalUnitsInStock: Math.round(totalStockUnits * 100) / 100,
      categoryBreakdown,
    },
    salesBreakdown,
    expensesBreakdown,
  };
}
