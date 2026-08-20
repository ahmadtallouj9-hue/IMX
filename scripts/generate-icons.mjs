import sharp from 'sharp';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = join(root, 'web', 'public', 'icon.svg');
const outDir = join(root, 'web', 'public');
const sizes = [192, 512];

for (const size of sizes) {
  const out = join(outDir, `icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(out);
  console.log(`Wrote ${out}`);
}
