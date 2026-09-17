'use server';

import { getAdminClient } from '@/lib/supabase';
import { CreateProductSchema, AdjustStockSchema, UpdateProductSchema, BulkImportSchema } from '@/lib/validations';
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

export async function updateProduct(formData: any) {
  const parsed = UpdateProductSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = getAdminClient();
  const { id, name, sku, barcode, categoryName, unit, costPrice, sellingPrice, minimumStock, location } = parsed.data;

  // Check if SKU is taken by another product
  const { data: existingSku } = await supabase
    .from('products')
    .select('id')
    .eq('sku', sku)
    .neq('id', id)
    .maybeSingle();

  if (existingSku) {
    return { success: false, error: `SKU "${sku}" is already assigned to another product.` };
  }

  const cleanBarcode = barcode && barcode.trim().length > 0 ? barcode.trim() : null;
  if (cleanBarcode) {
    const { data: existingBarcode } = await supabase
      .from('products')
      .select('id')
      .eq('barcode', cleanBarcode)
      .neq('id', id)
      .maybeSingle();

    if (existingBarcode) {
      return { success: false, error: `Barcode "${cleanBarcode}" is already assigned to another product.` };
    }
  }

  const { data: updatedProd, error } = await supabase
    .from('products')
    .update({
      name,
      sku,
      barcode: cleanBarcode,
      category_name: categoryName,
      unit,
      cost_price: costPrice,
      selling_price: sellingPrice,
      minimum_stock: minimumStock,
      location,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/inventory');
  revalidatePath('/sales');
  revalidatePath('/stock-take');
  revalidatePath('/');
  return { success: true, product: updatedProd };
}

export async function bulkImportProducts(rawItems: any[]) {
  const parsed = BulkImportSchema.safeParse({ products: rawItems });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const items = parsed.data.products;
  const supabase = getAdminClient();

  const { data: existingProducts, error: fetchErr } = await supabase
    .from('products')
    .select('id, sku, barcode, current_stock, cost_price');

  if (fetchErr) {
    return { success: false, error: fetchErr.message };
  }

  const existingMap = new Map<string, any>();
  for (const p of (existingProducts || [])) {
    if (p.sku) existingMap.set(p.sku.toUpperCase(), p);
  }

  let createdCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      const cleanSku = item.sku.trim().toUpperCase();
      const cleanBarcode = item.barcode && item.barcode.trim().length > 0 ? item.barcode.trim() : null;
      const existing = existingMap.get(cleanSku);

      if (existing) {
        const { error: updateErr } = await supabase
          .from('products')
          .update({
            name: item.name.trim(),
            category_name: item.categoryName,
            unit: item.unit,
            cost_price: item.costPrice,
            selling_price: item.sellingPrice,
            minimum_stock: item.minimumStock,
            location: item.location,
            barcode: cleanBarcode || existing.barcode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) {
          errors.push(`SKU ${cleanSku}: ${updateErr.message}`);
        } else {
          updatedCount++;
        }
      } else {
        const { data: newProd, error: insertErr } = await supabase
          .from('products')
          .insert({
            name: item.name.trim(),
            sku: cleanSku,
            barcode: cleanBarcode,
            category_name: item.categoryName,
            unit: item.unit,
            cost_price: item.costPrice,
            selling_price: item.sellingPrice,
            current_stock: item.initialStock,
            minimum_stock: item.minimumStock,
            location: item.location,
          })
          .select()
          .single();

        if (insertErr) {
          errors.push(`SKU ${cleanSku}: ${insertErr.message}`);
        } else {
          createdCount++;
          existingMap.set(cleanSku, newProd);

          if (item.initialStock > 0 && newProd) {
            await supabase.from('inventory_movements').insert({
              product_id: newProd.id,
              movement_type: 'MANUAL_ADJUSTMENT',
              quantity: item.initialStock,
              previous_stock: 0,
              new_stock: item.initialStock,
              unit_cost: item.costPrice,
              reason: 'Bulk CSV/Excel Opening Balance',
              performed_by: 'Admin (Bulk Import)',
            });
          }
        }
      }
    } catch (err: any) {
      errors.push(`Item ${item.name}: ${err.message || 'Unknown error'}`);
    }
  }

  revalidatePath('/inventory');
  revalidatePath('/sales');
  revalidatePath('/stock-take');
  revalidatePath('/');

  return {
    success: true,
    created: createdCount,
    updated: updatedCount,
    total: items.length,
    errors,
  };
}
