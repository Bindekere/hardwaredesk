'use server';

import { getAdminClient } from '@/lib/supabase';
import { Sale } from '@/lib/types';

export interface DashboardMetrics {
  todaysRevenue: number;
  todaysSalesCount: number;
  totalProductsCount: number;
  lowStockCount: number;
  recentSales: Sale[];
  topBestSellers: Array<{ name: string; sold: number }>;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = getAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // 1. Today's Sales Query
  const { data: todaysSales } = await supabase
    .from('sales')
    .select('*')
    .gte('created_at', todayISO);

  const todaysRevenue = (todaysSales || []).reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const todaysSalesCount = (todaysSales || []).length;

  // 2. Products Query
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, current_stock, minimum_stock')
    .eq('is_active', true);

  const totalProductsCount = (allProducts || []).length;
  const lowStockCount = (allProducts || []).filter(p => Number(p.current_stock) <= Number(p.minimum_stock)).length;

  // 3. Recent Sales Query (Top 10)
  const { data: recentSalesData } = await supabase
    .from('sales')
    .select('*, sale_items(*)')
    .order('created_at', { ascending: false })
    .limit(10);

  const recentSales: Sale[] = (recentSalesData || []).map(row => ({
    ...row,
    items: row.sale_items || [],
  }));

  // 4. Top Best Sellers from sale_items
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('product_name, quantity');

  const soldCountMap: Record<string, number> = {};
  (saleItems || []).forEach(item => {
    const name = item.product_name || 'Item';
    soldCountMap[name] = (soldCountMap[name] || 0) + Number(item.quantity || 0);
  });

  const topBestSellers = Object.entries(soldCountMap)
    .map(([name, sold]) => ({ name, sold }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  return {
    todaysRevenue,
    todaysSalesCount,
    totalProductsCount,
    lowStockCount,
    recentSales,
    topBestSellers,
  };
}
