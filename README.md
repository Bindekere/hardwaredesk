# HardwareDesk — Uganda Hardware Management & Point-of-Sale System

HardwareDesk is a fast, database-backed Point-of-Sale (POS) and inventory management platform designed specifically for hardware retail and wholesale businesses in Uganda.

---

## 🏛 Core Architectural Principle

> **THE DATABASE IS THE SOURCE OF TRUTH.**
> 
> The frontend is an interactive view and command dispatcher. Every stock level, sale transaction, debtor balance, revenue metric, and receipt is derived from and enforced by persisted PostgreSQL database records.

---

## 🌟 Key Features

- **Dashboard**: Real-time business pulse displaying Today's Revenue, Sales Count, Low Stock Count, recent sales register, and top fast-moving items.
- **Quick Sales Terminal**: Fast POS checkout with instant barcode/SKU scanning, keyboard hotkeys (`/` to search), mobile drawer cart sheet, customer selection, store credit redemption, and 80mm thermal / A4 invoice printing.
- **Receipt Book**: Chronological sales register with full-text search, date filtering, and instant historical receipt reprints.
- **Inventory & Products**: Normalized catalog with unit tracking (bags, kg, pcs, meters, litres, rolls), location bins, minimum stock thresholds, and an auditable **Movement Ledger** (`inventory_movements`) tracing all stock ins and outs.
- **Purchases & Suppliers**: Inbound PO receiving that automatically restocks products, updates unit costs, records supplier credit obligations, and tracks payments.
- **Blind Stock Take**: Conceals system counts during physical audits to prevent bias, computes variance discrepancies, enforces manager approval for variances $\ge 5$ units, and commits verified adjustments.
- **Debtors & Creditors Ledger**: Tracks customer credit sales, partial debt settlements with instant payment receipts, and customer advance prepayments (Store Credit).
- **Financial Reports & Analytics**: Real-time calculation of Sales Revenue, Cost of Goods Sold (COGS), Gross Profit, Profit Margins, Net Cash Flow, and one-click PDF / CSV export.
- **Ugandan Localization**: Native support for **Uganda Shillings (UGX)** and USD, with payment methods including **Cash**, **MTN Mobile Money**, **Airtel Money**, **Bank Transfer**, **Customer Credit**, and **Store Credit Prepayment**.

---

## 🛠 Technology Stack

- **Frontend**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Lucide React.
- **Backend**: Next.js Server Actions & Route Handlers with Zod validation.
- **Database**: Supabase PostgreSQL 15+ with normalized tables, triggers, and atomic PL/pgSQL stored procedures (`execute_sale_transaction`, `record_stock_purchase`, `finalize_stock_take`, `record_customer_debt_payment`).
- **Deployment**: Vercel.

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Bindekere/hardwaredesk.git
cd hardwaredesk
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_SHOP_NAME=HardwareDesk Uganda
NEXT_PUBLIC_DEFAULT_CURRENCY=UGX
```

### 3. Apply Database Migrations

Run the SQL migration scripts in order via the Supabase SQL Editor:

1. `supabase/migrations/000_FULL_SETUP.sql`: Creates all tables, atomic RPC procedures, and Uganda hardware seed data in 1 click.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Testing

Run the end-to-end database verification test:

```bash
node scripts/test-e2e.mjs
```

---

## 📄 License

MIT License. Designed and engineered for Uganda Hardware Enterprises.
