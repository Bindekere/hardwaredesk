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
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  userRole: UserRole;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onLogout?: () => void;
}

export default function Sidebar({
  userRole,
  mobileMenuOpen,
  setMobileMenuOpen,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['ADMIN', 'STOREKEEPER', 'CASHIER'] },
    { name: 'Quick Sales', href: '/sales', icon: ShoppingCart, roles: ['ADMIN', 'STOREKEEPER', 'CASHIER'] },
    { name: 'Receipt Book', href: '/receipt-book', icon: Receipt, roles: ['ADMIN', 'STOREKEEPER', 'CASHIER'] },
    { name: 'Inventory & Products', href: '/inventory', icon: Package, roles: ['ADMIN', 'STOREKEEPER'] },
    { name: 'Purchases & Suppliers', href: '/purchases', icon: Truck, roles: ['ADMIN', 'STOREKEEPER'] },
    { name: 'Stock Take', href: '/stock-take', icon: ClipboardCheck, roles: ['ADMIN', 'STOREKEEPER'] },
    { name: 'Debtors & Creditors', href: '/ledger', icon: BookOpen, roles: ['ADMIN', 'STOREKEEPER'] },
    { name: 'Financial Reports', href: '/reports', icon: BarChart3, roles: ['ADMIN'] },
  ];

  const allowedItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-30 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 top-[3.5rem] lg:top-0
          w-64 lg:w-56 bg-slate-800 text-slate-300 p-3 space-y-1
          transform transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          shadow-2xl lg:shadow-none flex flex-col justify-between overflow-y-auto shrink-0 border-r border-slate-700/60
        `}
      >
        <div className="space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider lg:hidden border-b border-slate-700 mb-2">
            Navigation Menu
          </div>
          {allowedItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-700/60 text-xs text-slate-400 px-2 space-y-3">
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-950 text-amber-400 border border-slate-700 py-2 px-3 rounded-xl font-bold text-xs transition shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Terminal</span>
            </button>
          )}

          <div className="px-1 space-y-0.5">
            <div className="font-semibold text-slate-200 flex items-center justify-between">
              <span>HardwareDesk</span>
              <span className="text-[10px] bg-slate-700 text-amber-400 px-1.5 py-0.5 rounded font-mono">UG</span>
            </div>
            <div className="text-[10px] text-slate-400">Uganda Hardware Engine</div>
          </div>
        </div>
      </aside>
    </>
  );
}
