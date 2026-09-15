const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(buffer) {
  let offset = 8;
  let ihdr = null;
  const idats = [];
  let plte = null;
  let trns = null;

  while (offset < buffer.length) {
    const len = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
      };
    } else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idats.push(data);
    offset += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idats));
  const { width, height, colorType } = ihdr;

  let bpp = 4;
  if (colorType === 0) bpp = 1;
  else if (colorType === 2) bpp = 3;
  else if (colorType === 3) bpp = 1;
  else if (colorType === 4) bpp = 2;
  else if (colorType === 6) bpp = 4;

  const stride = width * bpp;
  const defiltered = Buffer.alloc(height * stride);

  let rawPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rawPos++];
    for (let x = 0; x < stride; x++) {
      const b = raw[rawPos++];
      const left = x >= bpp ? defiltered[y * stride + x - bpp] : 0;
      const up = y > 0 ? defiltered[(y - 1) * stride + x] : 0;
      const upLeft = (y > 0 && x >= bpp) ? defiltered[(y - 1) * stride + x - bpp] : 0;

      let val = b;
      if (filter === 1) val = (b + left) & 0xff;
      else if (filter === 2) val = (b + up) & 0xff;
      else if (filter === 3) val = (b + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        let pr = left;
        if (pb < pa && pb < pc) pr = up;
        else if (pc < pa) pr = upLeft;
        val = (b + pr) & 0xff;
      }
      defiltered[y * stride + x] = val;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const dst = i * 4;
    if (colorType === 6) {
      rgba[dst] = defiltered[i * 4];
      rgba[dst + 1] = defiltered[i * 4 + 1];
      rgba[dst + 2] = defiltered[i * 4 + 2];
      rgba[dst + 3] = defiltered[i * 4 + 3];
    } else if (colorType === 0) {
      const g = defiltered[i];
      rgba[dst] = g; rgba[dst + 1] = g; rgba[dst + 2] = g; rgba[dst + 3] = 255;
    } else if (colorType === 4) {
      const g = defiltered[i * 2];
      const a = defiltered[i * 2 + 1];
      rgba[dst] = g; rgba[dst + 1] = g; rgba[dst + 2] = g; rgba[dst + 3] = a;
    } else if (colorType === 3) {
      const idx = defiltered[i];
      rgba[dst] = plte[idx * 3];
      rgba[dst + 1] = plte[idx * 3 + 1];
      rgba[dst + 2] = plte[idx * 3 + 2];
      rgba[dst + 3] = trns && trns[idx] !== undefined ? trns[idx] : 255;
    } else if (colorType === 2) {
      rgba[dst] = defiltered[i * 3];
      rgba[dst + 1] = defiltered[i * 3 + 1];
      rgba[dst + 2] = defiltered[i * 3 + 2];
      rgba[dst + 3] = 255;
    }
  }
  return { width, height, rgba };
}

function encodePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const payload = Buffer.concat([typeBuf, data]);
    const crc = crc32(payload);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, payload, crcBuf]);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const ihdr = makeChunk('IHDR', ihdrData);

  const lineSize = width * 4;
  const rawData = Buffer.alloc(height * (lineSize + 1));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (lineSize + 1);
    rawData[rowOffset] = 0;
    rgbaBuffer.copy(rawData, rowOffset + 1, y * lineSize, (y + 1) * lineSize);
  }
  const idat = makeChunk('IDAT', zlib.deflateSync(rawData));
  const iend = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function generateNormalMap(rgbaBuf, width, height, strength = 2.0) {
  const heights = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgbaBuf[i * 4];
    const g = rgbaBuf[i * 4 + 1];
    const b = rgbaBuf[i * 4 + 2];
    heights[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0;
  }
  const normals = Buffer.alloc(width * height * 4);
  const getH = (x, y) => {
    x = (x + width) % width;
    y = (y + height) % height;
    return heights[y * width + x];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tl = getH(x - 1, y - 1);
      const l  = getH(x - 1, y);
      const bl = getH(x - 1, y + 1);
      const t  = getH(x, y - 1);
      const b  = getH(x, y + 1);
      const tr = getH(x + 1, y - 1);
      const r  = getH(x + 1, y);
      const br = getH(x + 1, y + 1);

      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      const dz = 1.0 / strength;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;

      const idx = (y * width + x) * 4;
      normals[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
      normals[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normals[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normals[idx + 3] = 255;
    }
  }
  return normals;
}

const dir = path.join(__dirname, '..', 'src', 'assets', 'minecraft');

// 1. Tint grass_block_top
const topDec = decodePng(fs.readFileSync(path.join(dir, 'grass_block_top.png')));
const topTinted = Buffer.alloc(16 * 16 * 4);
for (let i = 0; i < 16 * 16; i++) {
  const off = i * 4;
  const g = topDec.rgba[off];
  topTinted[off] = Math.round((g * 121) / 255);
  topTinted[off + 1] = Math.round((g * 192) / 255);
  topTinted[off + 2] = Math.round((g * 90) / 255);
  topTinted[off + 3] = 255;
}
fs.writeFileSync(path.join(dir, 'grass_block_top_tinted.png'), encodePng(16, 16, topTinted));

// 2. Composite grass_block_side
const dirtDec = decodePng(fs.readFileSync(path.join(dir, 'dirt.png')));
const overlayDec = decodePng(fs.readFileSync(path.join(dir, 'grass_block_side_overlay.png')));
const sideComp = Buffer.from(dirtDec.rgba);
for (let i = 0; i < 16 * 16; i++) {
  const off = i * 4;
  const a = overlayDec.rgba[off + 3] / 255;
  if (a > 0.01) {
    const g = overlayDec.rgba[off];
    const rT = Math.round((g * 121) / 255);
    const gT = Math.round((g * 192) / 255);
    const bT = Math.round((g * 90) / 255);
    sideComp[off] = Math.round(rT * a + sideComp[off] * (1 - a));
    sideComp[off + 1] = Math.round(gT * a + sideComp[off + 1] * (1 - a));
    sideComp[off + 2] = Math.round(bT * a + sideComp[off + 2] * (1 - a));
  }
}
fs.writeFileSync(path.join(dir, 'grass_block_side_composite.png'), encodePng(16, 16, sideComp));

// 3. Tint oak_leaves
const leafDec = decodePng(fs.readFileSync(path.join(dir, 'oak_leaves.png')));
const leafTinted = Buffer.alloc(16 * 16 * 4);
for (let i = 0; i < 16 * 16; i++) {
  const off = i * 4;
  const g = leafDec.rgba[off];
  const a = leafDec.rgba[off + 3];
  leafTinted[off] = Math.round((g * 89) / 255);
  leafTinted[off + 1] = Math.round((g * 174) / 255);
  leafTinted[off + 2] = Math.round((g * 48) / 255);
  leafTinted[off + 3] = a;
}
fs.writeFileSync(path.join(dir, 'oak_leaves_tinted.png'), encodePng(16, 16, leafTinted));

// 4. Extract water frame
const waterDec = decodePng(fs.readFileSync(path.join(dir, 'water_still.png')));
const waterFrame = Buffer.alloc(16 * 16 * 4);
waterDec.rgba.copy(waterFrame, 0, 0, 16 * 16 * 4);
fs.writeFileSync(path.join(dir, 'water_still_frame.png'), encodePng(16, 16, waterFrame));

// 5. Generate Normal Maps for PBR shader simulation
const normalTargets = [
  'stone',
  'cobblestone',
  'coal_ore',
  'iron_ore',
  'diamond_ore',
  'oak_log',
  'oak_planks',
];

for (const target of normalTargets) {
  const srcFile = path.join(dir, `${target}.png`);
  if (fs.existsSync(srcFile)) {
    const dec = decodePng(fs.readFileSync(srcFile));
    const nBuf = generateNormalMap(dec.rgba, dec.width, dec.height, 2.2);
    fs.writeFileSync(path.join(dir, `${target}_n.png`), encodePng(dec.width, dec.height, nBuf));
  }
}

console.log('Texture preparation & PBR normal maps complete!');
