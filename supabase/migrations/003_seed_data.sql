-- ==============================================================================
-- HARDWAREDESK UGANDA: 003_seed_data.sql
-- ==============================================================================

-- 1. SEED CATEGORIES
INSERT INTO categories (id, name, description)
VALUES
('c1111111-1111-1111-1111-111111111111', 'Building Materials', 'Cement, sand, aggregates, and structural elements'),
('c2222222-2222-2222-2222-222222222222', 'Plumbing & Pipes', 'PPR, PVC pipes, taps, valves, and fittings'),
('c3333333-3333-3333-3333-333333333333', 'Roofing & Timber', 'Corrugated iron sheets, timber, and ridges'),
('c4444444-4444-4444-4444-444444444444', 'Fasteners & Nails', 'Steel nails, roof nails, screws, and bolts'),
('c5555555-5555-5555-5555-555555555555', 'Paints & Finishes', 'Emulsion, gloss, undercoats, brushes, and rollers'),
('c6666666-6666-6666-6666-666666666666', 'Electrical & Lighting', 'Cables, breakers, sockets, conduits, and switches')
ON CONFLICT (name) DO NOTHING;

-- 2. SEED PRODUCTS
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

-- 3. SEED CUSTOMERS
INSERT INTO customers (id, name, phone, email, address, total_credit_sales, total_payments_made, balance_due, store_credit)
VALUES
('a1111111-1111-1111-1111-111111111111', 'Mukasa Construction Ltd', '+256701234567', 'mukasa@gmail.com', 'Kigo Road, Kampala', 1500000.00, 900000.00, 600000.00, 0.00),
('a2222222-2222-2222-2222-222222222222', 'Engineer David Opolot', '+256772987654', 'opolot.eng@yahoo.com', 'Naalya Estate, Wakiso', 850000.00, 400000.00, 450000.00, 0.00),
('a3333333-3333-3333-3333-333333333333', 'Grace Namubiru', '+256755112233', 'namubiru.g@outlook.com', 'Ntinda, Kampala', 0.00, 350000.00, 0.00, 350000.00)
ON CONFLICT DO NOTHING;

-- 4. SEED SUPPLIERS
INSERT INTO suppliers (id, name, phone, email, contact_person, total_purchases, total_payments_made, balance_due)
VALUES
('b1111111-1111-1111-1111-111111111111', 'Tororo Cement Distributors Ltd', '+256414112233', 'sales@tororocement.com', 'Mr. Patel', 4500000.00, 4500000.00, 0.00),
('b2222222-2222-2222-2222-222222222222', 'Uganda Baati Ltd', '+256414889900', 'orders@ugandabaati.com', 'Sarah Akello', 3200000.00, 2400000.00, 800000.00),
('b3333333-3333-3333-3333-333333333333', 'Plumbing & Hardware Wholesale Depot', '+256700334455', 'depot.kampala@gmail.com', 'Joseph Kato', 1800000.00, 1100000.00, 700000.00)
ON CONFLICT DO NOTHING;
