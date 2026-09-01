'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '@/lib/types';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import LoginScreen from '@/components/LoginScreen';

interface AppContextType {
  isAuthenticated: boolean;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  currency: 'UGX' | 'USD';
  setCurrency: (currency: 'UGX' | 'USD') => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType>({
  isAuthenticated: false,
  userRole: 'ADMIN',
  setUserRole: () => {},
  currency: 'UGX',
  setCurrency: () => {},
  logout: () => {},
});

export const useApp = () => useContext(AppContext);

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole>('ADMIN');
  const [currency, setCurrency] = useState<'UGX' | 'USD'>('UGX');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read saved session from localStorage on mount
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('hd_auth_session');
      const savedRole = localStorage.getItem('hd_user_role') as UserRole;
      const savedCurrency = localStorage.getItem('hd_currency') as 'UGX' | 'USD';

      if (savedAuth === 'true' && savedRole) {
        setIsAuthenticated(true);
        setUserRole(savedRole);
      }
      if (savedCurrency) {
        setCurrency(savedCurrency);
      }
    } catch (_) {}
    setIsHydrated(true);
  }, []);

  const handleLoginSuccess = (role: UserRole) => {
    setIsAuthenticated(true);
    setUserRole(role);
    try {
      localStorage.setItem('hd_auth_session', 'true');
      localStorage.setItem('hd_user_role', role);
    } catch (_) {}
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('hd_auth_session');
      localStorage.removeItem('hd_user_role');
    } catch (_) {}
  };

  const handleSetUserRole = (role: UserRole) => {
    setUserRole(role);
    try {
      localStorage.setItem('hd_user_role', role);
    } catch (_) {}
  };

  const handleSetCurrency = (c: 'UGX' | 'USD') => {
    setCurrency(c);
    try {
      localStorage.setItem('hd_currency', c);
    } catch (_) {}
  };

  // Prevent flash before checking localStorage
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-amber-500 font-bold">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider text-slate-400">Loading HardwareDesk...</span>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show password login gate
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLoginSuccess} />;
  }

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        userRole,
        setUserRole: handleSetUserRole,
        currency,
        setCurrency: handleSetCurrency,
        logout: handleLogout,
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
          onLogout={handleLogout}
        />
        <div className="flex flex-1 relative">
          <Sidebar
            userRole={userRole}
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            onLogout={handleLogout}
          />
          <main className="flex-1 p-3 sm:p-5 md:p-6 max-w-full overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
