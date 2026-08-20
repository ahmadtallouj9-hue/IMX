import { cpSync, existsSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'web', 'dist');
const dest = join(root, 'server', 'web-dist');
if (!existsSync(src)) {
  console.error('web/dist not found — run npm run build --prefix web first');
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);