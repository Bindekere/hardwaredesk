'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserRole } from '@/lib/types';
import { ShoppingCart, Search, Menu, X, PlusCircle, Lock } from 'lucide-react';
import { InstallAppButton } from '@/components/PwaInstallPrompt';
import BRAND_CONFIG from '@/lib/brandConfig';

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
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  // Hotkey listener for '/' global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
          searchInput.focus();
        } else {
          setShowMobileSearch(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/sales?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowMobileSearch(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    if (role === 'ADMIN') {
      return { icon: '👑', label: 'Admin', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
    }
    if (role === 'STOREKEEPER') {
      return { icon: '📦', label: 'Storekeeper', bg: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
    }
    return { icon: '🛒', label: 'Cashier', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
  };

  const badge = getRoleBadge(userRole);

  return (
    <header className="bg-slate-900/95 backdrop-blur-md text-white sticky top-0 z-40 border-b border-slate-800 shadow-sm transition-all">
      {/* Primary Slim Single-Row Navigation Bar (h-14 / 56px) */}
      <div className="h-14 px-3 sm:px-4 flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Left: Mobile Menu Toggle + Brand Identity */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-blue-400" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-xs sm:text-sm shadow-xs group-hover:bg-blue-500 transition shrink-0">
              {BRAND_CONFIG.badge}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-white leading-tight truncate max-w-[125px] xs:max-w-[180px] sm:max-w-none">
                {BRAND_CONFIG.shopName}
              </span>
              <span className="hidden md:inline text-[10px] text-blue-300 font-medium leading-none truncate max-w-[220px]">
                {BRAND_CONFIG.tagline}
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Global Search Bar */}
        <div className="hidden md:flex flex-1 max-w-xs lg:max-w-sm mx-2 lg:mx-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              id="global-search-input"
              type="text"
              placeholder="Search products / barcode (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800/80 hover:bg-slate-800 text-xs sm:text-sm text-gray-200 rounded-lg px-3 py-1.5 pl-8 w-full focus:outline-none focus:ring-1 focus:ring-blue-500 border border-slate-700/80 placeholder-slate-400 transition"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <kbd className="hidden lg:inline-flex items-center justify-center absolute right-2.5 top-2 text-[10px] bg-slate-700/60 text-slate-400 px-1.5 py-0.2 rounded border border-slate-600/50 font-mono">
              /
            </kbd>
          </form>
        </div>

        {/* Right: Actions, Currency Switcher, Role & Lock */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Mobile Search Toggle Icon */}
          <button
            type="button"
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className={`md:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition ${
              showMobileSearch ? 'bg-slate-800 text-blue-400' : ''
            }`}
            aria-label="Toggle Search"
            title="Search products"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Desktop Currency Switcher */}
          <div className="hidden sm:flex items-center bg-slate-800/80 rounded-lg border border-slate-700/80 p-0.5 text-xs">
            <button
              onClick={() => setCurrency('UGX')}
              className={`px-2 py-1 rounded-md font-bold transition text-[11px] ${
                currency === 'UGX' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Uganda Shillings (UGX)"
            >
              UGX
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-2 py-1 rounded-md font-bold transition text-[11px] ${
                currency === 'USD' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="US Dollar (USD)"
            >
              USD
            </button>
          </div>

          {/* Desktop Install App on Device */}
          <InstallAppButton className="hidden lg:inline-flex text-xs py-1 px-2.5" />

          {/* Quick Sale Action Button */}
          <Link
            href="/sales"
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition shadow-xs flex items-center space-x-1 whitespace-nowrap"
            title="Open Quick Sales POS Terminal"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Sale</span>
          </Link>

          {/* Role Badge & Lock Terminal Trigger */}
          <button
            onClick={onLogout}
            className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-800/90 hover:bg-slate-700/90 active:bg-slate-800 text-slate-200 px-2 sm:px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-xs font-semibold transition"
            title={`Active as ${badge.label}. Tap to lock or switch account.`}
          >
            <span className="text-xs">{badge.icon}</span>
            <span className="hidden xs:inline text-[11px] font-bold text-slate-300">{badge.label}</span>
            <Lock className="w-3 h-3 text-blue-400 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Expandable Mobile Search Bar (Smoothly slides down when search icon is clicked) */}
      {showMobileSearch && (
        <div className="md:hidden border-t border-slate-800/90 bg-slate-900 px-3 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <input
              type="text"
              placeholder="Search products by name, SKU or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 text-xs sm:text-sm text-gray-200 rounded-lg px-3 py-2 pl-9 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700 placeholder-slate-400"
              autoFocus
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowMobileSearch(false)}
                className="absolute right-2 text-slate-400 hover:text-white p-1 text-xs"
              >
                ✕
              </button>
            )}
          </form>
        </div>
      )}
    </header>
  );
}
