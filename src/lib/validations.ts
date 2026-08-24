import { z } from 'zod';

export const ProcessSaleSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  paymentMethod: z.enum(['Cash', 'Mobile Money', 'Bank Transfer', 'Credit', 'Store Credit', 'Split']),
  amountPaid: z.number().min(0, 'Amount paid cannot be negative'),
  discountAmount: z.number().min(0).default(0),
  items: z.array(
    z.object({
      productId: z.string().uuid('Valid product ID required'),
      quantity: z.number().positive('Quantity must be greater than 0'),
      unitPrice: z.number().positive('Unit price must be greater than 0'),
    })
  ).min(1, 'At least one item is required for a sale'),
  idempotencyKey: z.string().optional(),
  cashierName: z.string().default('Cashier'),
  notes: z.string().optional(),
});

export const CreateProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(2, 'SKU code is required'),
  barcode: z.string().nullable().optional(),
  categoryName: z.string().default('General'),
  unit: z.string().default('pcs'),
  costPrice: z.number().min(0, 'Cost price cannot be negative'),
  sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
  initialStock: z.number().min(0).default(0),
  minimumStock: z.number().min(0).default(5),
  location: z.string().default('Main Store'),
});

export const AdjustStockSchema = z.object({
  productId: z.string().uuid('Valid product ID required'),
  quantityDelta: z.number().refine(val => val !== 0, 'Adjustment delta cannot be 0'),
  reason: z.enum(['DAMAGE', 'LOSS', 'THEFT', 'RETURN', 'MANUAL_ADJUSTMENT']),
  performedBy: z.string().default('Storekeeper'),
  notes: z.string().optional(),
});

export const CreatePurchaseSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  supplierName: z.string().min(1, 'Supplier name is required'),
  purchaseNumber: z.string().min(1, 'PO / Invoice number is required'),
  amountPaid: z.number().min(0).default(0),
  paymentMethod: z.string().default('Cash'),
  items: z.array(
    z.object({
      productId: z.string().uuid('Valid product ID required'),
      quantity: z.number().positive('Quantity must be positive'),
      unitCost: z.number().positive('Unit cost must be positive'),
    })
  ).min(1, 'At least one purchase item is required'),
  notes: z.string().optional(),
});

export const CreateCustomerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  initialCredit: z.number().min(0).default(0),
});

export const RecordDebtorPaymentSchema = z.object({
  customerId: z.string().uuid('Valid customer ID required'),
  amount: z.number().positive('Payment amount must be positive'),
  paymentMethod: z.enum(['Cash', 'Mobile Money', 'Bank Transfer']),
  note: z.string().optional(),
});

export const SubmitStockTakeSchema = z.object({
  stockTakeNumber: z.string().min(1),
  counts: z.array(
    z.object({
      productId: z.string().uuid(),
      productName: z.string(),
      location: z.string().optional(),
      systemQuantity: z.number().min(0),
      physicalQuantity: z.number().min(0),
      unitCost: z.number().min(0),
    })
  ).min(1, 'Must count at least one product'),
  createdBy: z.string().default('Storekeeper'),
  notes: z.string().optional(),
});
