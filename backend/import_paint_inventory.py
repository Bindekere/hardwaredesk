import os
import zipfile
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
from supabase import create_client

# 1. Load Supabase credentials
backend_env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(backend_env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(f"SUPABASE_URL or SUPABASE_KEY missing in {backend_env_path}")

client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. Parse paint_inventory_import.xlsx
excel_path = os.path.join(os.path.dirname(__file__), "..", "paint_inventory_import.xlsx")
if not os.path.exists(excel_path):
    excel_path = "paint_inventory_import.xlsx"

print(f"Reading spreadsheet: {excel_path}")

with zipfile.ZipFile(excel_path, 'r') as z:
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            text = ''.join(t.text for t in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text)
            shared_strings.append(text)
    
    sheet_xml = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows = []
    for r in sheet_xml.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
        row_vals = []
        for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
            t = c.get('t')
            v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
            val = v.text if v is not None else ''
            if t == 's' and val.isdigit():
                val = shared_strings[int(val)]
            row_vals.append(val)
        rows.append(row_vals)

if not rows:
    print("No rows found in spreadsheet!")
    exit(1)

headers = rows[0]
data_rows = rows[1:]
print(f"Headers: {headers}")
print(f"Found {len(data_rows)} data rows to process.")

# 3. Format and Upsert into Supabase products table
items_to_upsert = []
for r in data_rows:
    if not r or not any(r):
        continue

    sku = r[0].strip() if len(r) > 0 and r[0] else ""
    if not sku:
        continue
    
    barcode = r[1].strip() if len(r) > 1 and r[1] else None
    paint_type = r[2].strip() if len(r) > 2 and r[2] else ""
    color = r[3].strip() if len(r) > 3 and r[3] else ""
    size = r[4].strip() if len(r) > 4 and r[4] else ""
    category = r[5].strip() if len(r) > 5 and r[5] else "Paint and Finishings"
    
    name_parts = [p for p in [paint_type, color, f"({size})" if size else ""] if p]
    product_name = " ".join(name_parts).strip()
    if not product_name:
        product_name = sku

    try:
        stock_qty = int(float(r[6])) if len(r) > 6 and r[6] else 0
    except (ValueError, TypeError):
        stock_qty = 0

    try:
        cost_price = float(r[7]) if len(r) > 7 and r[7] else 0.0
    except (ValueError, TypeError):
        cost_price = 0.0

    try:
        selling_price = float(r[8]) if len(r) > 8 and r[8] else 0.0
    except (ValueError, TypeError):
        selling_price = 0.0

    try:
        min_stock = int(float(r[9])) if len(r) > 9 and r[9] else 5
    except (ValueError, TypeError):
        min_stock = 5

    item = {
        "sku": sku,
        "barcode": barcode,
        "name": product_name,
        "category_id": category,
        "unit": size if size else "pcs",
        "cost_price": cost_price,
        "selling_price": selling_price,
        "stock_quantity": stock_qty,
        "minimum_stock": min_stock,
        "storage_location_id": "Paint Section",
        "active": True
    }
    items_to_upsert.append(item)

print(f"Prepared {len(items_to_upsert)} items for upsert.")

chunk_size = 25
success_count = 0
error_count = 0

for i in range(0, len(items_to_upsert), chunk_size):
    chunk = items_to_upsert[i:i + chunk_size]
    try:
        res = client.table("products").upsert(chunk, on_conflict="sku").execute()
        success_count += len(chunk)
        print(f"  + Upserted batch {i + 1} to {min(i + chunk_size, len(items_to_upsert))} / {len(items_to_upsert)}")
    except Exception as e:
        print(f"  - Batch {i // chunk_size + 1} failed: {e}. Trying individual inserts...")
        for single_item in chunk:
            try:
                client.table("products").upsert(single_item, on_conflict="sku").execute()
                success_count += 1
            except Exception as single_err:
                print(f"    x Failed on SKU {single_item['sku']}: {single_err}")
                error_count += 1

print("\n==========================================")
print(" IMPORT COMPLETE:")
print(f" Successfully imported/updated: {success_count} products")
print(f" Errors: {error_count}")
print("==========================================")
