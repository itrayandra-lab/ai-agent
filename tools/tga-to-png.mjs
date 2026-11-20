// Offline asset prep: decode an uncompressed TGA (16/24/32-bit), box-downsample it, write a PNG.
// usage: node tools/tga-to-png.mjs <in.tga> <out.png> [size=512]
import fs from 'node:fs';
import zlib from 'node:zlib';

const [inFile, outFile, sizeArg] = process.argv.slice(2);
const OUT = Number(sizeArg) || 512;
const buf = fs.readFileSync(inFile);
const idLen = buf[0], cmType = buf[1], imgType = buf[2];
if (cmType !== 0 || (imgType !== 2 && imgType !== 10)) throw new Error(`TGA type ${imgType} tidak didukung (butuh truecolor)`);
const W = buf.readUInt16LE(12), H = buf.readUInt16LE(14), bpp = buf[16], desc = buf[17];
const bytes = bpp / 8, topDown = (desc & 0x20) !== 0;
let p = 18 + idLen;
const src = new Uint8Array(W * H * 4);
const put = (i, px) => { src[i] = px[2]; src[i + 1] = px[1]; src[i + 2] = px[0]; src[i + 3] = bytes === 4 ? px[3] : 255; };
if (imgType === 2) {
  for (let i = 0; i < W * H; i++, p += bytes) put(i * 4, buf.subarray(p, p + bytes));
} else {
  // RLE
  let n = 0;
  while (n < W * H) {
    const h = buf[p++], count = (h & 0x7f) + 1;
    if (h & 0x80) { const px = buf.subarray(p, p + bytes); p += bytes; for (let k = 0; k < count; k++, n++) put(n * 4, px); }
    else for (let k = 0; k < count; k++, n++) { put(n * 4, buf.subarray(p, p + bytes)); p += bytes; }
  }
}
// box downsample to OUT x OUT (rows flipped if bottom-up)
const dst = Buffer.alloc(OUT * (OUT * 4 + 1));
const sx = W / OUT, sy = H / OUT;
for (let y = 0; y < OUT; y++) {
  dst[y * (OUT * 4 + 1)] = 0; // PNG filter: none
  for (let x = 0; x < OUT; x++) {
    let r = 0, g = 0, b = 0, a = 0, c = 0;
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const sr = topDown ? H - 1 - yy : yy;
      const i = (sr * W + xx) * 4; r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3]; c++;
    }
    const o = y * (OUT * 4 + 1) + 1 + x * 4;
    dst[o] = r / c; dst[o + 1] = g / c; dst[o + 2] = b / c; dst[o + 3] = a / c;
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(OUT, 0); ihdr.writeUInt32BE(OUT, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(dst, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(outFile, png);
console.log(`${W}x${H} -> ${OUT}x${OUT}, ${(png.length / 1024).toFixed(0)} KB`);
