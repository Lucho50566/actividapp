/** Genera iconos PNG de la PWA (192/512/180) sin dependencias (encoder con zlib). */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'web', 'public');
mkdirSync(OUT, { recursive: true });

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const BRAND = hex('#7c3aed'), WHITE = hex('#ffffff'), LINE = hex('#ddd6fe'), PENCIL = hex('#f59e0b');

const makeCanvas = (size) => ({ size, data: new Uint8Array(size * size * 4) });
function setPx(cv, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= cv.size || y >= cv.size) return;
  const i = (y * cv.size + x) * 4;
  cv.data[i] = r; cv.data[i + 1] = g; cv.data[i + 2] = b; cv.data[i + 3] = a;
}
function fillRoundRect(cv, x0, y0, w, h, radius, color) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const dx = Math.max(x0 + radius - x, x - (x0 + w - 1 - radius), 0);
      const dy = Math.max(y0 + radius - y, y - (y0 + h - 1 - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) setPx(cv, x, y, color);
    }
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function thickLine(cv, ax, ay, bx, by, width, color) {
  const r = width / 2;
  for (let y = Math.floor(Math.min(ay, by) - r); y <= Math.ceil(Math.max(ay, by) + r); y++)
    for (let x = Math.floor(Math.min(ax, bx) - r); x <= Math.ceil(Math.max(ax, bx) + r); x++)
      if (distToSeg(x, y, ax, ay, bx, by) <= r) setPx(cv, x, y, color);
}

function drawIcon(size) {
  const cv = makeCanvas(size), s = size / 512;
  fillRoundRect(cv, 0, 0, size, size, 112 * s, BRAND);
  fillRoundRect(cv, 150 * s, 112 * s, 200 * s, 272 * s, 26 * s, WHITE);
  fillRoundRect(cv, 186 * s, 168 * s, 128 * s, 18 * s, 9 * s, LINE);
  fillRoundRect(cv, 186 * s, 212 * s, 128 * s, 18 * s, 9 * s, LINE);
  fillRoundRect(cv, 186 * s, 256 * s, 86 * s, 18 * s, 9 * s, LINE);
  // lápiz diagonal
  thickLine(cv, 300 * s, 330 * s, 372 * s, 258 * s, 26 * s, PENCIL);
  return cv;
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(cv) {
  const { size, data } = cv;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; for (let x = 0; x < size * 4; x++) raw[y * (size * 4 + 1) + 1 + x] = data[y * size * 4 + x]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [192, 512]) { writeFileSync(resolve(OUT, `icon-${size}.png`), encodePng(drawIcon(size))); console.log(`✓ icon-${size}.png`); }
writeFileSync(resolve(OUT, 'apple-touch-icon.png'), encodePng(drawIcon(180)));
console.log('✓ apple-touch-icon.png');
