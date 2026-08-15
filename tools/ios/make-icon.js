#!/usr/bin/env node
/* Generate the iOS app icon: a 1024x1024 PNG written by hand (zlib is the only dependency, and it
   ships with node) so the repo keeps its no-build-step, no-image-toolchain rule.

   The mark is the design language reduced to two shapes: the dark broadcast-booth base, a bold
   accent-gold bar down the left edge -- the sideline -- and a few chalk yard lines across. It has to
   read at 60px on a home screen, so everything is thick and there is no type.

   iOS app icons must NOT carry an alpha channel, hence PNG colour type 2 (truecolour, no alpha).

     node tools/ios/make-icon.js
*/
const fs = require('fs'), path = require('path'), zlib = require('zlib');

const SIZE = 1024;
const BG    = [0x0d, 0x0f, 0x12];   // --bg
const LINE  = [0x2a, 0x2f, 0x37];   // --line
const CHALK = [0xe9, 0xec, 0xf1];   // --ink
const GOLD  = [0xc9, 0xa2, 0x27];   // --accent (menu default)

const OUT = path.join(__dirname, '..', '..', 'ios', 'Resources', 'Assets.xcassets',
                      'AppIcon.appiconset', 'icon-1024.png');

// ---- the image ----------------------------------------------------------------
const px = Buffer.alloc(SIZE * SIZE * 3);
const set = (x, y, c) => { const i = (y * SIZE + x) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; };

for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) set(x, y, BG);

// Five yard lines across the field. Thick enough to survive the 60px downscale.
const YARD_W = 14;
for (let n = 1; n <= 5; n++) {
  const y0 = Math.round((SIZE * n) / 6) - YARD_W / 2;
  // The middle line is the 50 -- chalk-bright; the rest are quieter.
  const c = n === 3 ? CHALK : LINE;
  for (let y = y0; y < y0 + YARD_W; y++) for (let x = 0; x < SIZE; x++) set(x, y, c);
}

// The sideline itself: a bold gold bar down the left edge, with a dark gutter separating it from
// the yard lines so the two shapes stay legible when the icon is tiny.
// Kept well inboard of the edge: iOS masks the icon to a squircle, and a bar hugging the side gets
// clipped diagonally at the corners, which reads as a mistake rather than as a sideline.
const BAR_X = 188, BAR_W = 146, GUTTER = 28;
for (let y = 0; y < SIZE; y++) {
  for (let x = BAR_X + BAR_W; x < BAR_X + BAR_W + GUTTER; x++) set(x, y, BG);
  for (let x = BAR_X; x < BAR_X + BAR_W; x++) set(x, y, GOLD);
}

// ---- PNG container ------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;    // bit depth
ihdr[9] = 2;    // colour type 2 = truecolour, NO alpha (iOS requirement)
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // deflate / adaptive filtering / no interlace

// Each scanline is prefixed with its filter byte; 0 = None, which compresses fine on flat colour.
const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 3 + 1)] = 0;
  px.copy(raw, y * (SIZE * 3 + 1) + 1, y * SIZE * 3, (y + 1) * SIZE * 3);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, png);
console.log(`${path.relative(path.join(__dirname, '..', '..'), OUT)} — ${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)}KB`);
