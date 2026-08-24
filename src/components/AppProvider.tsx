'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '@/lib/types';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

interface AppContextType {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  currency: 'UGX' | 'USD';
  setCurrency: (currency: 'UGX' | 'USD') => void;
}

const AppContext = createContext<AppContextType>({
  userRole: 'ADMIN',
  setUserRole: () => {},
  currency: 'UGX',
  setCurrency: () => {},
});

export const useApp = () => useContext(AppContext);

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<UserRole>('ADMIN');
  const [currency, setCurrency] = useState<'UGX' | 'USD'>('UGX');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const savedRole = localStorage.getItem('hd_user_role') as UserRole;
      if (savedRole) setUserRole(savedRole);
      const savedCurrency = localStorage.getItem('hd_currency') as 'UGX' | 'USD';
      if (savedCurrency) setCurrency(savedCurrency);
    } catch (_) {}
  }, []);

  const handleSetUserRole = (role: UserRole) => {
    setUserRole(role);
    try { localStorage.setItem('hd_user_role', role); } catch (_) {}
  };

  const handleSetCurrency = (c: 'UGX' | 'USD') => {
    setCurrency(c);
    try { localStorage.setItem('hd_currency', c); } catch (_) {}
  };

  return (
    <AppContext.Provider
      value={{
        userRole,
        setUserRole: handleSetUserRole,
        currency,
        setCurrency: handleSetCurrency,
      }}
    >
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <Navbar
          userRole={userRole}
          setUserRole={handleSetUserRole}
          currency={currency}
          setCurrency={handleSetCurrency}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
        <div className="flex flex-1 relative">
          <Sidebar
            userRole={userRole}
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
          />
          <main className="flex-1 p-3 sm:p-5 md:p-6 max-w-full overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
