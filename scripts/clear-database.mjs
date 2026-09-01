import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase credentials missing in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function clearDatabase() {
  console.log('================================================================');
  console.log('🧹 HARDWAREDESK: DATABASE CLEANUP / FIELD RESET SCRIPT');
  console.log('================================================================\n');

  const tablesToClear = [
    'sale_items',
    'sales',
    'receipts',
    'inventory_movements',
    'purchase_items',
    'purchases',
    'ledger_transactions',
    'financial_transactions',
    'stock_take_items',
    'stock_takes',
    'products',
    'customers',
    'suppliers',
  ];

  for (const table of tablesToClear) {
    console.log(`👉 Clearing table: ${table}...`);
    const { error } = await supabase
      .from(table)
      .delete()
      .not('id', 'is', null);

    if (error) {
      console.error(`   ⚠️ Failed to clear ${table}:`, error.message);
    } else {
      console.log(`   ✓ ${table} is now empty.`);
    }
  }

  const { data: categories } = await supabase.from('categories').select('id, name');
  console.log(`\n📦 Default categories preserved (${categories?.length || 0} categories):`);
  (categories || []).forEach(c => console.log(`   - ${c.name}`));

  console.log('\n================================================================');
  console.log('✅ DATABASE HAS BEEN RESET & EMPTIED FOR FIELD USE!');
  console.log('================================================================\n');
}

clearDatabase().catch(err => {
  console.error('❌ Error resetting database:', err);
  process.exit(1);
});
