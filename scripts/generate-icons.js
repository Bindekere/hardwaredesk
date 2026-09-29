const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon SVG with navy blue branding and sleek SH monogram
const createSvg = (size, isMaskable = false) => {
  const padding = isMaskable ? size * 0.2 : size * 0.08;
  const contentSize = size - padding * 2;
  const radius = isMaskable ? 0 : size * 0.22;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a192f" />
      <stop offset="50%" stop-color="#0f2b5c" />
      <stop offset="100%" stop-color="#1e3a8a" />
    </linearGradient>
    <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa" />
      <stop offset="100%" stop-color="#2563eb" />
    </linearGradient>
    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bgGrad)" />

  <!-- Subtle inner border for unmasked icons -->
  ${!isMaskable ? `<rect x="${size * 0.015}" y="${size * 0.015}" width="${size * 0.97}" height="${size * 0.97}" rx="${radius}" fill="none" stroke="rgba(96, 165, 250, 0.35)" stroke-width="${size * 0.015}" />` : ''}

  <!-- Glow effect -->
  <circle cx="${size * 0.5}" cy="${size * 0.45}" r="${size * 0.35}" fill="url(#glowGrad)" />

  <!-- Main Center Badge Group -->
  <g transform="translate(${size * 0.5}, ${size * 0.46}) scale(${contentSize / 512})" filter="url(#shadow)">
    <!-- Outer Shield / Circle -->
    <circle cx="0" cy="0" r="135" fill="#0f172a" stroke="url(#blueGrad)" stroke-width="12" />
    <circle cx="0" cy="0" r="115" fill="#1e3a8a" fill-opacity="0.45" />
    <!-- "SH" Monogram inside shield -->
    <text x="0" y="38" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="110" fill="#ffffff" text-anchor="middle" letter-spacing="-2">SH</text>
  </g>

  <!-- S.H PAINT WORLD Branding Text at Bottom (for non-maskable icons) -->
  ${!isMaskable ? `
  <text x="${size * 0.5}" y="${size * 0.88}" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${size * 0.068}" fill="#ffffff" text-anchor="middle" letter-spacing="${size * 0.005}">
    S.H PAINT WORLD
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
