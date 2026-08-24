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
  Store,
} from 'lucide-react';

interface SidebarProps {
  userRole: UserRole;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  minRole: UserRole[];
  badge?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    minRole: ['ADMIN', 'STOREKEEPER', 'CASHIER'],
  },
  {
    label: 'Quick Sales Terminal',
    href: '/sales',
    icon: ShoppingCart,
    minRole: ['ADMIN', 'CASHIER'],
  },
  {
    label: 'Receipt Book',
    href: '/receipt-book',
    icon: Receipt,
    minRole: ['ADMIN', 'CASHIER'],
  },
  {
    label: 'Inventory & Products',
    href: '/inventory',
    icon: Package,
    minRole: ['ADMIN', 'STOREKEEPER'],
  },
  {
    label: 'Purchases & Suppliers',
    href: '/purchases',
    icon: Truck,
    minRole: ['ADMIN', 'STOREKEEPER'],
  },
  {
    label: 'Blind Stock Take',
    href: '/stock-take',
    icon: ClipboardCheck,
    minRole: ['ADMIN', 'STOREKEEPER'],
  },
  {
    label: 'Debtors & Creditors',
    href: '/ledger',
    icon: BookOpen,
    minRole: ['ADMIN', 'STOREKEEPER'],
  },
  {
    label: 'Financial Reports',
    href: '/reports',
    icon: BarChart3,
    minRole: ['ADMIN'],
  },
];

export default function Sidebar({
  userRole,
  mobileMenuOpen,
  setMobileMenuOpen,
}: SidebarProps) {
  const pathname = usePathname();

  const isAuthorized = (itemRoles: UserRole[]) => itemRoles.includes(userRole);

  const handleLinkClick = () => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <>
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-14 sm:top-16 inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-3 sm:p-4 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Main Navigation
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const allowed = isAuthorized(item.minRole);
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (!allowed) return null;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleLinkClick}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs">
              {userRole.charAt(0)}
            </div>
            <div className="text-xs leading-tight">
              <span className="font-bold text-slate-900 block">{userRole} Session</span>
              <span className="text-[10px] text-slate-500">Uganda Hardware POS</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
