'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserRole } from '@/lib/types';
import { ShoppingCart, Search, Menu, X, Shield, PlusCircle, LogOut, Lock } from 'lucide-react';

interface NavbarProps {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  currency: 'UGX' | 'USD';
  setCurrency: (c: 'UGX' | 'USD') => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onLogout: () => void;
}

export default function Navbar({
  userRole,
  setUserRole,
  currency,
  setCurrency,
  mobileMenuOpen,
  setMobileMenuOpen,
  onLogout,
}: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');

  // Hotkey listener for '/' global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/sales?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    if (role === 'ADMIN') {
      return { icon: '👑', label: 'Admin', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    }
    if (role === 'STOREKEEPER') {
      return { icon: '📦', label: 'Storekeeper', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
    }
    return { icon: '🛒', label: 'Cashier', bg: 'bg-green-500/20 text-green-300 border-green-500/40' };
  };

  const badge = getRoleBadge(userRole);

  return (
    <header className="bg-slate-900 text-white min-h-[3.5rem] py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-3 sm:px-4 border-b border-slate-800 gap-2 sm:gap-4 sticky top-0 z-40 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-base shadow-sm group-hover:bg-amber-400 transition">
              HD
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-bold tracking-wide text-amber-500 leading-tight">
                HardwareDesk
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Uganda POS & Stock</span>
            </div>
          </Link>
        </div>

        {/* Mobile Quick Action & Lock */}
        <div className="flex items-center space-x-2 sm:hidden">
          <Link
            href="/sales"
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-2.5 py-1 rounded text-xs transition shadow-sm flex items-center space-x-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Sale</span>
          </Link>
          <button
            onClick={onLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded border border-slate-700 text-xs"
            title="Lock Terminal"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Global Search & Actions */}
      <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-between sm:justify-end">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:flex-initial">
          <input
            id="global-search-input"
            type="text"
            placeholder="Search products / barcode (/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-800 text-xs sm:text-sm text-gray-200 rounded px-2.5 sm:px-3 py-1.5 pl-8 w-full sm:w-56 md:w-64 focus:outline-none focus:ring-1 focus:ring-amber-500 border border-slate-700 placeholder-slate-400"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        </form>

        <Link
          href="/sales"
          className="hidden sm:inline-flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-900 font-bold px-3 py-1.5 rounded text-xs sm:text-sm transition shadow-sm whitespace-nowrap"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>+ Quick Sale</span>
        </Link>

        {/* Currency Switcher */}
        <div className="flex items-center bg-slate-800 rounded border border-slate-700 p-0.5 text-xs">
          <button
            onClick={() => setCurrency('UGX')}
            className={`px-2 py-1 rounded font-bold transition text-[11px] ${
              currency === 'UGX' ? 'bg-amber-500 text-slate-900 shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
            title="Uganda Shillings (UGX)"
          >
            UGX
          </button>
          <button
            onClick={() => setCurrency('USD')}
            className={`px-2 py-1 rounded font-bold transition text-[11px] ${
              currency === 'USD' ? 'bg-amber-500 text-slate-900 shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
            title="US Dollar (USD)"
          >
            USD ($)
          </button>
        </div>

        {/* Authenticated Role Badge & Lock/Logout Button */}
        <div className="flex items-center space-x-1.5 text-xs bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 whitespace-nowrap">
          <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${badge.bg}`}>
            {badge.icon} {badge.label}
          </span>
          <button
            onClick={onLogout}
            className="text-slate-400 hover:text-amber-400 p-1 rounded hover:bg-slate-700/60 transition flex items-center space-x-1"
            title="Lock & Switch Account (Requires Password)"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline text-[10px] text-slate-300 font-semibold">Lock</span>
          </button>
        </div>
      </div>
    </header>
  );
}
