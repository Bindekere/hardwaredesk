'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, ShoppingCart } from 'lucide-react';

export default function SalesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Quick Sales Terminal error caught:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl border border-slate-200">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <ShoppingCart className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-black text-slate-900">Quick Sales Terminal Interrupted</h2>
          <p className="text-xs text-slate-500">
            A temporary connection or render issue occurred while loading catalog data.
          </p>
        </div>

        <button
          onClick={() => reset()}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs transition flex items-center justify-center space-x-1.5 shadow-md shadow-blue-900/20"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload Sales Terminal</span>
        </button>
      </div>
    </div>
  );
}
