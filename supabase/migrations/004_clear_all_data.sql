-- ==============================================================================
-- HARDWAREDESK UGANDA: 004_clear_all_data.sql
-- 1-Click Field Reset: Empties all test transactional, product, and ledger data
-- ==============================================================================

TRUNCATE TABLE 
    sale_items,
    sales,
    receipts,
    inventory_movements,
    purchase_items,
    purchases,
    ledger_transactions,
    financial_transactions,
    stock_take_items,
    stock_takes,
    products,
    customers,
    suppliers
CASCADE;

-- Note: 'categories' table remains intact so standard hardware categories are ready for new items.
