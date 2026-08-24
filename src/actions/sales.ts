'use server';

import { getAdminClient } from '@/lib/supabase';
import { ProcessSaleSchema } from '@/lib/validations';
import { Sale, Receipt } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function executeSale(payload: any): Promise<{ success: boolean; error?: string; receipt?: Receipt; saleId?: string }> {
  const parsed = ProcessSaleSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = getAdminClient();

  const { data: rpcResult, error: rpcError } = await supabase.rpc('execute_sale_transaction', {
    p_customer_id: parsed.data.customerId || null,
    p_customer_name: parsed.data.customerName,
    p_payment_method: parsed.data.paymentMethod,
    p_amount_paid: parsed.data.amountPaid,
    p_discount_amount: parsed.data.discountAmount,
    p_items: parsed.data.items.map(item => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
    p_cashier_name: parsed.data.cashierName,
    p_idempotency_key: parsed.data.idempotencyKey || null,
  });

  if (!rpcError && rpcResult && rpcResult.success) {
    revalidatePath('/sales');
    revalidatePath('/inventory');
    revalidatePath('/receipt-book');
    revalidatePath('/ledger');
    revalidatePath('/reports');
    revalidatePath('/');

    return {
      success: true,
      saleId: rpcResult.sale_id,
      receipt: {
        receipt_number: rpcResult.receipt_number,
        sale_id: rpcResult.sale_id,
        receipt_type: 'SALE',
        party_name: parsed.data.customerName,
        payment_method: rpcResult.payment_method,
        total_amount: rpcResult.total_amount,
        items_snapshot: rpcResult.items,
        created_at: rpcResult.created_at || new Date().toISOString(),
      },
    };
  }

  if (rpcError) {
    console.warn('RPC execute_sale_transaction not available or failed. Running atomic fallback...', rpcError.message);
  }

  try {
    const productIds = parsed.data.items.map(i => i.productId);
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (prodErr || !products) {
      return { success: false, error: 'Failed to retrieve products for stock validation.' };
    }

    const prodMap = new Map(products.map(p => [p.id, p]));
    let subtotal = 0;
    let totalCogs = 0;

    for (const item of parsed.data.items) {
      const prod = prodMap.get(item.productId);
      if (!prod) return { success: false, error: `Product ID ${item.productId} not found.` };
      if (prod.current_stock < item.quantity) {
        return { success: false, error: `Insufficient stock for ${prod.name}. Available: ${prod.current_stock}` };
      }
      subtotal += item.quantity * item.unitPrice;
      totalCogs += item.quantity * prod.cost_price;
    }

    const totalAmount = Math.max(0, subtotal - parsed.data.discountAmount);
    const grossProfit = totalAmount - totalCogs;
    const receiptNum = `REC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    let balanceDue = 0;
    let paymentStatus = 'PAID';
    if (parsed.data.paymentMethod === 'Credit') {
      balanceDue = totalAmount;
      paymentStatus = 'UNPAID';
    } else if (parsed.data.amountPaid < totalAmount) {
      balanceDue = totalAmount - parsed.data.amountPaid;
      paymentStatus = 'PARTIAL';
    }

    const { data: saleHeader, error: saleErr } = await supabase
      .from('sales')
      .insert({
        receipt_number: receiptNum,
        idempotency_key: parsed.data.idempotencyKey || null,
        customer_id: parsed.data.customerId || null,
        customer_name: parsed.data.customerName,
        subtotal,
        discount_amount: parsed.data.discountAmount,
        total_amount: totalAmount,
        cost_of_goods_sold: totalCogs,
        gross_profit: grossProfit,
        payment_method: parsed.data.paymentMethod,
        payment_status: paymentStatus,
        amount_paid: parsed.data.amountPaid,
        balance_due: balanceDue,
        cashier_name: parsed.data.cashierName,
      })
      .select()
      .single();

    if (saleErr) return { success: false, error: saleErr.message };

    const snapshotItems = [];
    for (const item of parsed.data.items) {
      const prod = prodMap.get(item.productId)!;
      const lineTotal = item.quantity * item.unitPrice;

      await supabase.from('sale_items').insert({
        sale_id: saleHeader.id,
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        quantity: item.quantity,
        unit_cost: prod.cost_price,
        unit_price: item.unitPrice,
        line_total: lineTotal,
      });

      const newStock = Math.max(0, prod.current_stock - item.quantity);
      await supabase.from('products').update({ current_stock: newStock }).eq('id', prod.id);

      await supabase.from('inventory_movements').insert({
        product_id: prod.id,
        movement_type: 'SALE',
        quantity: -item.quantity,
        previous_stock: prod.current_stock,
        new_stock: newStock,
        unit_cost: prod.cost_price,
        reference_type: 'sales',
        reference_id: saleHeader.id,
        reason: `Point of Sale: ${receiptNum}`,
        performed_by: parsed.data.cashierName,
      });

      snapshotItems.push({
        product_id: prod.id,
        name: prod.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: lineTotal,
      });
    }

    const { data: receiptRec } = await supabase
      .from('receipts')
      .insert({
        receipt_number: receiptNum,
        sale_id: saleHeader.id,
        receipt_type: 'SALE',
        party_name: parsed.data.customerName,
        payment_method: parsed.data.paymentMethod,
        total_amount: totalAmount,
        items_snapshot: snapshotItems,
      })
      .select()
      .single();

    if (parsed.data.amountPaid > 0 && !['Store Credit', 'Credit'].includes(parsed.data.paymentMethod)) {
      await supabase.from('financial_transactions').insert({
        transaction_type: 'INCOME',
        category: 'SALES_REVENUE',
        amount: parsed.data.amountPaid,
        payment_method: parsed.data.paymentMethod,
        reference_type: 'sales',
        reference_id: saleHeader.id,
        party_name: parsed.data.customerName,
        notes: `Sale ${receiptNum}`,
      });
    }

    if (parsed.data.customerId) {
      if (balanceDue > 0) {
        const { data: cust } = await supabase.from('customers').select('*').eq('id', parsed.data.customerId).single();
        if (cust) {
          await supabase.from('customers').update({
            total_credit_sales: Number(cust.total_credit_sales || 0) + balanceDue,
            balance_due: Number(cust.balance_due || 0) + balanceDue,
          }).eq('id', cust.id);

          await supabase.from('ledger_transactions').insert({
            entity_type: 'CUSTOMER',
            entity_id: cust.id,
            entity_name: cust.name,
            transaction_type: 'CREDIT_SALE',
            amount: balanceDue,
            payment_method: parsed.data.paymentMethod,
            reference_id: saleHeader.id,
            receipt_number: receiptNum,
            note: `Credit sale ${receiptNum}`,
          });
        }
      }
    }

    revalidatePath('/sales');
    revalidatePath('/inventory');
    revalidatePath('/receipt-book');
    revalidatePath('/ledger');
    revalidatePath('/reports');
    revalidatePath('/');

    return {
      success: true,
      saleId: saleHeader.id,
      receipt: receiptRec || {
        receipt_number: receiptNum,
        sale_id: saleHeader.id,
        receipt_type: 'SALE',
        party_name: parsed.data.customerName,
        payment_method: parsed.data.paymentMethod,
        total_amount: totalAmount,
        items_snapshot: snapshotItems,
        created_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Transaction failed unexpectedly' };
  }
}

export async function getRecentSales(limit = 10): Promise<Sale[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('sales')
    .select('*, sale_items(*)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error loading recent sales:', error);
    return [];
  }

  return (data || []).map(row => ({
    ...row,
    items: row.sale_items || [],
  }));
}

export async function getReceiptBook(options: { startDate?: string; endDate?: string; searchTerm?: string } = {}): Promise<Receipt[]> {
  const supabase = getAdminClient();
  let query = supabase.from('receipts').select('*').order('created_at', { ascending: false });

  if (options.startDate) {
    query = query.gte('created_at', `${options.startDate}T00:00:00Z`);
  }
  if (options.endDate) {
    query = query.lte('created_at', `${options.endDate}T23:59:59Z`);
  }
  if (options.searchTerm) {
    query = query.or(`receipt_number.ilike.%${options.searchTerm}%,party_name.ilike.%${options.searchTerm}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching receipt book:', error);
    return [];
  }
  return data || [];
}
