-- ==============================================================================
-- HARDWAREDESK UGANDA — COMPLETE DATABASE SETUP SCRIPT
-- Run this entire script in Supabase SQL Editor (1-Click Setup)
-- ==============================================================================

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

-- ATOMIC RPCs
CREATE OR REPLACE FUNCTION execute_sale_transaction(
    p_customer_id UUID,
    p_customer_name TEXT,
    p_payment_method TEXT,
    p_amount_paid NUMERIC,
    p_discount_amount NUMERIC,
    p_items JSONB,
    p_cashier_name TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_sale_id UUID := uuid_generate_v4();
    v_receipt_number TEXT;
    v_item RECORD;
    v_prod RECORD;
    v_subtotal NUMERIC := 0.00;
    v_total_cogs NUMERIC := 0.00;
    v_total_amount NUMERIC := 0.00;
    v_gross_profit NUMERIC := 0.00;
    v_payment_status TEXT;
    v_balance_due NUMERIC := 0.00;
    v_item_line_total NUMERIC;
    v_receipt_items JSONB := '[]'::jsonb;
    v_target_cust RECORD;
BEGIN
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM sales WHERE idempotency_key = p_idempotency_key) THEN
            SELECT * INTO v_prod FROM sales WHERE idempotency_key = p_idempotency_key;
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Sale already processed (idempotent replay)',
                'sale_id', v_prod.id,
                'receipt_number', v_prod.receipt_number
            );
        END IF;
    END IF;

    v_receipt_number := 'REC-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_price NUMERIC)
    LOOP
        SELECT * INTO v_prod FROM products WHERE id = v_item.product_id FOR UPDATE;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % not found', v_item.product_id;
        END IF;

        IF v_prod.current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for % (Available: %, Requested: %)', v_prod.name, v_prod.current_stock, v_item.quantity;
        END IF;

        v_item_line_total := round(v_item.quantity * v_item.unit_price, 2);
        v_subtotal := v_subtotal + v_item_line_total;
        v_total_cogs := v_total_cogs + round(v_item.quantity * v_prod.cost_price, 2);
    END LOOP;

    v_total_amount := v_subtotal - COALESCE(p_discount_amount, 0.00);
    v_gross_profit := v_total_amount - v_total_cogs;

    IF p_payment_method = 'Credit' THEN
        v_payment_status := 'UNPAID';
        v_balance_due := v_total_amount;
    ELSIF p_payment_method = 'Store Credit' THEN
        IF p_customer_id IS NULL THEN
            RAISE EXCEPTION 'Customer must be selected to use Store Credit';
        END IF;
        SELECT * INTO v_target_cust FROM customers WHERE id = p_customer_id FOR UPDATE;
        IF NOT FOUND OR v_target_cust.store_credit < v_total_amount THEN
            RAISE EXCEPTION 'Insufficient Store Credit (Available: %, Required: %)', COALESCE(v_target_cust.store_credit, 0), v_total_amount;
        END IF;
        v_payment_status := 'PAID';
        v_balance_due := 0.00;
    ELSIF p_amount_paid < v_total_amount THEN
        v_payment_status := 'PARTIAL';
        v_balance_due := v_total_amount - p_amount_paid;
    ELSE
        v_payment_status := 'PAID';
        v_balance_due := 0.00;
    END IF;

    INSERT INTO sales (
        id, receipt_number, idempotency_key, customer_id, customer_name,
        subtotal, discount_amount, total_amount, cost_of_goods_sold, gross_profit,
        payment_method, payment_status, amount_paid, balance_due, cashier_name
    ) VALUES (
        v_sale_id, v_receipt_number, p_idempotency_key, p_customer_id, COALESCE(p_customer_name, 'Walk-in Customer'),
        v_subtotal, COALESCE(p_discount_amount, 0.00), v_total_amount, v_total_cogs, v_gross_profit,
        p_payment_method, v_payment_status, p_amount_paid, v_balance_due, p_cashier_name
    );

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_price NUMERIC)
    LOOP
        SELECT * INTO v_prod FROM products WHERE id = v_item.product_id;
        v_item_line_total := round(v_item.quantity * v_item.unit_price, 2);

        INSERT INTO sale_items (
            sale_id, product_id, product_name, sku, quantity, unit_cost, unit_price, line_total
        ) VALUES (
            v_sale_id, v_prod.id, v_prod.name, v_prod.sku, v_item.quantity, v_prod.cost_price, v_item.unit_price, v_item_line_total
        );

        UPDATE products 
        SET current_stock = current_stock - v_item.quantity,
            updated_at = NOW()
        WHERE id = v_prod.id;

        INSERT INTO inventory_movements (
            product_id, movement_type, quantity, previous_stock, new_stock, unit_cost, reference_type, reference_id, reason, performed_by
        ) VALUES (
            v_prod.id, 'SALE', -v_item.quantity, v_prod.current_stock, (v_prod.current_stock - v_item.quantity), v_prod.cost_price, 'sales', v_sale_id, 'Point of Sale: ' || v_receipt_number, p_cashier_name
        );

        v_receipt_items := v_receipt_items || jsonb_build_object(
            'product_id', v_prod.id,
            'name', v_prod.name,
            'quantity', v_item.quantity,
            'unit_price', v_item.unit_price,
            'subtotal', v_item_line_total
        );
    END LOOP;

    INSERT INTO receipts (
        receipt_number, sale_id, receipt_type, party_name, payment_method, total_amount, items_snapshot
    ) VALUES (
        v_receipt_number, v_sale_id, 'SALE', COALESCE(p_customer_name, 'Walk-in Customer'), p_payment_method, v_total_amount, v_receipt_items
    );

    IF p_amount_paid > 0 AND p_payment_method NOT IN ('Store Credit', 'Credit') THEN
        INSERT INTO financial_transactions (
            transaction_type, category, amount, payment_method, reference_type, reference_id, party_name, notes
        ) VALUES (
            'INCOME', 'SALES_REVENUE', p_amount_paid, p_payment_method, 'sales', v_sale_id, COALESCE(p_customer_name, 'Walk-in Customer'), 'Sale ' || v_receipt_number
        );
    END IF;

    IF p_customer_id IS NOT NULL THEN
        IF v_balance_due > 0 THEN
            UPDATE customers 
            SET total_credit_sales = total_credit_sales + v_balance_due,
                balance_due = balance_due + v_balance_due,
                updated_at = NOW()
            WHERE id = p_customer_id;

            INSERT INTO ledger_transactions (
                entity_type, entity_id, entity_name, transaction_type, amount, payment_method, reference_id, receipt_number, note
            ) VALUES (
                'CUSTOMER', p_customer_id, p_customer_name, 'CREDIT_SALE', v_balance_due, p_payment_method, v_sale_id, v_receipt_number, 'Credit extended for Sale ' || v_receipt_number
            );
        END IF;

        IF p_payment_method = 'Store Credit' THEN
            UPDATE customers 
            SET store_credit = GREATEST(0.00, store_credit - v_total_amount),
                updated_at = NOW()
            WHERE id = p_customer_id;

            INSERT INTO ledger_transactions (
                entity_type, entity_id, entity_name, transaction_type, amount, payment_method, reference_id, receipt_number, note
            ) VALUES (
                'CUSTOMER', p_customer_id, p_customer_name, 'STORE_CREDIT_USED', v_total_amount, 'Store Credit', v_sale_id, v_receipt_number, 'Store credit redeemed for Sale ' || v_receipt_number
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'receipt_number', v_receipt_number,
        'total_amount', v_total_amount,
        'amount_paid', p_amount_paid,
        'balance_due', v_balance_due,
        'payment_method', p_payment_method,
        'created_at', NOW(),
        'items', v_receipt_items
    );
