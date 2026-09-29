'use client';

import React, { useState } from 'react';
import { UserRole } from '@/lib/types';
import { Shield, KeyRound, Lock, ArrowRight, AlertCircle, Store, CheckCircle2 } from 'lucide-react';
import { InstallAppButton } from '@/components/PwaInstallPrompt';
import BrandLogo from '@/components/BrandLogo';
import { BRAND_CONFIG } from '@/lib/brandConfig';

interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>('ADMIN');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = password.trim();

    // Password Validation Rules
    // Admin Password: 2411
    // Storekeeper & Cashier Password: 1233
    if (selectedRole === 'ADMIN') {
      if (trimmed === '2411') {
        onLogin('ADMIN');
      } else {
        setError('Incorrect Admin Password. (Required: 2411)');
      }
    } else if (selectedRole === 'STOREKEEPER') {
      if (trimmed === '1233' || trimmed === '2411') {
        onLogin('STOREKEEPER');
      } else {
        setError('Incorrect Storekeeper Password. (Required: 1233)');
      }
    } else if (selectedRole === 'CASHIER') {
      if (trimmed === '1233' || trimmed === '2411') {
        onLogin('CASHIER');
      } else {
        setError('Incorrect Cashier Password. (Required: 1233)');
      }
    }
  };

  const handleKeypadPress = (val: string) => {
    setError(null);
    if (val === 'CLEAR') {
      setPassword('');
    } else if (val === 'BACK') {
      setPassword(prev => prev.slice(0, -1));
    } else if (password.length < 8) {
      setPassword(prev => prev + val);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-blue-600/15 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <BrandLogo size="xl" className="mx-auto justify-center" />
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
              {BRAND_CONFIG.shopName}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {BRAND_CONFIG.businessType} · POS & Stock Terminal
            </p>
          </div>
        </div>

        {/* Role Selector Tabs */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
            Select User Account Role
          </label>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setSelectedRole('ADMIN'); setPassword(''); setError(null); }}
              className={`py-2 px-1 text-xs font-extrabold rounded-xl transition ${
                selectedRole === 'ADMIN'
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => { setSelectedRole('STOREKEEPER'); setPassword(''); setError(null); }}
              className={`py-2 px-1 text-xs font-extrabold rounded-xl transition ${
                selectedRole === 'STOREKEEPER'
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              📦 Storekeeper
            </button>
            <button
              type="button"
              onClick={() => { setSelectedRole('CASHIER'); setPassword(''); setError(null); }}
              className={`py-2 px-1 text-xs font-extrabold rounded-xl transition ${
                selectedRole === 'CASHIER'
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              🛒 Cashier
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                <span>Enter {selectedRole} Password / PIN</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedRole === 'ADMIN' ? 'Admin Security' : 'Staff Passcode'}
              </span>
            </label>

            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                placeholder="••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-center tracking-[0.4em] text-2xl py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Keypad */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'BACK'].map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => handleKeypadPress(btn)}
                className={`py-3 rounded-xl font-mono text-sm sm:text-base font-bold transition select-none ${
                  btn === 'CLEAR'
                    ? 'bg-slate-800/80 text-red-400 hover:bg-red-500/20 text-xs'
                    : btn === 'BACK'
                    ? 'bg-slate-800/80 text-blue-400 hover:bg-blue-500/20 text-xs'
                    : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white shadow-xs'
                }`}
              >
                {btn === 'CLEAR' ? 'Clear' : btn === 'BACK' ? '⌫ Del' : btn}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={password.length === 0}
            className={`w-full py-3.5 rounded-2xl font-black text-sm transition shadow-lg flex items-center justify-center space-x-2 ${
              password.length > 0
                ? 'bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white shadow-blue-600/30 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Unlock {selectedRole} Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <InstallAppButton className="w-full justify-center py-2.5 text-xs bg-slate-800/80 hover:bg-slate-800 text-blue-300 border-slate-700/80 rounded-xl" />
        </form>

        {/* Security Footer Note */}
        <div className="pt-2 border-t border-slate-800/60 text-center">
          <p className="text-[11px] text-slate-500">
            Powered by {BRAND_CONFIG.engineName} · {BRAND_CONFIG.shopName}
          </p>
        </div>
      </div>
    </div>
  );
}
