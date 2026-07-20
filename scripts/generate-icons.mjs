// One-off asset generation script for BLOCK 06 brand assets.
// Run with: node scripts/generate-icons.mjs
// Renders PNG/ICO assets from the original SVG sources in apps/web/public/icons/.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "apps", "web", "public", "icons");

const logoSvg = readFileSync(join(iconsDir, "logo.svg"));
const maskableSvg = readFileSync(join(iconsDir, "logo-maskable.svg"));
const ogSvg = readFileSync(join(iconsDir, "og-source.svg"));

async function run() {
  await sharp(logoSvg, { density: 384 }).resize(192, 192).png().toFile(join(iconsDir, "icon-192.png"));
  await sharp(logoSvg, { density: 384 }).resize(512, 512).png().toFile(join(iconsDir, "icon-512.png"));
  await sharp(logoSvg, { density: 384 }).resize(180, 180).png().toFile(join(iconsDir, "apple-touch-icon.png"));
  await sharp(maskableSvg, { density: 384 }).resize(512, 512).png().toFile(join(iconsDir, "icon-maskable-512.png"));

  const favicon16 = await sharp(logoSvg, { density: 384 }).resize(16, 16).png().toBuffer();
  const favicon32 = await sharp(logoSvg, { density: 384 }).resize(32, 32).png().toBuffer();
  // Minimal valid multi-image ICO container wrapping the two PNG buffers.
  writeFileSync(
    join(iconsDir, "..", "favicon.ico"),
    buildIco([
      { size: 16, buffer: favicon16 },
      { size: 32, buffer: favicon32 },
    ]),
  );

  await sharp(ogSvg).resize(1200, 630).png().toFile(join(iconsDir, "og-image.png"));

  console.log("Generated: icon-192.png, icon-512.png, apple-touch-icon.png, icon-maskable-512.png, favicon.ico, og-image.png");
}

/**
 * Builds a minimal ICO file from square PNG images (Vista-style PNG-in-ICO,
 * supported by all modern browsers/OSes). Each entry: { size, buffer }.
 */
function buildIco(images) {
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * images.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(images.length, 4);

  const dirEntries = [];
  for (const { size, buffer } of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // image data size
    entry.writeUInt32LE(offset, 12); // offset of image data
    offset += buffer.length;
    dirEntries.push(entry);
  }

  return Buffer.concat([header, ...dirEntries, ...images.map((i) => i.buffer)]);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
