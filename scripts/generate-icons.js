const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Generates the official S.H Paint World App Logo & Icons
 * Features the signature royal blue rounded square with crisp bold "SH" monogram
 */
const createSvg = (size, isMaskable = false) => {
  const radius = isMaskable ? 0 : Math.round(size * 0.22);
  const fontSize = isMaskable ? Math.round(size * 0.44) : Math.round(size * 0.52);
  const strokeWidth = Math.max(1, Math.round(size * 0.02));

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Vibrant Royal to Navy Blue Gradient -->
    <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="35%" stop-color="#2563eb" />
      <stop offset="80%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#1e3a8a" />
    </linearGradient>

    <!-- Subtle Glass Sheen Gradient -->
    <linearGradient id="sheenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>

    <!-- Monogram Drop Shadow -->
    <filter id="monogramShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${Math.max(1, size * 0.02)}" stdDeviation="${Math.max(1, size * 0.025)}" flood-color="#0f172a" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Base Rounded Square Background -->
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#logoBgGrad)" />

  <!-- Inner Highlight Bevel (for standard icons) -->
  ${!isMaskable ? `
  <rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${size - strokeWidth}" height="${size - strokeWidth}" rx="${radius}" fill="none" stroke="rgba(255, 255, 255, 0.22)" stroke-width="${strokeWidth}" />
  <rect width="${size}" height="${Math.round(size * 0.48)}" rx="${radius}" fill="url(#sheenGrad)" clip-path="url(#sheenClip)" />
  ` : ''}

  <!-- Signature Bold "SH" Monogram -->
  <text
    x="${size * 0.5}"
    y="${size * 0.54}"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    fill="#ffffff"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="-0.04em"
    filter="url(#monogramShadow)"
  >SH</text>
</svg>`;
};

async function generateAllIcons() {
  const iconsDir = path.join(__dirname, '..', 'public', 'icons');
  const publicDir = path.join(__dirname, '..', 'public');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // 1. Generate standalone official logo SVG in /public/logo.svg
  const masterSvg = createSvg(512, false);
  fs.writeFileSync(path.join(publicDir, 'logo.svg'), masterSvg);
  console.log('Saved master vector logo: public/logo.svg');

  // 2. Generate PNG icon suite for PWA, Apple Touch, Favicon & App Logo
  const tasks = [
    { name: 'logo.png', size: 512, maskable: false, dest: publicDir },
    { name: 'icon-512x512.png', size: 512, maskable: false, dest: iconsDir },
    { name: 'icon-192x192.png', size: 192, maskable: false, dest: iconsDir },
    { name: 'icon-maskable-512x512.png', size: 512, maskable: true, dest: iconsDir },
    { name: 'icon-maskable-192x192.png', size: 192, maskable: true, dest: iconsDir },
    { name: 'apple-touch-icon.png', size: 180, maskable: false, dest: iconsDir },
    { name: 'favicon-32x32.png', size: 32, maskable: false, dest: iconsDir },
    { name: 'favicon-16x16.png', size: 16, maskable: false, dest: iconsDir },
  ];

  for (const t of tasks) {
    const svgStr = createSvg(t.size, t.maskable);
    const destPath = path.join(t.dest, t.name);
    await sharp(Buffer.from(svgStr)).png().toFile(destPath);
    console.log(`Generated: ${t.name} (${t.size}x${t.size})`);
  }

  // 3. Update public/favicon.ico
  const fav32 = path.join(iconsDir, 'favicon-32x32.png');
  const favIco = path.join(publicDir, 'favicon.ico');
  fs.copyFileSync(fav32, favIco);
  console.log('Copied favicon.ico to public/favicon.ico');
}

generateAllIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
