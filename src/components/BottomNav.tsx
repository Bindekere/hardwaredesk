'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Menu,
} from 'lucide-react';

interface BottomNavProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export default function BottomNav({ mobileMenuOpen, setMobileMenuOpen }: BottomNavProps) {
  const pathname = usePathname();

  // Hide the general bottom nav on POS Terminal (/sales)
  // because /sales has its own dedicated cart checkout drawer and mobile bottom bar
  if (pathname === '/sales') {
    return null;
  }

  const navItems = [
    {
      name: 'Home',
      href: '/',
      icon: LayoutDashboard,
      isActive: pathname === '/',
    },
    {
      name: 'POS Sale',
      href: '/sales',
      icon: ShoppingCart,
      isSpecial: true,
      isActive: pathname === '/sales',
    },
    {
      name: 'Receipts',
      href: '/receipt-book',
      icon: Receipt,
      isActive: pathname === '/receipt-book',
    },
    {
      name: 'Stock',
      href: '/inventory',
      icon: Package,
      isActive: pathname === '/inventory',
    },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-30 shadow-lg px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          if (item.isSpecial) {
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-3.5 group relative"
              >
                <div className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-blue-900/50 transition border-2 border-slate-900">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-blue-400 mt-0.5 tracking-tight">
                  {item.name}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition min-w-[54px] ${
                item.isActive
                  ? 'text-blue-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${item.isActive ? 'text-blue-400' : 'text-slate-400'}`} />
              <span className="text-[10px] leading-tight">
                {item.name}
              </span>
              {item.isActive && (
                <span className="w-1 h-1 bg-blue-500 rounded-full mt-0.5" />
              )}
            </Link>
          );
        })}

        {/* Menu Toggle button (opens full sidebar with Reports, Ledger, POs, etc.) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition min-w-[54px] ${
            mobileMenuOpen
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Open Full Navigation Menu"
        >
          <Menu className={`w-4 h-4 mb-0.5 ${mobileMenuOpen ? 'text-blue-400' : 'text-slate-400'}`} />
          <span className="text-[10px] leading-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
