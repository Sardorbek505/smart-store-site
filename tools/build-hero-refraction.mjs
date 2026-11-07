// Builds the hero displacement field (a data texture, not a photograph).
// R/G encode the sampling displacement, B the peripheral mask; the centre has
// mask 0, so the SVG filter keeps the original pixels there.
//
// v90: same shape as v86 (0.0225–0.072 of the width, quintic feather), but
// 2048×512 instead of 256×128. The lens zone is only a few percent of the
// ribbon, so at 256 px each texel covered ~5–6 CSS px and the displacement
// moved in visible steps at the edges. `--check` verifies the committed file.
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";

const W = 2048;
const H = 512;
const FILE = new URL("../img/hero-refraction-field-v90.png", import.meta.url);

const smooth = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

function chunk(name, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(name, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([head, body, crc]);
}

function build(minimum, span) {
  const raw = Buffer.alloc(H * (1 + W * 3));
  let k = 0;
  for (let j = 0; j < H; j++) {
    const y = j / (H - 1);
    const s = Math.sin(Math.PI * y);
    const extent = minimum + span * s ** 0.65;
    const bow = 0.3 + 0.7 * s * s;
    const vertical = Math.sin(2 * Math.PI * y);
    raw[k++] = 0;
    for (let i = 0; i < W; i++) {
      const x = i / (W - 1);
      const left = 1 - smooth(x / extent);
      const right = 1 - smooth((1 - x) / extent);
      const edge = left + right;
      const fade = Math.max(0, Math.min(1, edge / 0.75));
      raw[k++] = byte(0.5 + 0.4 * (left - right) * bow);
      raw[k++] = byte(0.5 + 0.32 * edge * vertical);
      raw[k++] = byte(fade ** 3 * (fade * (fade * 6 - 15) + 10));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const png = build(0.0225, 0.0495);
if (process.argv.includes("--check")) {
  if (!readFileSync(FILE).equals(png)) {
    console.error("Stale hero displacement field; run node tools/build-hero-refraction.mjs");
    process.exit(1);
  }
} else writeFileSync(FILE, png);
console.log(`Hero refraction field: ${W}x${H}, ${png.length} bytes`);