END;
$$;

CREATE OR REPLACE FUNCTION record_stock_purchase(
    p_supplier_id UUID,
    p_supplier_name TEXT,
    p_purchase_number TEXT,
    p_total_amount NUMERIC,
    p_amount_paid NUMERIC,
    p_payment_method TEXT,
    p_items JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_purchase_id UUID := uuid_generate_v4();
    v_item RECORD;
    v_prod RECORD;
    v_balance_due NUMERIC := 0.00;
    v_payment_status TEXT;
    v_line_total NUMERIC;
BEGIN
    v_balance_due := GREATEST(0.00, p_total_amount - p_amount_paid);
    
    IF v_balance_due = 0.00 THEN
        v_payment_status := 'PAID';
    ELSIF p_amount_paid > 0 THEN
        v_payment_status := 'PARTIAL';
    ELSE
        v_payment_status := 'UNPAID';
    END IF;

    INSERT INTO purchases (
        id, purchase_number, supplier_id, supplier_name, total_amount, amount_paid, balance_due, payment_status, payment_method, notes
    ) VALUES (
        v_purchase_id, p_purchase_number, p_supplier_id, p_supplier_name, p_total_amount, p_amount_paid, v_balance_due, v_payment_status, p_payment_method, p_notes
    );

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity NUMERIC, unit_cost NUMERIC)
    LOOP
        SELECT * INTO v_prod FROM products WHERE id = v_item.product_id FOR UPDATE;
        
        IF FOUND THEN
            v_line_total := round(v_item.quantity * v_item.unit_cost, 2);

            INSERT INTO purchase_items (
                purchase_id, product_id, product_name, quantity, unit_cost, line_total
            ) VALUES (
                v_purchase_id, v_prod.id, v_prod.name, v_item.quantity, v_item.unit_cost, v_line_total
            );

            UPDATE products 
            SET current_stock = current_stock + v_item.quantity,
                cost_price = v_item.unit_cost,
                updated_at = NOW()
            WHERE id = v_prod.id;

            INSERT INTO inventory_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, unit_cost, reference_type, reference_id, reason, performed_by
            ) VALUES (
                v_prod.id, 'PURCHASE', v_item.quantity, v_prod.current_stock, (v_prod.current_stock + v_item.quantity), v_item.unit_cost, 'purchases', v_purchase_id, 'Stock Received: ' || p_purchase_number, 'Storekeeper'
            );
        END IF;
    END LOOP;

    IF p_amount_paid > 0 THEN
        INSERT INTO financial_transactions (
            transaction_type, category, amount, payment_method, reference_type, reference_id, party_name, notes
        ) VALUES (
            'EXPENSE', 'STOCK_PURCHASE', p_amount_paid, p_payment_method, 'purchases', v_purchase_id, p_supplier_name, 'Purchase PO: ' || p_purchase_number
        );
    END IF;

    IF p_supplier_id IS NOT NULL THEN
        UPDATE suppliers 
        SET total_purchases = total_purchases + p_total_amount,
            total_payments_made = total_payments_made + p_amount_paid,
            balance_due = balance_due + v_balance_due,
            updated_at = NOW()
        WHERE id = p_supplier_id;

        IF v_balance_due > 0 THEN
            INSERT INTO ledger_transactions (
                entity_type, entity_id, entity_name, transaction_type, amount, payment_method, reference_id, receipt_number, note
            ) VALUES (
                'SUPPLIER', p_supplier_id, p_supplier_name, 'PURCHASE_ON_CREDIT', v_balance_due, p_payment_method, v_purchase_id, p_purchase_number, 'Stock purchase balance on PO ' || p_purchase_number
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', v_purchase_id,
        'purchase_number', p_purchase_number,
        'total_amount', p_total_amount,
        'balance_due', v_balance_due
    );
