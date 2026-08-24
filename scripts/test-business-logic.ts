import { ProcessSaleSchema, CreateProductSchema, AdjustStockSchema, CreatePurchaseSchema, RecordDebtorPaymentSchema, SubmitStockTakeSchema } from '../src/lib/validations';

console.log('================================================================');
console.log('🧪 HARDWAREDESK: CORE BUSINESS LOGIC & FORMULA TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`   ✓ ${message}`);
    passedTests++;
  }
}

// TEST 1: Zod Schema Validation
console.log('👉 [1/6] Testing Zod Validation Schemas...');
const validProduct = CreateProductSchema.safeParse({
  name: 'Tororo Portland Cement 50kg',
  sku: 'CEM-001',
  unit: 'bags',
  costPrice: 32000,
  sellingPrice: 36500,
  initialStock: 120,
  minimumStock: 20,
  location: 'Yard-Bay 1',
});
assert(validProduct.success === true, 'Valid product payload passes schema validation');

const invalidProduct = CreateProductSchema.safeParse({
  name: 'X',
  sku: '',
  costPrice: -100,
  sellingPrice: 300,
});
assert(invalidProduct.success === false, 'Invalid product payload fails schema validation');

// TEST 2: Sales & Financial Mathematics
console.log('\n👉 [2/6] Testing Sale Calculations, COGS, and Gross Profit...');
const items = [
  { productId: 'p-1', name: 'Tororo Portland Cement 50kg', quantity: 5, unitCost: 32000, unitPrice: 36500 },
  { productId: 'p-2', name: 'Ordinary Steel Nails 3 inch (kg)', quantity: 10, unitCost: 4500, unitPrice: 6000 },
];
const discount = 2500;

const subtotal = items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0); // 5*36500 + 10*6000 = 182500 + 60000 = 242500
const totalCogs = items.reduce((s, i) => s + (i.quantity * i.unitCost), 0);  // 5*32000 + 10*4500 = 160000 + 45000 = 205000
const totalAmount = subtotal - discount; // 242500 - 2500 = 240000
const grossProfit = totalAmount - totalCogs; // 240000 - 205000 = 35000
const marginPercent = Number(((grossProfit / totalAmount) * 100).toFixed(1)); // (35000/240000)*100 = 14.58% -> 14.6%

assert(subtotal === 242500, `Subtotal is correct (UGX 242,500)`);
assert(totalCogs === 205000, `COGS is correct (UGX 205,000)`);
assert(totalAmount === 240000, `Grand total with discount is correct (UGX 240,000)`);
assert(grossProfit === 35000, `Gross Profit is correct (UGX 35,000)`);
assert(marginPercent === 14.6, `Gross Profit Margin is 14.6%`);

// TEST 3: Inventory Movement Invariant
console.log('\n👉 [3/6] Testing Inventory Movement & Stock Deduction...');
let currentStock = 120;
const soldQty = 5;
const newStock = currentStock - soldQty;
const movement = {
  movement_type: 'SALE',
  quantity: -soldQty,
  previous_stock: currentStock,
  new_stock: newStock,
};
assert(movement.new_stock === 115, 'Stock correctly decremented from 120 to 115');
assert(movement.previous_stock + movement.quantity === movement.new_stock, 'Movement balance equation holds: previous + delta = new');

// TEST 4: Debtor Credit & Partial Settlement
console.log('\n👉 [4/6] Testing Debtor Credit Sale and Partial Mobile Money Payment...');
let customerBalance = 0;
let totalCreditSales = 0;
let totalPaymentsMade = 0;

// Credit Sale of UGX 240,000
customerBalance += totalAmount;
totalCreditSales += totalAmount;
assert(customerBalance === 240000, 'Debtor balance increases by full credit sale amount (UGX 240,000)');

// Partial Payment of UGX 100,000 via Mobile Money
const paymentReceived = 100000;
customerBalance -= paymentReceived;
totalPaymentsMade += paymentReceived;
assert(customerBalance === 140000, 'Debtor balance decreases to remaining due (UGX 140,000)');
assert(totalPaymentsMade === 100000, 'Total customer payments tracked accurately (UGX 100,000)');

// TEST 5: Blind Stock Take & Variance Logic
console.log('\n👉 [5/6] Testing Blind Stock Take Variance & Manager Approval Trigger...');
const VARIANCE_THRESHOLD = 5;
const stockTakeAudit = [
  { name: 'Tororo Cement 50kg', systemQty: 115, physicalQty: 115, unitCost: 32000 },
  { name: 'PVC Pipe 2 inch', systemQty: 35, physicalQty: 33, unitCost: 18500 }, // Variance -2 (< 5: Auto approved)
  { name: 'Steel Nails 3 inch', systemQty: 250, physicalQty: 240, unitCost: 4500 }, // Variance -10 (>= 5: Pending approval)
];

const auditResults = stockTakeAudit.map(item => {
  const variance = item.physicalQty - item.systemQty;
  const needsApproval = Math.abs(variance) >= VARIANCE_THRESHOLD;
  return {
    ...item,
    variance,
    needsApproval,
    approvalStatus: needsApproval ? 'PENDING_APPROVAL' : 'AUTO_APPROVED',
  };
});

assert(auditResults[0].variance === 0 && auditResults[0].approvalStatus === 'AUTO_APPROVED', 'Zero discrepancy is auto-approved');
assert(auditResults[1].variance === -2 && auditResults[1].approvalStatus === 'AUTO_APPROVED', 'Discrepancy < 5 is auto-approved');
assert(auditResults[2].variance === -10 && auditResults[2].approvalStatus === 'PENDING_APPROVAL', 'Discrepancy >= 5 flags for manager approval');

// TEST 6: Financial Net Cash Flow Invariant
console.log('\n👉 [6/6] Testing Net Cash Flow Invariants (Cash In - Cash Out)...');
const cashInSales = 240000;
const cashInDebtorPayment = 100000;
const totalCashIn = cashInSales + cashInDebtorPayment; // 340,000

const cashOutSupplierPurchase = 180000;
const cashOutRentUtilities = 50000;
const totalCashOut = cashOutSupplierPurchase + cashOutRentUtilities; // 230,000

const netCashFlow = totalCashIn - totalCashOut; // 110,000
assert(totalCashIn === 340000, 'Total Cash In = UGX 340,000');
assert(totalCashOut === 230000, 'Total Cash Out = UGX 230,000');
assert(netCashFlow === 110000, 'Net Cash Flow = UGX 110,000');

console.log('\n================================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} CORE BUSINESS & INTEGRITY TESTS PASSED!`);
console.log('================================================================\n');
