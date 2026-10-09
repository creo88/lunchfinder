// Assembles the public site in dist/: the dashboard and its sample data only.
// Docs (walkthrough script, plan review, assessment answer key), tests and
// anything under data/ other than data/sample/ never reach the live site.
// Vercel runs this on every deploy (see vercel.json). Run locally: npm run build
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = ['index.html', 'assets', 'src', 'vendor', 'data/sample', 'templates'];

rmSync(dist, { recursive: true, force: true });
for (const path of SITE) {
  if (!existsSync(join(root, path))) throw new Error(`Missing ${path}; cannot build the site`);
  mkdirSync(dirname(join(dist, path)), { recursive: true });
  cpSync(join(root, path), join(dist, path), { recursive: true });
}
console.log(`Built dist/ from: ${SITE.join(', ')}`);
