-- ==============================================================================
-- HARDWAREDESK UGANDA: 001_initial_schema.sql
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. PRODUCTS & INVENTORY TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) UNIQUE NOT NULL,
    barcode VARCHAR(64) UNIQUE,
    name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    category_name VARCHAR(100) DEFAULT 'General',
    unit VARCHAR(50) DEFAULT 'pcs',
    cost_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    minimum_stock NUMERIC(12, 2) NOT NULL DEFAULT 5.00,
    location VARCHAR(100) DEFAULT 'Main Store',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. CUSTOMERS & DEBTORS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    total_credit_sales NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    total_payments_made NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    balance_due NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    store_credit NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. SUPPLIERS & CREDITORS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(100),
    contact_person VARCHAR(100),
    address TEXT,
    total_purchases NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    total_payments_made NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    balance_due NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. SALES TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(64) UNIQUE NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) DEFAULT 'Walk-in Customer' NOT NULL,
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    cost_of_goods_sold NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    gross_profit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID',
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    cashier_name VARCHAR(100) DEFAULT 'Cashier',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. SALE ITEMS TABLE
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(64),
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
    unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. IMMUTABLE RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(64) UNIQUE NOT NULL,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    receipt_type VARCHAR(50) NOT NULL DEFAULT 'SALE',
    party_name VARCHAR(255) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL,
    items_snapshot JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. INVENTORY MOVEMENTS AUDIT LEDGER
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    previous_stock NUMERIC(12, 2) NOT NULL,
    new_stock NUMERIC(12, 2) NOT NULL,
    unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    reference_type VARCHAR(50),
    reference_id UUID,
    reason TEXT,
    performed_by VARCHAR(100) DEFAULT 'System',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_number VARCHAR(64) UNIQUE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255) NOT NULL,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(50) DEFAULT 'UNPAID' NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    received_date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
    unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. DEBTOR & CREDITOR LEDGER TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS ledger_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50),
    reference_id UUID,
    receipt_number VARCHAR(64),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 11. FINANCIAL TRANSACTIONS TABLE (CASH FLOW)
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_type VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    reference_type VARCHAR(50),
    reference_id UUID,
    party_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 12. STOCK TAKES & VARIANCE AUDITING
CREATE TABLE IF NOT EXISTS stock_takes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_take_number VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS' NOT NULL,
    total_items_counted INTEGER DEFAULT 0 NOT NULL,
    items_with_variance INTEGER DEFAULT 0 NOT NULL,
    total_variance_cost NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    created_by VARCHAR(100) DEFAULT 'Storekeeper',
    finalized_by VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    finalized_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_take_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_take_id UUID REFERENCES stock_takes(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    location VARCHAR(100),
    system_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    physical_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    variance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    variance_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    approval_status VARCHAR(50) DEFAULT 'AUTO_APPROVED' NOT NULL,
    manager_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_name);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entity ON ledger_transactions(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_created ON financial_transactions(created_at DESC);
