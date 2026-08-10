// Renders the app icon into the PNG sizes the manifest and iOS need.
// Run with `npm run icons` after editing scripts/icon.svg.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = readFileSync(resolve(here, "icon.svg"));

// Maskable icons get cropped to whatever shape the launcher uses, so the mark
// is shrunk onto a full-bleed background to survive the safe-zone crop.
const maskable = async (size) => {
  const inset = Math.round(size * 0.72);
  const mark = await sharp(source).resize(inset, inset).png().toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#0E1712",
    },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
};

const targets = [
  { file: "public/icon-192.png", size: 192 },
  { file: "public/icon-512.png", size: 512 },
  { file: "public/apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  const png = await sharp(source).resize(size, size).png().toBuffer();
  writeFileSync(resolve(root, file), png);
  console.log(`wrote ${file} (${size}x${size})`);
}

for (const size of [192, 512]) {
  const file = `public/icon-${size}-maskable.png`;
  writeFileSync(resolve(root, file), await maskable(size));
  console.log(`wrote ${file} (${size}x${size}, maskable)`);
}

writeFileSync(resolve(root, "public/favicon.svg"), source);
console.log("wrote public/favicon.svg");
