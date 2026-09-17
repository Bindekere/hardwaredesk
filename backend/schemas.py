from pydantic import BaseModel, EmailStr
from typing import Optional, List
from enum import Enum
from datetime import datetime

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    SALES_STAFF = "SALES_STAFF"
    STOREKEEPER = "STOREKEEPER"
    VIEWER = "VIEWER"

class UserBase(BaseModel):
    email: str
    full_name: str
    role: UserRole


class UserResponse(UserBase):
    id: str

    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    sku: str
    barcode: Optional[str] = None
    name: str
    category_id: Optional[str] = "Building"
    supplier_id: Optional[str] = None
    storage_location_id: Optional[str] = "A1-S1-B1"
    unit: str = "pcs"
    cost_price: float
    selling_price: float
    stock_quantity: int = 0
    minimum_stock: int = 5
    image_url: Optional[str] = None
    active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    barcode: Optional[str] = None
    name: Optional[str] = None
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None
    stock_quantity: Optional[int] = None
    minimum_stock: Optional[int] = None
    active: Optional[bool] = None

class ProductResponse(ProductBase):
    id: str

    class Config:
        from_attributes = True

class StockAdjustmentCreate(BaseModel):
    product_id: str
    quantity: int
    movement_type: str # SALE, PURCHASE, RETURN, DAMAGE, LOSS, THEFT, ADJUSTMENT
    reason: Optional[str] = None

class SaleItemCreate(BaseModel):
    product_id: str
    quantity: int
    unit_price: float

class SaleCreate(BaseModel):
    customer_id: Optional[str] = None
    items: List[SaleItemCreate]
    payment_method: str # Cash, Mobile Money, Bank, Credit
    amount_paid: float

class SupplierCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    type: str = "DEBTOR" # DEBTOR, PREPAYMENT, CREDITOR
    amount: float = 0.0

class LedgerPaymentCreate(BaseModel):
    entity_type: str # DEBTOR or CREDITOR
    entity_id: str
    amount: float
    payment_method: str # Cash, Mobile Money, Bank

class PurchaseItemCreate(BaseModel):
    product_id: str
    quantity: int
    unit_cost: float

class PurchaseCreate(BaseModel):
    supplier_id: str
    items: List[PurchaseItemCreate]
    amount_paid: float

class StockCountItemCreate(BaseModel):
    product_id: str
    physical_quantity: int
    system_quantity: Optional[int] = None
    variance: Optional[int] = None
    reason: Optional[str] = "Stock Take Count"

class StockTakeAdjustmentItem(BaseModel):
    product_id: str
    physical_quantity: int
    system_quantity: Optional[int] = None
    variance: Optional[int] = None
    reason: Optional[str] = "Stock Take Adjustment"

class StockTakeSubmission(BaseModel):
    items: List[StockTakeAdjustmentItem]
    notes: Optional[str] = None
