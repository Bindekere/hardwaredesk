import type { MetadataRoute } from 'next';
import BRAND_CONFIG from '@/lib/brandConfig';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_CONFIG.shopName} — Uganda POS & Inventory`,
    short_name: BRAND_CONFIG.shortName,
    description: `Database-backed POS, Inventory, and Ledger Management for ${BRAND_CONFIG.shopName} in Uganda.`,
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'window-controls-overlay'],
    orientation: 'any',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    lang: 'en',
    dir: 'ltr',
    categories: ['business', 'finance', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Quick Sales POS',
        short_name: 'Quick Sales',
        description: 'Open POS Terminal',
        url: '/sales',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Inventory & Stock',
        short_name: 'Inventory',
        description: 'Manage products and stock levels',
        url: '/inventory',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Financial Reports',
        short_name: 'Reports',
        description: 'View shop profit, revenue, and stock valuation',
        url: '/reports',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
