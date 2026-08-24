'use server';

import { getAdminClient } from '@/lib/supabase';
import { CreatePurchaseSchema } from '@/lib/validations';
import { Supplier, Purchase, LedgerTransaction } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching suppliers:', error);
    return [];
  }
  return data || [];
}

export async function createSupplier(formData: { name: string; phone?: string; email?: string; contactPerson?: string; initialBalance?: number }) {
  const supabase = getAdminClient();
  const initialBalance = formData.initialBalance || 0;

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name: formData.name,
      phone: formData.phone || null,
      email: formData.email || null,
      contact_person: formData.contactPerson || null,
      total_purchases: initialBalance,
      balance_due: initialBalance,
      total_payments_made: 0,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  if (initialBalance > 0) {
    await supabase.from('ledger_transactions').insert({
      entity_type: 'SUPPLIER',
      entity_id: data.id,
      entity_name: data.name,
      transaction_type: 'PURCHASE_ON_CREDIT',
      amount: initialBalance,
      note: 'Initial opening supplier creditor balance',
    });
  }

  revalidatePath('/purchases');
  revalidatePath('/ledger');
  return { success: true, supplier: data };
}

export async function recordStockPurchase(formData: any) {
  const parsed = CreatePurchaseSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = getAdminClient();
  const totalAmount = parsed.data.items.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('record_stock_purchase', {
    p_supplier_id: parsed.data.supplierId || null,
    p_supplier_name: parsed.data.supplierName,
    p_purchase_number: parsed.data.purchaseNumber,
    p_total_amount: totalAmount,
    p_amount_paid: parsed.data.amountPaid,
    p_payment_method: parsed.data.paymentMethod,
    p_items: parsed.data.items.map(i => ({
      product_id: i.productId,
      quantity: i.quantity,
      unit_cost: i.unitCost,
    })),
    p_notes: parsed.data.notes || null,
  });

  if (!rpcErr && rpcRes && rpcRes.success) {
    revalidatePath('/purchases');
    revalidatePath('/inventory');
    revalidatePath('/ledger');
    revalidatePath('/reports');
    revalidatePath('/');
    return { success: true, purchaseId: rpcRes.purchase_id };
  }

  try {
    const balanceDue = Math.max(0, totalAmount - parsed.data.amountPaid);
    const paymentStatus = balanceDue === 0 ? 'PAID' : parsed.data.amountPaid > 0 ? 'PARTIAL' : 'UNPAID';

    const { data: poHeader, error: poErr } = await supabase
      .from('purchases')
      .insert({
        purchase_number: parsed.data.purchaseNumber,
        supplier_id: parsed.data.supplierId || null,
        supplier_name: parsed.data.supplierName,
        total_amount: totalAmount,
        amount_paid: parsed.data.amountPaid,
        balance_due: balanceDue,
        payment_status: paymentStatus,
        payment_method: parsed.data.paymentMethod,
        notes: parsed.data.notes || null,
      })
      .select()
      .single();

    if (poErr) return { success: false, error: poErr.message };

    for (const item of parsed.data.items) {
      const lineTotal = item.quantity * item.unitCost;
      const { data: prod } = await supabase.from('products').select('*').eq('id', item.productId).single();

      await supabase.from('purchase_items').insert({
        purchase_id: poHeader.id,
        product_id: item.productId,
        product_name: prod ? prod.name : 'Hardware Item',
        quantity: item.quantity,
        unit_cost: item.unitCost,
        line_total: lineTotal,
      });

      if (prod) {
        const newStock = prod.current_stock + item.quantity;
        await supabase.from('products').update({
          current_stock: newStock,
          cost_price: item.unitCost,
        }).eq('id', prod.id);

        await supabase.from('inventory_movements').insert({
          product_id: prod.id,
          movement_type: 'PURCHASE',
          quantity: item.quantity,
          previous_stock: prod.current_stock,
          new_stock: newStock,
          unit_cost: item.unitCost,
          reference_type: 'purchases',
          reference_id: poHeader.id,
          reason: `Stock Purchase: ${parsed.data.purchaseNumber}`,
          performed_by: 'Storekeeper',
        });
      }
    }

    if (parsed.data.amountPaid > 0) {
      await supabase.from('financial_transactions').insert({
        transaction_type: 'EXPENSE',
        category: 'STOCK_PURCHASE',
        amount: parsed.data.amountPaid,
        payment_method: parsed.data.paymentMethod,
        reference_type: 'purchases',
        reference_id: poHeader.id,
        party_name: parsed.data.supplierName,
        notes: `PO ${parsed.data.purchaseNumber}`,
      });
    }

    if (parsed.data.supplierId) {
      const { data: sup } = await supabase.from('suppliers').select('*').eq('id', parsed.data.supplierId).single();
      if (sup) {
        await supabase.from('suppliers').update({
          total_purchases: Number(sup.total_purchases || 0) + totalAmount,
          total_payments_made: Number(sup.total_payments_made || 0) + parsed.data.amountPaid,
          balance_due: Number(sup.balance_due || 0) + balanceDue,
        }).eq('id', sup.id);

        if (balanceDue > 0) {
          await supabase.from('ledger_transactions').insert({
            entity_type: 'SUPPLIER',
            entity_id: sup.id,
            entity_name: sup.name,
            transaction_type: 'PURCHASE_ON_CREDIT',
            amount: balanceDue,
            payment_method: parsed.data.paymentMethod,
            reference_id: poHeader.id,
            receipt_number: parsed.data.purchaseNumber,
            note: `Stock PO balance on ${parsed.data.purchaseNumber}`,
          });
        }
      }
    }

    revalidatePath('/purchases');
    revalidatePath('/inventory');
    revalidatePath('/ledger');
    revalidatePath('/reports');
    revalidatePath('/');
    return { success: true, purchaseId: poHeader.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to record purchase' };
  }
}

export async function recordSupplierPayment(formData: { supplierId: string; amount: number; paymentMethod: string; note?: string }) {
  const supabase = getAdminClient();
  const { data: sup, error: fetchErr } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', formData.supplierId)
    .single();

  if (fetchErr || !sup) return { success: false, error: 'Supplier not found' };

  const newBalance = Math.max(0, Number(sup.balance_due) - formData.amount);

  await supabase.from('suppliers').update({
    total_payments_made: Number(sup.total_payments_made || 0) + formData.amount,
    balance_due: newBalance,
  }).eq('id', sup.id);

  await supabase.from('financial_transactions').insert({
    transaction_type: 'EXPENSE',
    category: 'SUPPLIER_PAYMENT',
    amount: formData.amount,
    payment_method: formData.paymentMethod,
    reference_type: 'suppliers',
    reference_id: sup.id,
    party_name: sup.name,
    notes: formData.note || `Supplier payment to ${sup.name}`,
  });

  await supabase.from('ledger_transactions').insert({
    entity_type: 'SUPPLIER',
    entity_id: sup.id,
    entity_name: sup.name,
    transaction_type: 'PAYMENT_MADE',
    amount: formData.amount,
    payment_method: formData.paymentMethod,
    note: formData.note || 'Settlement payment to supplier',
  });

  revalidatePath('/purchases');
  revalidatePath('/ledger');
  revalidatePath('/reports');
  return { success: true, newBalance };
}

export async function getPurchases(): Promise<Purchase[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('purchases')
    .select('*, purchase_items(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching purchases:', error);
    return [];
  }

  return (data || []).map(p => ({
    ...p,
    items: p.purchase_items || [],
  }));
}

export async function getSupplierTransactions(supplierId: string): Promise<LedgerTransaction[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('ledger_transactions')
    .select('*')
    .eq('entity_id', supplierId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching supplier transactions:', error);
    return [];
  }
  return data || [];
}
