export type UserRole = 'ADMIN' | 'STOREKEEPER' | 'CASHIER';

export type PaymentMethod =
  | 'Cash'
  | 'Mobile Money'
  | 'Bank Transfer'
  | 'Credit'
  | 'Store Credit'
  | 'Split';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export type MovementType =
  | 'SALE'
  | 'PURCHASE'
  | 'STOCK_TAKE'
  | 'DAMAGE'
  | 'RETURN'
  | 'MANUAL_ADJUSTMENT';

export type ApprovalStatus =
  | 'AUTO_APPROVED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category_id: string | null;
  category_name?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  minimum_stock: number;
  location: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_credit_sales: number;
  total_payments_made: number;
  balance_due: number;
  store_credit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  address: string | null;
  total_purchases: number;
  total_payments_made: number;
  balance_due: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  quantity: number;
  discount: number;
}

export interface SaleItem {
  id?: string;
  sale_id?: string;
  product_id: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  discount_amount?: number;
  line_total: number;
}

export interface Sale {
  id: string;
  receipt_number: string;
  idempotency_key?: string | null;
  customer_id: string | null;
  customer_name: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount_paid: number;
  balance_due: number;
  cashier_name: string;
  notes?: string | null;
  created_at: string;
  items?: SaleItem[];
}

export interface Receipt {
  id?: string;
  receipt_number: string;
  sale_id?: string | null;
  receipt_type: 'SALE' | 'DEBTOR_PAYMENT' | 'PREPAYMENT' | 'SUPPLIER_PAYMENT';
  party_name: string;
  payment_method: PaymentMethod | string;
  total_amount: number;
  items_snapshot: any[];
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name?: string;
  movement_type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_cost: number;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  performed_by: string;
  created_at: string;
}

export interface PurchaseItem {
  id?: string;
  purchase_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id: string | null;
  supplier_name: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  payment_status: PaymentStatus;
  payment_method: string;
  received_date: string;
  notes?: string | null;
  created_at: string;
  items?: PurchaseItem[];
}

export interface LedgerTransaction {
  id: string;
  entity_type: 'CUSTOMER' | 'SUPPLIER';
  entity_id: string;
  entity_name: string;
  transaction_type: string;
  amount: number;
  payment_method?: string;
  reference_id?: string;
  receipt_number?: string;
  note?: string;
  created_at: string;
}

export interface FinancialTransaction {
  id: string;
  transaction_type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  payment_method: string;
  reference_type?: string;
  reference_id?: string;
  party_name?: string;
  notes?: string;
  created_at: string;
}

export interface StockTake {
  id: string;
  stock_take_number: string;
  status: 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'FINALIZED' | 'CANCELLED';
  total_items_counted: number;
  items_with_variance: number;
  total_variance_cost: number;
  created_by: string;
  finalized_by?: string | null;
  notes?: string | null;
  created_at: string;
  finalized_at?: string | null;
  items?: StockTakeItem[];
}

export interface StockTakeItem {
  id: string;
  stock_take_id: string;
  product_id: string;
  product_name: string;
  location?: string;
  system_quantity: number;
  physical_quantity: number;
  variance: number;
  unit_cost: number;
  variance_cost: number;
  approval_status: ApprovalStatus;
  manager_note?: string | null;
  created_at: string;
}

export interface FinancialReportSummary {
  period: string;
  totalRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  profitMarginPercent: number;
  stockExpenses: number;
  otherExpenses: number;
  netCashFlow: number;
  totalSalesCount: number;
  totalItemsSold: number;
  salesBreakdown: Array<{
    id: string;
    receipt_number: string;
    date: string;
    customer_name: string;
    items_count: number;
    revenue: number;
    gross_profit: number;
    payment_method: string;
  }>;
  expensesBreakdown: Array<{
    id: string;
    date: string;
    category: string;
    party_name: string;
    amount: number;
    payment_method: string;
  }>;
}
