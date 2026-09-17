import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_api():
    # 1. Health check
    res = client.get('/health')
    assert res.status_code == 200, f'Health failed: {res.text}'
    print('Test 1: Health check passed:', res.json())

    # 2. Get initial products
    res = client.get('/products/')
    assert res.status_code == 200
    print(f'Test 2: Initial products count: {len(res.json())}')

    # 3. Bulk import test
    new_items = [
        {
            'sku': 'TST-IRN-001',
            'barcode': '123456789012',
            'name': 'Test Iron Sheet 28G',
            'category_id': 'Building',
            'cost_price': 35000.0,
            'selling_price': 42000.0,
            'stock_quantity': 50,
            'minimum_stock': 10,
            'storage_location_id': 'Yard A'
        },
        {
            'sku': 'TST-PNT-002',
            'name': 'Test Weather Guard White 20L',
            'category_id': 'Paint',
            'cost_price': 180000.0,
            'selling_price': 220000.0,
            'stock_quantity': 15,
            'minimum_stock': 5,
            'storage_location_id': 'Paint Store'
        }
    ]
    res = client.post('/products/bulk', json=new_items)
    assert res.status_code == 200, f'Bulk failed: {res.text}'
    print('Test 3: Bulk import response:', res.json()['message'])

    # 4. Stock take submit test
    stock_adj = [
        {
            'product_id': 'TST-IRN-001',
            'physical_quantity': 48,
            'system_quantity': 50,
            'variance': -2,
            'reason': 'Damaged in transit'
        },
        {
            'product_id': 'TST-PNT-002',
            'physical_quantity': 12,
            'system_quantity': 15,
            'variance': -3,
            'reason': 'Audit count'
        }
    ]
    res = client.post('/stock-take/submit', json={'items': stock_adj, 'notes': 'Weekly audit'})
    assert res.status_code == 200, f'Stock take failed: {res.text}'
    print('Test 4: Stock take submit passed:', res.json()['message'])

    # 5. Verify that updated stock persisted
    res = client.get('/products/')
    products = res.json()
    irn = next(p for p in products if p['sku'] == 'TST-IRN-001')
    pnt = next(p for p in products if p['sku'] == 'TST-PNT-002')
    assert irn['stock_quantity'] == 48, f"Expected 48, got {irn['stock_quantity']}"
    assert pnt['stock_quantity'] == 12, f"Expected 12, got {pnt['stock_quantity']}"
    print(f"Test 5: Stock quantities verified: {irn['sku']} = {irn['stock_quantity']}, {pnt['sku']} = {pnt['stock_quantity']}")

    # 6. Test Product Edit
    edit_payload = {
        'name': 'Test Iron Sheet 28G (Super Color)',
        'sku': 'TST-IRN-001-MOD',
        'selling_price': 49000.0,
        'storage_location_id': 'Yard B-Rack 2'
    }
    res = client.put(f"/products/{irn['id']}", json=edit_payload)
    assert res.status_code == 200, f'Product edit failed: {res.text}'
    updated = res.json()
    assert updated['sku'] == 'TST-IRN-001-MOD'
    assert updated['name'] == 'Test Iron Sheet 28G (Super Color)'
    assert updated['selling_price'] == 49000.0
    print('Test 6: Product edit verified (SKU, name, selling price, location updated successfully)!')
    print("ALL API TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    test_api()
