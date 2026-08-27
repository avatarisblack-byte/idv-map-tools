const fs = require('fs');
const zlib = require('zlib');

// 备份原图
fs.copyFileSync('websiteicon.png', 'websiteicon_original.png');

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crc32.table[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function decodePNG(file) {
  const buf = fs.readFileSync(file);
  let pos = 8, ihdr = null;
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
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  const colorType = ihdr[9];
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
    const rs = y * (stride + 1);
    const filter = raw[rs];
    const row = raw.slice(rs + 1, rs + 1 + stride);
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? px[out + x - channels] : 0;
      const up = y > 0 ? px[out - stride + x] : 0;
      const ul = (y > 0 && x >= channels) ? px[out - stride + x - channels] : 0;
      let v = row[x];
      if (filter === 1) v = (v + left) & 0xff;
      else if (filter === 2) v = (v + up) & 0xff;
      else if (filter === 3) v = (v + ((left + up) >> 1)) & 0xff;
      else if (filter === 4) v = (v + paeth(left, up, ul)) & 0xff;
      px[out + x] = v;
    }
  }
  if (channels === 3) {
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = px[i * 3]; rgba[i * 4 + 1] = px[i * 3 + 1]; rgba[i * 4 + 2] = px[i * 3 + 2]; rgba[i * 4 + 3] = 255;
    }
    return { w, h, px: rgba };
  }
  return { w, h, px };
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ===== 主逻辑 =====
const src = decodePNG('websiteicon.png');
const { w, h, px } = src;

let minX = w, minY = h, maxX = -1, maxY = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (px[(y * w + x) * 4 + 3] > 16) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
const bw = maxX - minX + 1, bh = maxY - minY + 1;
console.log(`src=${w}x${h} bbox=(${minX},${minY})-(${maxX},${maxY}) bw=${bw} bh=${bh}`);

const OUT = 512;
const radius = Math.round(OUT * 0.18);
const bg = [10, 9, 7, 255];       // #0a0907
const bright = [255, 210, 74];    // #ffd24a

const canvas = Buffer.alloc(OUT * OUT * 4);

function inRounded(cx, cy, r) {
  if (cx < 0 || cx >= OUT || cy < 0 || cy >= OUT) return false;
  const dx = Math.max(r - cx, cx - (OUT - 1 - r), 0);
  const dy = Math.max(r - cy, cy - (OUT - 1 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

for (let y = 0; y < OUT; y++) for (let x = 0; x < OUT; x++) {
  if (inRounded(x, y, radius)) {
    const i = (y * OUT + x) * 4;
    canvas[i] = bg[0]; canvas[i + 1] = bg[1]; canvas[i + 2] = bg[2]; canvas[i + 3] = bg[3];
  }
}

const PAD = 0.15;
const avail = OUT * (1 - 2 * PAD);
const scale = Math.min(avail / bw, avail / bh);
const iw = bw * scale, ih = bh * scale;
const ox = (OUT - iw) / 2, oy = (OUT - ih) / 2;

function sampleAlpha(sx, sy) {
  const x0 = Math.floor(sx), y0 = Math.floor(sy);
  const fx = sx - x0, fy = sy - y0;
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const a00 = px[(y0 * w + x0) * 4 + 3], a10 = px[(y0 * w + x1) * 4 + 3];
  const a01 = px[(y1 * w + x0) * 4 + 3], a11 = px[(y1 * w + x1) * 4 + 3];
  const top = a00 * (1 - fx) + a10 * fx;
  const bot = a01 * (1 - fx) + a11 * fx;
  return top * (1 - fy) + bot * fy;
}

for (let dy = 0; dy < OUT; dy++) for (let dx = 0; dx < OUT; dx++) {
  if (dx < ox || dx >= ox + iw || dy < oy || dy >= oy + ih) continue;
  const sx = minX + (dx - ox) / scale;
  const sy = minY + (dy - oy) / scale;
  const a = sampleAlpha(sx, sy);
  if (a > 8) {
    const i = (dy * OUT + dx) * 4;
    canvas[i] = bright[0]; canvas[i + 1] = bright[1]; canvas[i + 2] = bright[2]; canvas[i + 3] = Math.round(a);
  }
}

fs.writeFileSync('websiteicon.png', encodePNG(OUT, OUT, canvas));
console.log('done -> websiteicon.png ' + OUT + 'x' + OUT);
