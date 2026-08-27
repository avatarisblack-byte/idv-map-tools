const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync('websiteicon.png');
let pos = 8;
let ihdr = null;
const idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.slice(pos + 8, pos + 8 + len);
  if (type === 'IHDR') ihdr = data;
  else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  pos += 12 + len;
}

const w = ihdr.readUInt32BE(0);
const h = ihdr.readUInt32BE(4);
const bitDepth = ihdr[8];
const colorType = ihdr[9];
console.log(`size=${w}x${h} bitDepth=${bitDepth} colorType=${colorType}`);

if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
  console.log('unsupported (need 8-bit RGB/RGBA)');
  process.exit(0);
}

const channels = colorType === 6 ? 4 : 3;
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = w * channels;
const px = Buffer.alloc(stride * h);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}

for (let y = 0; y < h; y++) {
  const rowStart = y * (stride + 1);
  const filter = raw[rowStart];
  const row = raw.slice(rowStart + 1, rowStart + 1 + stride);
  const out = y * stride;
  for (let x = 0; x < stride; x++) {
    const left = x >= channels ? px[out + x - channels] : 0;
    const up = y > 0 ? px[out - stride + x] : 0;
    const upLeft = (y > 0 && x >= channels) ? px[out - stride + x - channels] : 0;
    let v = row[x];
    if (filter === 1) v = (v + left) & 0xff;
    else if (filter === 2) v = (v + up) & 0xff;
    else if (filter === 3) v = (v + ((left + up) >> 1)) & 0xff;
    else if (filter === 4) v = (v + paeth(left, up, upLeft)) & 0xff;
    px[out + x] = v;
  }
}

const colorCount = new Map();
let opaqueCount = 0, total = w * h;
let minX = w, minY = h, maxX = -1, maxY = -1;
let sumR = 0, sumG = 0, sumB = 0, coloredPx = 0;

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * channels;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const a = channels === 4 ? px[i + 3] : 255;
    if (a > 128) {
      opaqueCount++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      sumR += r; sumG += g; sumB += b; coloredPx++;
      const key = `${r},${g},${b}`;
      colorCount.set(key, (colorCount.get(key) || 0) + 1);
    }
  }
}

console.log(`opaque=${opaqueCount}/${total} (${(opaqueCount / total * 100).toFixed(1)}%)`);
console.log(`bbox=(${minX},${minY})-(${maxX},${maxY})`);
if (coloredPx > 0) {
  console.log(`avgColor=rgb(${Math.round(sumR / coloredPx)},${Math.round(sumG / coloredPx)},${Math.round(sumB / coloredPx)})`);
}
const top = [...colorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('topColors:');
for (const [c, n] of top) console.log(`  rgb(${c}) x${n}`);
