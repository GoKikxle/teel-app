// Generates the category-colored og:image fallbacks used by middleware.ts
// when a gathering has no cover photo. Pure Node (zlib + a hand-rolled PNG
// encoder) — no image-processing dependency needed for six flat-color
// 1200x630 cards. Re-run this after changing a category's accent color in
// src/lib/constants.ts to regenerate public/og/*.png.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const WIDTH = 1200;
const HEIGHT = 630;

// Mirrors CATS accent colors in src/lib/constants.ts.
const CATEGORIES = {
  hike: '#4B6B4A',
  brunch: '#C98A1F',
  game: '#6B5B95',
  dj: '#C1502E',
  poetry: '#8E3B46',
  other: '#8B856F',
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade([r, g, b], amount) {
  const target = amount < 0 ? [0, 0, 0] : [255, 255, 255];
  const t = Math.abs(amount);
  return [r, g, b].map((c, i) => Math.round(c + (target[i] - c) * t));
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Flat category-color background with a darker top stripe and a lighter
// "pin" dot, echoing the .stripe/.pin flourish on the real flyer cards
// (see src/index.css) without needing any font rendering.
function buildImage(hex) {
  const base = hexToRgb(hex);
  const stripe = shade(base, -0.28);
  const pinFill = shade(base, 0.55);
  const pinRing = shade(base, -0.15);

  const cx = WIDTH / 2;
  const cy = 96;
  const r = 46;
  const ringWidth = 5;

  const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
  let offset = 0;
  for (let y = 0; y < HEIGHT; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < WIDTH; x++) {
      let color = base;
      if (y < 16) {
        color = stripe;
      } else {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= r) color = pinFill;
        else if (dist <= r + ringWidth) color = pinRing;
      }
      raw[offset++] = color[0];
      raw[offset++] = color[1];
      raw[offset++] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og');
mkdirSync(outDir, { recursive: true });

for (const [name, hex] of Object.entries(CATEGORIES)) {
  const png = buildImage(hex);
  writeFileSync(join(outDir, `${name}.png`), png);
  console.log(`wrote public/og/${name}.png (${png.length} bytes)`);
}
