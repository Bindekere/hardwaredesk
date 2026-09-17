from fastapi import APIRouter, HTTPException
from typing import List, Optional, Union
import uuid
from schemas import StockTakeAdjustmentItem, StockTakeSubmission
from products import PRODUCTS_DB, STOCK_MOVEMENTS_DB
from database import supabase

router = APIRouter(prefix="/stock-take", tags=["Blind Stock Take"])

STOCK_TAKES_DB = []

@router.post("/submit")
def submit_blind_stock_take(payload: Union[StockTakeSubmission, List[StockTakeAdjustmentItem]]):
    if isinstance(payload, StockTakeSubmission):
        items = payload.items
        notes = payload.notes
    else:
        items = payload
        notes = None

    audit_results = []
    updated_products = []
    take_id = str(uuid.uuid4())

    for item in items:
        # Match product by id or sku in PRODUCTS_DB
        prod = next((p for p in PRODUCTS_DB if p["id"] == item.product_id or p.get("sku") == item.product_id), None)
        system_qty = prod["stock_quantity"] if prod else (item.system_quantity or 0)
        variance = item.variance if item.variance is not None else (item.physical_quantity - system_qty)
        reason = item.reason or "Blind Stock Take Adjustment"

        if prod:
            prod["stock_quantity"] = item.physical_quantity
            prod_id = prod["id"]
            prod_name = prod["name"]
            prod_sku = prod["sku"]
        else:
            prod_id = item.product_id
            prod_name = item.product_id
            prod_sku = item.product_id

        # Update in Supabase if active
        if supabase:
            try:
                # Update product stock in DB
                supabase.table("products").update({"stock_quantity": item.physical_quantity}).eq("id", prod_id).execute()
                # Record stock movement
                if variance != 0:
                    supabase.table("stock_movements").insert({
                        "id": str(uuid.uuid4()),
                        "product_id": prod_id,
                        "movement_type": "ADJUSTMENT",
                        "quantity": variance,
                        "reference_id": take_id,
                        "reason": f"Stock Take: {reason}"
                    }).execute()
            except Exception as e:
                print(f"Supabase stock take update error: {e}")

        # In-memory movement log
        if variance != 0:
            STOCK_MOVEMENTS_DB.append({
                "id": str(uuid.uuid4()),
                "product_id": prod_id,
                "movement_type": "ADJUSTMENT",
                "quantity": variance,
                "reference_id": take_id,
                "reason": f"Stock Take: {reason}"
            })

        audit_results.append({
            "product_id": prod_id,
            "sku": prod_sku,
            "product": prod_name,
            "system_qty": system_qty,
            "physical_qty": item.physical_quantity,
            "variance": variance,
            "reason": reason
        })

        updated_products.append({
            "id": prod_id,
            "sku": prod_sku,
            "stock_quantity": item.physical_quantity
        })

    record = {"id": take_id, "notes": notes, "results": audit_results}
    STOCK_TAKES_DB.append(record)
    return {
        "message": f"Successfully processed stock take for {len(items)} products",
        "take_id": take_id,
        "results": audit_results,
        "updated_products": updated_products
    }
