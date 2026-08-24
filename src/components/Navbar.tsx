'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/types';
import {
  ShoppingCart,
  Search,
  User,
  Shield,
  Menu,
  X,
  Store,
} from 'lucide-react';

interface NavbarProps {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  currency: 'UGX' | 'USD';
  setCurrency: (currency: 'UGX' | 'USD') => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export default function Navbar({
  userRole,
  setUserRole,
  currency,
  setCurrency,
  mobileMenuOpen,
  setMobileMenuOpen,
}: NavbarProps) {
  const router = useRouter();

  const handleSearchKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const query = (e.target as HTMLInputElement).value;
      if (query.trim()) {
        router.push(`/sales?q=${encodeURIComponent(query)}`);
      }
    }
  };

  return (
    <header className="bg-slate-900 text-white sticky top-0 z-40 border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-base sm:text-lg shadow-sm group-hover:scale-105 transition">
                H
              </div>
              <div className="leading-tight">
                <span className="font-extrabold text-sm sm:text-lg tracking-tight text-white flex items-center gap-1">
                  HardwareDesk <span className="text-amber-400 font-mono text-xs font-semibold px-1.5 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">UG</span>
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 block -mt-0.5">
                  Kampala Shop POS & Inventory
                </span>
              </div>
            </Link>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Quick search products, barcodes, SKUs... (Press Enter)"
                onKeyDown={handleSearchKeydown}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 pl-9 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <kbd className="hidden lg:inline-block absolute right-2.5 top-2 text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded border border-slate-600 font-mono">
                /
              </kbd>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-3">
            <Link
              href="/sales"
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm flex items-center space-x-1.5 shadow-sm transition"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden xs:inline">Quick Sale</span>
            </Link>

            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => setCurrency('UGX')}
                className={`px-2 py-1 rounded-md transition ${
                  currency === 'UGX' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                UGX
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-2 py-1 rounded-md transition ${
                  currency === 'USD' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                USD
              </button>
            </div>

            <div className="relative flex items-center">
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as UserRole)}
                className="bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-white text-xs font-semibold rounded-lg px-2 sm:px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 transition cursor-pointer appearance-none pr-6 sm:pr-7"
                title="Switch User Role Permissions"
              >
                <option value="ADMIN">Admin (Full Access)</option>
                <option value="STOREKEEPER">Storekeeper (Inventory/PO)</option>
                <option value="CASHIER">Cashier (POS & Sales)</option>
              </select>
              <Shield className="w-3.5 h-3.5 text-amber-400 absolute right-2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
