const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon SVG with gold/amber branding, hardware store tool symbols, and sleek dark slate background
const createSvg = (size, isMaskable = false) => {
  const padding = isMaskable ? size * 0.2 : size * 0.08;
  const contentSize = size - padding * 2;
  const radius = isMaskable ? 0 : size * 0.22;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bgGrad)" />

  <!-- Subtle inner border for unmasked icons -->
  ${!isMaskable ? `<rect x="${size * 0.015}" y="${size * 0.015}" width="${size * 0.97}" height="${size * 0.97}" rx="${radius}" fill="none" stroke="rgba(245, 158, 11, 0.25)" stroke-width="${size * 0.015}" />` : ''}

  <!-- Glow effect -->
  <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.35}" fill="url(#glowGrad)" filter="blur(20px)" />

  <!-- Main Hardware Icon Center Group -->
  <g transform="translate(${size * 0.5}, ${size * 0.46}) scale(${contentSize / 512})" filter="url(#shadow)">
    <!-- Storefront / Warehouse Roof -->
    <path d="M-140 -40 L0 -140 L140 -40 L110 -40 L0 -115 L-110 -40 Z" fill="url(#goldGrad)" />
    
    <!-- Crossed Hardware Tools: Hammer and Wrench -->
    <!-- Wrench -->
    <g transform="rotate(-35)">
      <path d="M-16 -90 C-35 -90 -45 -70 -40 -45 L-15 110 C-12 125 12 125 15 110 L40 -45 C45 -70 35 -90 16 -90 C12 -75 -12 -75 -16 -90 Z" fill="#94a3b8" />
      <circle cx="0" cy="115" r="8" fill="#1e293b" />
    </g>

    <!-- Hammer -->
    <g transform="rotate(35)">
      <!-- Handle -->
      <path d="M-14 -40 L-10 130 C-9 140 9 140 10 130 L14 -40 Z" fill="#f59e0b" />
      <!-- Hammer Head -->
      <path d="M-60 -95 L45 -95 C55 -95 65 -85 65 -75 L65 -55 C65 -45 55 -35 45 -35 L-40 -35 L-65 -20 L-55 -65 Z" fill="#f8fafc" />
    </g>

    <!-- Center Shield / POS Token -->
    <circle cx="0" cy="15" r="48" fill="#0f172a" stroke="url(#goldGrad)" stroke-width="8" />
    <!-- "HD" Monogram inside shield -->
    <text x="0" y="27" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="34" fill="#fbbf24" text-anchor="middle" letter-spacing="-1">HD</text>
  </g>

  <!-- HardwareDesk Branding Text at Bottom (for non-maskable icons) -->
  ${!isMaskable ? `
  <text x="${size * 0.5}" y="${size * 0.88}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${size * 0.075}" fill="#f8fafc" text-anchor="middle" letter-spacing="${size * 0.005}">
    HARDWAREDESK
  </text>
  ` : ''}
</svg>`;
};

async function generateAllIcons() {
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const tasks = [
    { name: 'icon-192x192.png', size: 192, maskable: false },
    { name: 'icon-512x512.png', size: 512, maskable: false },
    { name: 'icon-maskable-192x192.png', size: 192, maskable: true },
    { name: 'icon-maskable-512x512.png', size: 512, maskable: true },
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
    { name: 'favicon-32x32.png', size: 32, maskable: false },
    { name: 'favicon-16x16.png', size: 16, maskable: false },
  ];

  for (const t of tasks) {
    const svgStr = createSvg(t.size, t.maskable);
    const dest = path.join(iconsDir, t.name);
    await sharp(Buffer.from(svgStr)).png().toFile(dest);
    console.log(`Generated: ${t.name} (${t.size}x${t.size})`);
  }

  // Also save a root favicon.ico if possible, or copy 32x32 to public/favicon.ico
  const fav32 = path.join(iconsDir, 'favicon-32x32.png');
  const favIco = path.join(__dirname, '..', 'public', 'favicon.ico');
  fs.copyFileSync(fav32, favIco);
  console.log('Copied favicon.ico to public/favicon.ico');
}

generateAllIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
