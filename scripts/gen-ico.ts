import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

function writeUint16LE(buf: Buffer, value: number, offset: number) {
  buf.writeUInt16LE(value & 0xffff, offset);
}
function writeUint32LE(buf: Buffer, value: number, offset: number) {
  buf.writeUInt32LE(value >>> 0, offset);
}

async function buildIcoFromPngs(pngs: { size: number; data: Buffer }[]): Promise<Buffer> {
  const count = pngs.length;
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + count * entrySize;
  const totalImageBytes = pngs.reduce((acc, p) => acc + p.data.length, 0);
  const out = Buffer.alloc(dirSize + totalImageBytes);

  // ICONDIR
  writeUint16LE(out, 0, 0);       // idReserved
  writeUint16LE(out, 1, 2);       // idType (1 = icon)
  writeUint16LE(out, count, 4);   // idCount

  // ICONDIRENTRY array
  let dataOffset = dirSize;
  for (let i = 0; i < count; i++) {
    const { size, data } = pngs[i];
    const base = headerSize + i * entrySize;
    out[base + 0] = size >= 256 ? 0 : size;   // bWidth
    out[base + 1] = size >= 256 ? 0 : size;   // bHeight
    out[base + 2] = 0;                        // bColorCount
    out[base + 3] = 0;                        // bReserved
    writeUint16LE(out, 1, base + 4);          // wPlanes (usually 1)
    writeUint16LE(out, 32, base + 6);         // wBitCount (32)
    writeUint32LE(out, data.length, base + 8);// dwBytesInRes
    writeUint32LE(out, dataOffset, base + 12);// dwImageOffset
    // copy image data
    data.copy(out, dataOffset);
    dataOffset += data.length;
  }
  return out;
}

async function main() {
  const src = path.resolve('docs', 'logo.jpeg');
  if (!fs.existsSync(src)) {
    console.error('Source image not found:', src);
    process.exit(1);
  }
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngs: { size: number; data: Buffer }[] = [];
  for (const s of sizes) {
    const data = await sharp(src)
      .resize(s, s, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    pngs.push({ size: s, data });
  }
  const ico = await buildIcoFromPngs(pngs);
  const out1 = path.resolve('scripts', 'logo.ico');
  const out2 = path.resolve('data', 'web', 'favicon.ico');
  fs.mkdirSync(path.dirname(out1), { recursive: true });
  fs.mkdirSync(path.dirname(out2), { recursive: true });
  fs.writeFileSync(out1, ico);
  fs.writeFileSync(out2, ico);
  console.log('Generated ICOs:', out1, out2);
}

main().catch((e) => { console.error(e); process.exit(1); });