END;
$$;

CREATE OR REPLACE FUNCTION record_customer_debt_payment(
    p_customer_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_cust RECORD;
    v_receipt_number TEXT;
    v_receipt_id UUID := uuid_generate_v4();
    v_new_balance NUMERIC;
BEGIN
    SELECT * INTO v_cust FROM customers WHERE id = p_customer_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    v_receipt_number := 'REC-DEBT-' || to_char(NOW(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));
    v_new_balance := GREATEST(0.00, v_cust.balance_due - p_amount);

    UPDATE customers 
    SET total_payments_made = total_payments_made + p_amount,
        balance_due = v_new_balance,
        updated_at = NOW()
    WHERE id = p_customer_id;

    INSERT INTO financial_transactions (
        transaction_type, category, amount, payment_method, reference_type, reference_id, party_name, notes
    ) VALUES (
        'INCOME', 'DEBTOR_PAYMENT', p_amount, p_payment_method, 'customers', p_customer_id, v_cust.name, 'Debtor payment receipt ' || v_receipt_number
    );

    INSERT INTO ledger_transactions (
        entity_type, entity_id, entity_name, transaction_type, amount, payment_method, receipt_number, note
    ) VALUES (
        'CUSTOMER', p_customer_id, v_cust.name, 'PAYMENT_RECEIVED', p_amount, p_payment_method, v_receipt_number, COALESCE(p_note, 'Debtor settlement payment')
    );

    INSERT INTO receipts (
        id, receipt_number, receipt_type, party_name, payment_method, total_amount, items_snapshot
    ) VALUES (
        v_receipt_id, v_receipt_number, 'DEBTOR_PAYMENT', v_cust.name, p_payment_method, p_amount,
        jsonb_build_array(jsonb_build_object(
            'name', 'Account Debt Settlement',
            'quantity', 1,
            'unit_price', p_amount,
            'subtotal', p_amount,
            'remaining_balance', v_new_balance
        ))
    );

    RETURN jsonb_build_object(
        'success', true,
        'receipt_number', v_receipt_number,
        'customer_id', p_customer_id,
        'amount_paid', p_amount,
        'new_balance', v_new_balance
    );
END;
$$;

CREATE OR REPLACE FUNCTION finalize_stock_take(
    p_stock_take_id UUID,
    p_finalized_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_st RECORD;
    v_item RECORD;
    v_prod RECORD;
    v_applied_count INTEGER := 0;
BEGIN
    SELECT * INTO v_st FROM stock_takes WHERE id = p_stock_take_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock take not found';
    END IF;

    FOR v_item IN SELECT * FROM stock_take_items WHERE stock_take_id = p_stock_take_id AND approval_status IN ('AUTO_APPROVED', 'APPROVED')
    LOOP
        SELECT * INTO v_prod FROM products WHERE id = v_item.product_id FOR UPDATE;
        
        IF FOUND THEN
            UPDATE products 
            SET current_stock = v_item.physical_quantity,
                updated_at = NOW()
            WHERE id = v_prod.id;

            INSERT INTO inventory_movements (
                product_id, movement_type, quantity, previous_stock, new_stock, unit_cost, reference_type, reference_id, reason, performed_by
            ) VALUES (
                v_prod.id, 'STOCK_TAKE', v_item.variance, v_item.system_quantity, v_item.physical_quantity, v_item.unit_cost, 'stock_takes', p_stock_take_id, 'Stock Take Audit: ' || v_st.stock_take_number, p_finalized_by
            );

            v_applied_count := v_applied_count + 1;
        END IF;
    END LOOP;

    UPDATE stock_takes 
    SET status = 'FINALIZED',
        finalized_by = p_finalized_by,
        finalized_at = NOW()
    WHERE id = p_stock_take_id;

    RETURN jsonb_build_object(
        'success', true,
        'stock_take_id', p_stock_take_id,
        'applied_adjustments_count', v_applied_count
    );
END;
$$;

-- SEED DATA
INSERT INTO categories (id, name, description)
VALUES
('c1111111-1111-1111-1111-111111111111', 'Building Materials', 'Cement, sand, aggregates, and structural elements'),
('c2222222-2222-2222-2222-222222222222', 'Plumbing & Pipes', 'PPR, PVC pipes, taps, valves, and fittings'),
('c3333333-3333-3333-3333-333333333333', 'Roofing & Timber', 'Corrugated iron sheets, timber, and ridges'),
('c4444444-4444-4444-4444-444444444444', 'Fasteners & Nails', 'Steel nails, roof nails, screws, and bolts'),
('c5555555-5555-5555-5555-555555555555', 'Paints & Finishes', 'Emulsion, gloss, undercoats, brushes, and rollers'),
('c6666666-6666-6666-6666-666666666666', 'Electrical & Lighting', 'Cables, breakers, sockets, conduits, and switches')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (id, sku, barcode, name, category_name, unit, cost_price, selling_price, current_stock, minimum_stock, location)
VALUES
('d1111111-1111-1111-1111-111111111111', 'CEM-001', '600123456001', 'Tororo Portland Cement 50kg (CEM II)', 'Building Materials', 'bags', 32000.00, 36500.00, 120, 20, 'Yard-Bay 1'),
('d2222222-2222-2222-2222-222222222222', 'IRN-002', '600123456002', 'Corrugated Iron Sheet 30G (3m Blue)', 'Roofing & Timber', 'pcs', 38000.00, 44000.00, 85, 15, 'Shed A-1'),
('d3333333-3333-3333-3333-333333333333', 'PVC-003', '600123456003', 'PVC Pressure Pipe 2 inch (6m)', 'Plumbing & Pipes', 'pcs', 18500.00, 24000.00, 35, 10, 'Rack P-2'),
('d4444444-4444-4444-4444-444444444444', 'NAL-004', '600123456004', 'Ordinary Steel Wire Nails 3 inch (kg)', 'Fasteners & Nails', 'kg', 4500.00, 6000.00, 250, 40, 'Bin F-3'),
('d5555555-5555-5555-5555-555555555555', 'PNT-005', '600123456005', 'Sadolin Silk Gloss White Paint 4L', 'Paints & Finishes', 'litres', 62000.00, 75000.00, 18, 5, 'Shelf C-1'),
('d6666666-6666-6666-6666-666666666666', 'CBL-006', '600123456006', 'Single Core Copper Cable 2.5mm (100m)', 'Electrical & Lighting', 'rolls', 140000.00, 165000.00, 12, 4, 'Rack E-1'),
('d7777777-7777-7777-7777-777777777777', 'TAP-007', '600123456007', 'Brass Bibcock Water Tap 1/2 inch', 'Plumbing & Pipes', 'pcs', 8500.00, 12500.00, 40, 10, 'Bin P-5'),
('d8888888-8888-8888-8888-888888888888', 'TMB-008', '600123456008', 'Treated Timber 4x2 inch (14ft)', 'Roofing & Timber', 'pcs', 14000.00, 17500.00, 3, 15, 'Yard-Bay 3')
ON CONFLICT (sku) DO NOTHING;

INSERT INTO customers (id, name, phone, email, address, total_credit_sales, total_payments_made, balance_due, store_credit)
VALUES
('a1111111-1111-1111-1111-111111111111', 'Mukasa Construction Ltd', '+256701234567', 'mukasa@gmail.com', 'Kigo Road, Kampala', 1500000.00, 900000.00, 600000.00, 0.00),
('a2222222-2222-2222-2222-222222222222', 'Engineer David Opolot', '+256772987654', 'opolot.eng@yahoo.com', 'Naalya Estate, Wakiso', 850000.00, 400000.00, 450000.00, 0.00),
('a3333333-3333-3333-3333-333333333333', 'Grace Namubiru', '+256755112233', 'namubiru.g@outlook.com', 'Ntinda, Kampala', 0.00, 350000.00, 0.00, 350000.00)
ON CONFLICT DO NOTHING;

INSERT INTO suppliers (id, name, phone, email, contact_person, total_purchases, total_payments_made, balance_due)
VALUES
('b1111111-1111-1111-1111-111111111111', 'Tororo Cement Distributors Ltd', '+256414112233', 'sales@tororocement.com', 'Mr. Patel', 4500000.00, 4500000.00, 0.00),
('b2222222-2222-2222-2222-222222222222', 'Uganda Baati Ltd', '+256414889900', 'orders@ugandabaati.com', 'Sarah Akello', 3200000.00, 2400000.00, 800000.00),
('b3333333-3333-3333-3333-333333333333', 'Plumbing & Hardware Wholesale Depot', '+256700334455', 'depot.kampala@gmail.com', 'Joseph Kato', 1800000.00, 1100000.00, 700000.00)
ON CONFLICT DO NOTHING;
