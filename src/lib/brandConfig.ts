/**
 * Brand & Store Profile Configuration
 * 
 * HardwareDesk is an enterprise multi-tenant POS engine.
 * For this client deployment, the active profile is customized to "S.H Paint World".
 * All business details, receipt headers, and phone numbers are managed here as the
 * single source of truth.
 */

export const BRAND_CONFIG = {
  // Store Identity
  shopName: (process.env.NEXT_PUBLIC_SHOP_NAME && !process.env.NEXT_PUBLIC_SHOP_NAME.toLowerCase().includes('hardwaredesk'))
    ? process.env.NEXT_PUBLIC_SHOP_NAME
    : 'S.H Paint World',
  shortName: 'S.H Paint World',
  badge: 'SH',
  logoUrl: '/logo.svg',
  logoPng: '/logo.png',
  businessType: 'Paints & Hardware',
  tagline: 'Paint & Hardware POS & Stock Management',
  industry: 'Paints, Finishes & Hardware Supplies',
  version: '2.0',

  // Contact Information
  contacts: {
    primaryPhone: process.env.NEXT_PUBLIC_PRIMARY_PHONE || '0752331527',
    secondaryPhone: process.env.NEXT_PUBLIC_SECONDARY_PHONE || '0772461770',
    phonesDisplay: '0752331527 / 0772461770',
    location: 'Kampala, Uganda',
    receiptContactLine: 'Tel: 0752331527 / 0772461770 | Kampala, Uganda',
  },

  // Receipt & Invoice Branding
  receipt: {
    shopName: 'S.H Paint World',
    contactLine: 'Tel: 0752331527 / 0772461770 | Kampala, Uganda',
    tagline: 'Quality Paints, Finishes & Hardware Supplies',
    policy: 'Goods once sold are only returnable within 48 hours in original condition with valid receipt.',
    thankYou: 'THANK YOU FOR TRUSTING S.H PAINT WORLD!',
    invoiceFooter: 'Thank you for choosing S.H Paint World. Quality paints & hardware supplies.',
  },

  // Underlying Platform Attribution (Discreet in admin footer / settings)
  engineName: 'HardwareDesk POS Engine',
  platform: {
    name: 'HardwareDesk POS Engine',
    version: '2.0',
    country: 'UG',
  },
};

export default BRAND_CONFIG;
