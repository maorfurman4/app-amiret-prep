// Regenerates every raster icon from the two source SVGs in public/.
//   node scripts/generate-icons.mjs
// Sources: public/logo.svg (full mark) and public/logo-simple.svg (favicon form).
// sharp ships with Next.js, so no extra dependency is needed.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const pub = (p) => new URL(`../public/${p}`, import.meta.url);
const full = readFileSync(pub('logo.svg'), 'utf8');
const simple = readFileSync(pub('logo-simple.svg'), 'utf8');

// Square, full-bleed tile with the artwork scaled about the centre. Used where
// the OS applies its own mask (iOS corners, Android maskable shapes), so there
// must be no transparent corners and the art must sit inside the safe zone.
function fullBleed(svg, scale) {
  const offset = (256 * (1 - scale)).toFixed(2);
  return svg
    .replace(/<rect width="512" height="512" rx="\d+"/, '<rect width="512" height="512"')
    .replace(/(<rect[^>]*\/>)([\s\S]*)<\/svg>/, `$1\n  <g transform="translate(${offset} ${offset}) scale(${scale})">$2</g>\n</svg>`);
}

// Render with 4× supersampling, then downscale, for crisp small sizes.
const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: Math.max(72, (72 * size * 4) / 512) })
    .resize(size, size, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();

// PNG-compressed ICO (supported by every current browser).
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); // colour planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

// Maskable safe zone is a circle of radius 40% of the icon; the furthest art
// (cap tip and "+" tassel) sits at ~47% in logo.svg, so 0.8 brings it to ~37%.
const MASKABLE_SCALE = 0.8;
// iOS rounds its own corners; a little inset keeps the "+" clear of them.
const APPLE_SCALE = 0.9;

const outputs = {
  'favicon-32.png': await png(simple, 32),
  'apple-touch-icon.png': await png(fullBleed(full, APPLE_SCALE), 180),
  'icons/icon-192.png': await png(full, 192),
  'icons/icon-512.png': await png(full, 512),
  'icons/icon-maskable-192.png': await png(fullBleed(full, MASKABLE_SCALE), 192),
  'icons/icon-maskable-512.png': await png(fullBleed(full, MASKABLE_SCALE), 512),
};
const favicon = ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(simple, size) }))));
outputs['favicon.ico'] = favicon;

for (const [file, data] of Object.entries(outputs)) writeFileSync(pub(file), data);
// App Router serves src/app/favicon.ico at /favicon.ico; keep it identical.
writeFileSync(new URL('../src/app/favicon.ico', import.meta.url), favicon);
console.log(`wrote ${Object.keys(outputs).length + 1} files`);
