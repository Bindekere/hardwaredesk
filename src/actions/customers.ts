'use server';

import { getAdminClient } from '@/lib/supabase';
import { CreateCustomerSchema, RecordDebtorPaymentSchema } from '@/lib/validations';
import { Customer, LedgerTransaction, Receipt } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function getCustomers(): Promise<Customer[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
  return data || [];
}

export async function createCustomer(formData: any) {
  const parsed = CreateCustomerSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      total_credit_sales: parsed.data.initialCredit,
      balance_due: parsed.data.initialCredit,
      total_payments_made: 0,
      store_credit: 0,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  if (parsed.data.initialCredit > 0) {
    await supabase.from('ledger_transactions').insert({
      entity_type: 'CUSTOMER',
      entity_id: data.id,
      entity_name: data.name,
      transaction_type: 'CREDIT_SALE',
      amount: parsed.data.initialCredit,
      note: 'Initial opening credit debt',
    });
  }

  revalidatePath('/ledger');
  revalidatePath('/sales');
  return { success: true, customer: data };
}

export async function recordDebtorPayment(formData: any): Promise<{ success: boolean; error?: string; receipt?: Receipt }> {
  const parsed = RecordDebtorPaymentSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = getAdminClient();

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('record_customer_debt_payment', {
    p_customer_id: parsed.data.customerId,
    p_amount: parsed.data.amount,
    p_payment_method: parsed.data.paymentMethod,
    p_note: parsed.data.note || 'Debtor settlement payment',
  });

  if (!rpcErr && rpcRes && rpcRes.success) {
    revalidatePath('/ledger');
    revalidatePath('/receipt-book');
    revalidatePath('/reports');
    revalidatePath('/');

    return {
      success: true,
      receipt: {
        receipt_number: rpcRes.receipt_number,
        receipt_type: 'DEBTOR_PAYMENT',
        party_name: 'Customer',
        payment_method: parsed.data.paymentMethod,
        total_amount: parsed.data.amount,
        items_snapshot: [{ name: 'Debtor Account Settlement', unit_price: parsed.data.amount, quantity: 1, subtotal: parsed.data.amount }],
        created_at: new Date().toISOString(),
      },
    };
  }

  const { data: cust, error: custErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', parsed.data.customerId)
    .single();

  if (custErr || !cust) return { success: false, error: 'Customer not found' };

  const receiptNum = `REC-DEBT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newBalance = Math.max(0, Number(cust.balance_due) - parsed.data.amount);

  await supabase.from('customers').update({
    total_payments_made: Number(cust.total_payments_made || 0) + parsed.data.amount,
    balance_due: newBalance,
  }).eq('id', cust.id);

  await supabase.from('financial_transactions').insert({
    transaction_type: 'INCOME',
    category: 'DEBTOR_PAYMENT',
    amount: parsed.data.amount,
    payment_method: parsed.data.paymentMethod,
    reference_type: 'customers',
    reference_id: cust.id,
    party_name: cust.name,
    notes: `Debtor payment receipt ${receiptNum}`,
  });

  await supabase.from('ledger_transactions').insert({
    entity_type: 'CUSTOMER',
    entity_id: cust.id,
    entity_name: cust.name,
    transaction_type: 'PAYMENT_RECEIVED',
    amount: parsed.data.amount,
    payment_method: parsed.data.paymentMethod,
    receipt_number: receiptNum,
    note: parsed.data.note || 'Debtor settlement payment',
  });

  const { data: receiptRec } = await supabase.from('receipts').insert({
    receipt_number: receiptNum,
    receipt_type: 'DEBTOR_PAYMENT',
    party_name: cust.name,
    payment_method: parsed.data.paymentMethod,
    total_amount: parsed.data.amount,
    items_snapshot: [{ name: 'Account Debt Settlement', unit_price: parsed.data.amount, quantity: 1, subtotal: parsed.data.amount, remaining_balance: newBalance }],
  }).select().single();

  revalidatePath('/ledger');
  revalidatePath('/receipt-book');
  revalidatePath('/reports');
  revalidatePath('/');

  return {
    success: true,
    receipt: receiptRec,
  };
}

export async function recordPrepayment(formData: { customerName: string; phone?: string; amount: number; paymentMethod: string }): Promise<{ success: boolean; error?: string; receipt?: Receipt }> {
  const supabase = getAdminClient();
  const receiptNum = `REC-PRE-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  let { data: cust } = await supabase
    .from('customers')
    .select('*')
    .eq('name', formData.customerName)
    .single();

  if (!cust) {
    const { data: newCust } = await supabase
      .from('customers')
      .insert({
        name: formData.customerName,
        phone: formData.phone || null,
        store_credit: formData.amount,
      })
      .select()
      .single();
    cust = newCust;
  } else {
    await supabase
      .from('customers')
      .update({ store_credit: Number(cust.store_credit || 0) + formData.amount })
      .eq('id', cust.id);
  }

  await supabase.from('financial_transactions').insert({
    transaction_type: 'INCOME',
    category: 'STORE_CREDIT_DEPOSIT',
    amount: formData.amount,
    payment_method: formData.paymentMethod,
    reference_type: 'customers',
    reference_id: cust.id,
    party_name: cust.name,
    notes: `Prepayment deposit ${receiptNum}`,
  });

  await supabase.from('ledger_transactions').insert({
    entity_type: 'CUSTOMER',
    entity_id: cust.id,
    entity_name: cust.name,
    transaction_type: 'STORE_CREDIT_DEPOSIT',
    amount: formData.amount,
    payment_method: formData.paymentMethod,
    receipt_number: receiptNum,
    note: 'Customer advance deposit (Store Credit)',
  });

  const { data: receiptRec } = await supabase.from('receipts').insert({
    receipt_number: receiptNum,
    receipt_type: 'PREPAYMENT',
    party_name: cust.name,
    payment_method: formData.paymentMethod,
    total_amount: formData.amount,
    items_snapshot: [{ name: 'Customer Store Credit Deposit', unit_price: formData.amount, quantity: 1, subtotal: formData.amount }],
  }).select().single();

  revalidatePath('/ledger');
  revalidatePath('/receipt-book');
  revalidatePath('/sales');
  return { success: true, receipt: receiptRec };
}

export async function getCustomerTransactions(customerId: string): Promise<LedgerTransaction[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('ledger_transactions')
    .select('*')
    .eq('entity_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customer transactions:', error);
    return [];
  }
  return data || [];
}
