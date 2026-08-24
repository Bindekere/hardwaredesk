'use server';

import { getAdminClient } from '@/lib/supabase';
import { CreateProductSchema, AdjustStockSchema } from '@/lib/validations';
import { Product, InventoryMovement } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function getProducts(): Promise<Product[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  return data || [];
}

export async function createProduct(formData: any) {
  const parsed = CreateProductSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = getAdminClient();
  const { data: newProd, error } = await supabase
    .from('products')
    .insert({
      name: parsed.data.name,
      sku: parsed.data.sku,
      barcode: parsed.data.barcode || null,
      category_name: parsed.data.categoryName,
      unit: parsed.data.unit,
      cost_price: parsed.data.costPrice,
      selling_price: parsed.data.sellingPrice,
      current_stock: parsed.data.initialStock,
      minimum_stock: parsed.data.minimumStock,
      location: parsed.data.location,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  if (parsed.data.initialStock > 0) {
    await supabase.from('inventory_movements').insert({
      product_id: newProd.id,
      movement_type: 'MANUAL_ADJUSTMENT',
      quantity: parsed.data.initialStock,
      previous_stock: 0,
      new_stock: parsed.data.initialStock,
      unit_cost: parsed.data.costPrice,
      reason: 'Initial opening stock balance',
      performed_by: 'Admin',
    });
  }

  revalidatePath('/inventory');
  revalidatePath('/sales');
  revalidatePath('/');
  return { success: true, product: newProd };
}

export async function adjustStock(formData: any) {
  const parsed = AdjustStockSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = getAdminClient();
  const { data: prod, error: fetchErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', parsed.data.productId)
    .single();

  if (fetchErr || !prod) {
    return { success: false, error: 'Product not found' };
  }

  const previousStock = Number(prod.current_stock);
  const newStock = Math.max(0, previousStock + parsed.data.quantityDelta);

  const { error: updateErr } = await supabase
    .from('products')
    .update({
      current_stock: newStock,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prod.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await supabase.from('inventory_movements').insert({
    product_id: prod.id,
    movement_type: parsed.data.reason,
    quantity: parsed.data.quantityDelta,
    previous_stock: previousStock,
    new_stock: newStock,
    unit_cost: prod.cost_price,
    reason: parsed.data.notes || `Manual adjustment: ${parsed.data.reason}`,
    performed_by: parsed.data.performedBy,
  });

  revalidatePath('/inventory');
  revalidatePath('/sales');
  revalidatePath('/');
  return { success: true, newStock };
}

export async function getProductMovements(productId: string): Promise<InventoryMovement[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching movements:', error);
    return [];
  }
  return data || [];
}
