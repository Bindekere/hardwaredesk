-- ==============================================================================
-- HARDWAREDESK UGANDA: 002_rpc_functions.sql
-- ==============================================================================

-- 1. ATOMIC SALE TRANSACTION RPC
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

-- 2. RECORD STOCK PURCHASE RPC
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

-- 3. RECORD CUSTOMER DEBT PAYMENT RPC
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

-- 4. FINALIZE STOCK TAKE RPC
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
