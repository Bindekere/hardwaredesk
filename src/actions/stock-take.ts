'use server';

import { getAdminClient } from '@/lib/supabase';
import { SubmitStockTakeSchema } from '@/lib/validations';
import { StockTake, StockTakeItem, ApprovalStatus } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const VARIANCE_THRESHOLD = 5; // Flags for manager authorization if discrepancy >= 5 units

export async function submitStockTake(formData: any): Promise<{ success: boolean; error?: string; stockTakeId?: string; items?: StockTakeItem[] }> {
  const parsed = SubmitStockTakeSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = getAdminClient();
  let totalVarianceCost = 0;
  let itemsWithVariance = 0;

  const evaluatedItems = parsed.data.counts.map(item => {
    const variance = item.physicalQuantity - item.systemQuantity;
    const varianceCost = Math.round(variance * item.unitCost * 100) / 100;
    if (variance !== 0) {
      itemsWithVariance++;
      totalVarianceCost += Math.abs(varianceCost);
    }
    const needsApproval = Math.abs(variance) >= VARIANCE_THRESHOLD;
    const approvalStatus: ApprovalStatus = needsApproval ? 'PENDING_APPROVAL' : 'AUTO_APPROVED';

    return {
      product_id: item.productId,
      product_name: item.productName,
      location: item.location || 'Main Store',
      system_quantity: item.systemQuantity,
      physical_quantity: item.physicalQuantity,
      variance,
      unit_cost: item.unitCost,
      variance_cost: varianceCost,
      approval_status: approvalStatus,
    };
  });

  const hasPendingApprovals = evaluatedItems.some(i => i.approval_status === 'PENDING_APPROVAL');
  const initialStatus = hasPendingApprovals ? 'AWAITING_APPROVAL' : 'IN_PROGRESS';

  const { data: stHeader, error: stErr } = await supabase
    .from('stock_takes')
    .insert({
      stock_take_number: parsed.data.stockTakeNumber,
      status: initialStatus,
      total_items_counted: evaluatedItems.length,
      items_with_variance: itemsWithVariance,
      total_variance_cost: totalVarianceCost,
      created_by: parsed.data.createdBy,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (stErr) return { success: false, error: stErr.message };

  const insertItemsPayload = evaluatedItems.map(item => ({
    stock_take_id: stHeader.id,
    ...item,
  }));

  const { data: insertedItems, error: itemsErr } = await supabase
    .from('stock_take_items')
    .insert(insertItemsPayload)
    .select();

  if (itemsErr) return { success: false, error: itemsErr.message };

  revalidatePath('/stock-take');
  return {
    success: true,
    stockTakeId: stHeader.id,
    items: insertedItems as StockTakeItem[],
  };
}

export async function approveStockTakeItem(itemId: string, status: 'APPROVED' | 'REJECTED', note?: string) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from('stock_take_items')
    .update({
      approval_status: status,
      manager_note: note || null,
    })
    .eq('id', itemId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/stock-take');
  return { success: true };
}

export async function finalizeStockTake(stockTakeId: string, managerName: string) {
  const supabase = getAdminClient();

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('finalize_stock_take', {
    p_stock_take_id: stockTakeId,
    p_finalized_by: managerName,
  });

  if (!rpcErr && rpcRes && rpcRes.success) {
    revalidatePath('/stock-take');
    revalidatePath('/inventory');
    revalidatePath('/sales');
    revalidatePath('/');
    return { success: true, appliedCount: rpcRes.applied_adjustments_count };
  }

  const { data: items, error: itemsErr } = await supabase
    .from('stock_take_items')
    .select('*')
    .eq('stock_take_id', stockTakeId)
    .in('approval_status', ['AUTO_APPROVED', 'APPROVED']);

  if (itemsErr || !items) return { success: false, error: 'Failed to retrieve approved items' };

  let appliedCount = 0;
  for (const item of items) {
    if (item.variance !== 0) {
      await supabase
        .from('products')
        .update({ current_stock: item.physical_quantity })
        .eq('id', item.product_id);

      await supabase.from('inventory_movements').insert({
        product_id: item.product_id,
        movement_type: 'STOCK_TAKE',
        quantity: item.variance,
        previous_stock: item.system_quantity,
        new_stock: item.physical_quantity,
        unit_cost: item.unit_cost,
        reference_type: 'stock_takes',
        reference_id: stockTakeId,
        reason: `Blind Stock Take audit adjustment: ${item.manager_note || 'Approved count'}`,
        performed_by: managerName,
      });

      appliedCount++;
    }
  }

  await supabase
    .from('stock_takes')
    .update({
      status: 'FINALIZED',
      finalized_by: managerName,
      finalized_at: new Date().toISOString(),
    })
    .eq('id', stockTakeId);

  revalidatePath('/stock-take');
  revalidatePath('/inventory');
  revalidatePath('/sales');
  revalidatePath('/');
  return { success: true, appliedCount };
}
