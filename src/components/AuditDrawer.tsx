'use client';

import React from 'react';
import { LedgerTransaction } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { X, ArrowDownLeft, ArrowUpRight, Clock, FileText } from 'lucide-react';

interface AuditDrawerProps {
  entity: {
    id: string;
    name: string;
    phone?: string | null;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    storeCredit?: number;
  } | null;
  transactions: LedgerTransaction[];
  onClose: () => void;
  currency?: 'UGX' | 'USD';
}

export default function AuditDrawer({
  entity,
  transactions,
  onClose,
  currency = 'UGX',
}: AuditDrawerProps) {
  if (!entity) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200">
          <div>
            <div className="p-4 sm:p-6 bg-slate-900 text-white flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  Audit Trail Ledger
                </span>
                <h2 className="text-lg font-bold mt-1 text-white">{entity.name}</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{entity.phone || 'No phone recorded'}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 border-b border-slate-200 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Balance Due</span>
                <p className={`font-black text-sm mt-0.5 ${entity.balanceDue > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatCurrency(entity.balanceDue, currency)}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Total Settled</span>
                <p className="font-black text-sm text-green-600 mt-0.5">
                  {formatCurrency(entity.amountPaid, currency)}
                </p>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(100vh-280px)] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Chronological Entries ({transactions.length})
              </h3>

              {transactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No historical ledger entries for this account yet.
                </div>
              ) : (
                transactions.map((tx) => {
                  const isDebit = ['CREDIT_SALE', 'PURCHASE_ON_CREDIT'].includes(tx.transaction_type);
                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition space-y-1.5"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-1.5">
                          <div className={`p-1 rounded-md ${isDebit ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {isDebit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 block">
                              {tx.transaction_type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{formatDateTime(tx.created_at)}</span>
                            </span>
                          </div>
                        </div>
                        <span className={`font-black text-xs font-mono ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                          {isDebit ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                        </span>
                      </div>

                      {tx.note && (
                        <p className="text-[11px] text-slate-600 italic bg-white p-1.5 rounded border border-slate-100">
                          {tx.note}
                        </p>
                      )}

                      {tx.receipt_number && (
                        <div className="text-[10px] text-slate-400 flex items-center space-x-1 font-mono">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span>Ref: {tx.receipt_number}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={onClose}
              className="w-full py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
