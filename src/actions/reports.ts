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
    salesBreakdown,
    expensesBreakdown,
  };
}
