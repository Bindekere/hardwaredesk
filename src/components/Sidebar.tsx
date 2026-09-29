'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/lib/types';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Truck,
  ClipboardCheck,
  BookOpen,
  BarChart3,
  Lock,
  X,
  Shield,
  Smartphone,
} from 'lucide-react';
import { InstallAppButton } from '@/components/PwaInstallPrompt';
import { BRAND_CONFIG } from '@/lib/brandConfig';

interface SidebarProps {
  userRole: UserRole;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  currency?: 'UGX' | 'USD';
  setCurrency?: (c: 'UGX' | 'USD') => void;
  onLogout?: () => void;
}

export default function Sidebar({
  userRole,
  mobileMenuOpen,
  setMobileMenuOpen,
  currency,
  setCurrency,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();

  const navSections = [
    {
      title: 'Operations',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['ADMIN', 'STOREKEEPER', 'CASHIER'] },
        { name: 'Quick Sales', href: '/sales', icon: ShoppingCart, roles: ['ADMIN', 'STOREKEEPER', 'CASHIER'] },
        { name: 'Receipt Book', href: '/receipt-book', icon: Receipt, roles: ['ADMIN', 'STOREKEEPER', 'CASHIER'] },
      ],
    },
    {
      title: 'Stock Management',
      items: [
        { name: 'Inventory & Products', href: '/inventory', icon: Package, roles: ['ADMIN', 'STOREKEEPER'] },
        { name: 'Purchases & Suppliers', href: '/purchases', icon: Truck, roles: ['ADMIN', 'STOREKEEPER'] },
        { name: 'Physical Stock Take', href: '/stock-take', icon: ClipboardCheck, roles: ['ADMIN', 'STOREKEEPER'] },
      ],
    },
    {
      title: 'Accounting & Audits',
      items: [
        { name: 'Debtors & Creditors', href: '/ledger', icon: BookOpen, roles: ['ADMIN', 'STOREKEEPER'] },
        { name: 'Financial Reports', href: '/reports', icon: BarChart3, roles: ['ADMIN'] },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Aside Drawer */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 lg:z-30 top-0 lg:top-0
          w-72 lg:w-56 bg-slate-900 text-slate-300 p-3 sm:p-4
          transform transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          shadow-2xl lg:shadow-none flex flex-col justify-between overflow-y-auto shrink-0 border-r border-slate-800
        `}
      >
        <div className="space-y-4">
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between lg:hidden border-b border-slate-800 pb-3 -mx-1 px-1">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-xs shadow-xs">
                {BRAND_CONFIG.badge}
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-white leading-tight">{BRAND_CONFIG.shopName}</h2>
                <p className="text-[10px] text-blue-300 font-medium">{BRAND_CONFIG.businessType} POS</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close Navigation Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Shift Card */}
          <div className="bg-slate-800/80 rounded-xl p-2.5 border border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-base">{userRole === 'ADMIN' ? '👑' : userRole === 'STOREKEEPER' ? '📦' : '🛒'}</span>
              <div>
                <div className="text-xs font-bold text-white leading-tight">{userRole} Account</div>
                <div className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active Session</span>
                </div>
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-950/60 border border-blue-800/60 px-2 py-1 rounded-md transition"
              >
                Lock
              </button>
            )}
          </div>

          {/* Mobile Currency Switcher */}
          {currency && setCurrency && (
            <div className="sm:hidden bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Store Currency</span>
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrency('UGX')}
                  className={`flex-1 py-1 rounded-md text-xs font-bold transition ${
                    currency === 'UGX' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  UGX (Shillings)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`flex-1 py-1 rounded-md text-xs font-bold transition ${
                    currency === 'USD' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  USD ($)
                </button>
              </div>
            </div>
          )}

          {/* Categorized Navigation Links */}
          <div className="space-y-3">
            {navSections.map((section) => {
              const allowedInSection = section.items.filter(item => item.roles.includes(userRole));
              if (allowedInSection.length === 0) return null;

              return (
                <div key={section.title} className="space-y-1">
                  <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {section.title}
                  </div>
                  {allowedInSection.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/30'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="pt-4 mt-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
          {/* Prominent Mobile App Install Button */}
          <InstallAppButton className="w-full justify-center py-2" />

          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 py-2 px-3 rounded-xl font-bold text-xs transition"
            >
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span>Lock Terminal</span>
            </button>
          )}

          {/* White-Label Store & Engine Attribution */}
          <div className="px-1 pt-1 space-y-0.5 border-t border-slate-800/60">
            <div className="font-semibold text-slate-200 flex items-center justify-between text-[11px]">
              <span className="truncate">{BRAND_CONFIG.shopName}</span>
              <span className="text-[10px] bg-blue-900/80 text-blue-300 border border-blue-700/60 px-1.5 py-0.5 rounded font-mono shrink-0 ml-1">
                {BRAND_CONFIG.badge}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>{BRAND_CONFIG.engineName}</span>
              <span className="text-[9px] text-slate-500 font-mono">v{BRAND_CONFIG.version}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
