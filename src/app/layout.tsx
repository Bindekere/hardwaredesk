import type { Metadata } from 'next';
import './globals.css';
import AppProvider from '@/components/AppProvider';

export const metadata: Metadata = {
  title: 'HardwareDesk — Uganda Hardware Shop & POS System',
  description: 'Fast, database-backed Point-of-Sale, Inventory, and Ledger Management for Hardware shops in Uganda.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-amber-500 selection:text-slate-950">
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
