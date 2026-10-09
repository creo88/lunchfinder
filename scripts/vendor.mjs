// Copies the browser build of jsPDF into vendor/ so the dashboard works on any
// static host (and offline) without a CDN. Run after upgrading jspdf.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('jspdf/package.json'));
const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
mkdirSync(join(root, 'vendor'), { recursive: true });
copyFileSync(join(pkgDir, 'dist', 'jspdf.umd.min.js'), join(root, 'vendor', 'jspdf.umd.min.js'));
copyFileSync(join(pkgDir, 'LICENSE'), join(root, 'vendor', 'jspdf.LICENSE'));
console.log(`Copied jsPDF ${version} to vendor/`);
