'use client';

import React, { useState } from 'react';
import { Receipt } from '@/lib/types';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { Printer, Download, X, CheckCircle, Store, FileText } from 'lucide-react';

interface ReceiptModalProps {
  receipt: Receipt | null;
  onClose: () => void;
  currency?: 'UGX' | 'USD';
  shopName?: string;
  shopContact?: string;
}

export default function ReceiptModal({
  receipt,
  onClose,
  currency = 'UGX',
  shopName = 'HardwareDesk Uganda',
  shopContact = 'Tel: +256 700 000 000 | Kampala, Uganda',
}: ReceiptModalProps) {
  const [printFormat, setPrintFormat] = useState<'80mm' | 'A4'>('80mm');

  if (!receipt) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    if (printFormat === '80mm') {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt ${receipt.receipt_number}</title>
            <meta charset="utf-8" />
            <style>
              @page { size: 80mm auto; margin: 0; }
              body {
                font-family: 'Courier New', Courier, monospace;
                width: 72mm;
                margin: 0 auto;
                padding: 10px 0;
                font-size: 11px;
                color: #000;
                line-height: 1.2;
              }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
              .double-divider { border-bottom: 2px dashed #000; margin: 8px 0; }
              .flex { display: flex; justify-content: space-between; }
              .items-table { width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 11px; }
              .items-table th, .items-table td { text-align: left; padding: 2px 0; }
              .items-table .right { text-align: right; }
              .total-row { font-size: 13px; font-weight: bold; margin: 4px 0; }
            </style>
          </head>
          <body>
            <div class="center bold" style="font-size: 14px;">${shopName}</div>
            <div class="center" style="font-size: 9px; margin-top: 2px;">${shopContact}</div>
            <div class="double-divider"></div>
            
            <div class="flex"><span>Receipt #:</span><span class="bold">${receipt.receipt_number}</span></div>
            <div class="flex"><span>Date:</span><span>${formatDateTime(receipt.created_at)}</span></div>
            <div class="flex"><span>Customer:</span><span class="bold">${receipt.party_name}</span></div>
            <div class="flex"><span>Payment:</span><span>${receipt.payment_method}</span></div>
            
            <div class="divider"></div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 50%;">Item</th>
                  <th class="right" style="width: 15%;">Qty</th>
                  <th class="right" style="width: 35%;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${(receipt.items_snapshot || []).map((item: any) => `
                  <tr>
                    <td>${item.name || item.product_name}</td>
                    <td class="right">${item.quantity}</td>
                    <td class="right">${formatCurrency(item.subtotal || (item.quantity * item.unit_price), currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="divider"></div>
            
            <div class="flex total-row">
              <span>TOTAL DUE:</span>
              <span>${formatCurrency(receipt.total_amount, currency)}</span>
            </div>
            
            <div class="double-divider"></div>
            <div class="center" style="font-size: 9px;">Goods once sold are only returnable within 48 hours in original condition with valid receipt.</div>
            <div class="center bold" style="margin-top: 6px;">THANK YOU FOR YOUR BUSINESS!</div>
            <script>
              window.onload = function() { window.print(); };
            </script>
          </body>
        </html>
      `);
    } else {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice ${receipt.receipt_number}</title>
            <meta charset="utf-8" />
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 40px;
                color: #1e293b;
                font-size: 13px;
              }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
              .brand h1 { margin: 0; font-size: 24px; color: #0f172a; }
              .invoice-title { text-align: right; }
              .invoice-title h2 { margin: 0; font-size: 22px; color: #d97706; }
              .meta-grid { display: flex; justify-content: space-between; margin: 25px 0; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
              th { background-color: #0f172a; color: #fff; font-weight: 600; font-size: 12px; text-transform: uppercase; }
              .right { text-align: right; }
              .total-box { margin-left: auto; width: 300px; margin-top: 20px; }
              .total-box tr td:last-child { font-weight: bold; text-align: right; }
              .footer { margin-top: 50px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="brand">
                <h1>${shopName}</h1>
                <p style="margin: 4px 0; color: #64748b;">Hardware, Tools & Construction Supplies</p>
                <p style="margin: 2px 0; font-size: 11px;">${shopContact}</p>
              </div>
              <div class="invoice-title">
                <h2>OFFICIAL INVOICE / RECEIPT</h2>
                <p style="margin: 4px 0;"><strong>Receipt #:</strong> ${receipt.receipt_number}</p>
                <p style="margin: 2px 0;"><strong>Date:</strong> ${formatDateTime(receipt.created_at)}</p>
              </div>
            </div>

            <div class="meta-grid">
              <div>
                <strong>Billed To:</strong>
                <p style="margin: 4px 0; font-size: 14px; font-weight: bold;">${receipt.party_name}</p>
              </div>
              <div style="text-align: right;">
                <strong>Payment Channel:</strong>
                <p style="margin: 4px 0; font-weight: bold;">${receipt.payment_method}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 8%;">#</th>
                  <th>Item Description</th>
                  <th class="right" style="width: 15%;">Unit Price</th>
                  <th class="right" style="width: 12%;">Quantity</th>
                  <th class="right" style="width: 20%;">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                ${(receipt.items_snapshot || []).map((item: any, idx: number) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${item.name || item.product_name}</strong></td>
                    <td class="right">${formatCurrency(item.unit_price || 0, currency)}</td>
                    <td class="right">${item.quantity}</td>
                    <td class="right">${formatCurrency(item.subtotal || (item.quantity * item.unit_price), currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <table class="total-box">
              <tr>
                <td><strong>Grand Total:</strong></td>
                <td style="font-size: 16px; color: #0f172a;">${formatCurrency(receipt.total_amount, currency)}</td>
              </tr>
            </table>

            <div class="footer">
              Thank you for trusting ${shopName}. All goods subject to company warranty terms.
            </div>
            <script>
              window.onload = function() { window.print(); };
            </script>
          </body>
        </html>
      `);
    }

    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-gray-100 my-8">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Transaction Receipt
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center space-x-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setPrintFormat('80mm')}
            className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center space-x-1 ${
              printFormat === '80mm' ? 'bg-white text-slate-950 shadow-xs font-bold' : 'text-slate-600'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>80mm Thermal Receipt</span>
          </button>
          <button
            onClick={() => setPrintFormat('A4')}
            className={`flex-1 py-1.5 rounded-lg transition flex items-center justify-center space-x-1 ${
              printFormat === 'A4' ? 'bg-white text-slate-950 shadow-xs font-bold' : 'text-slate-600'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>A4 Official Invoice</span>
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 font-mono text-xs space-y-2 max-h-72 overflow-y-auto">
          <div className="text-center font-bold text-slate-800 text-sm">
            {shopName}
          </div>
          <div className="text-center text-[10px] text-slate-500">
            {shopContact}
          </div>
          <div className="border-b border-dashed border-slate-300 my-2" />

          <div className="flex justify-between">
            <span className="text-slate-500">Receipt #:</span>
            <span className="font-bold text-slate-900">{receipt.receipt_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Customer:</span>
            <span className="font-semibold text-slate-900">{receipt.party_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Payment:</span>
            <span className="font-semibold text-amber-800 bg-amber-100 px-1.5 rounded">
              {receipt.payment_method}
            </span>
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          <div className="space-y-1">
            {(receipt.items_snapshot || []).map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between items-start text-slate-800">
                <span className="truncate max-w-[180px]">
                  {item.quantity}x {item.name || item.product_name}
                </span>
                <span className="font-bold">
                  {formatCurrency(item.subtotal || (item.quantity * item.unit_price), currency)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          <div className="flex justify-between font-black text-sm text-slate-900">
            <span>TOTAL:</span>
            <span>{formatCurrency(receipt.total_amount, currency)}</span>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl shadow-xs transition flex items-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print {printFormat === '80mm' ? 'Thermal' : 'A4'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
