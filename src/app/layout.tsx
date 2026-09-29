import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppProvider from '@/components/AppProvider';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import BRAND_CONFIG from '@/lib/brandConfig';

export const metadata: Metadata = {
  title: `${BRAND_CONFIG.shopName} — POS & Stock Management`,
  description: `${BRAND_CONFIG.shopName}: Fast, database-backed Point-of-Sale, Inventory, and Ledger Management in Uganda.`,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: BRAND_CONFIG.shopName,
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
        <meta name="apple-mobile-web-app-title" content={BRAND_CONFIG.shopName} />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="antialiased selection:bg-blue-600 selection:text-white bg-slate-50 text-slate-900">
        <PwaInstallPrompt />
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
