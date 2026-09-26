import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppProvider from '@/components/AppProvider';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';

export const metadata: Metadata = {
  title: 'HardwareDesk — Uganda Hardware Shop & POS System',
  description: 'Fast, database-backed Point-of-Sale, Inventory, and Ledger Management for Hardware shops in Uganda.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HardwareDesk',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased selection:bg-amber-500 selection:text-slate-950">
        <AppProvider>
          {children}
          <PwaInstallPrompt />
        </AppProvider>
      </body>
    </html>
  );
}
