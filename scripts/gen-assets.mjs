/**
 * Genera los assets de marca (favicon PNG, apple-touch-icon y og-image) a partir
 * de los SVG fuente, usando sharp (ya presente como dependencia transitiva).
 *
 * Uso: pnpm assets
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(here, 'assets');
const publicDir = join(here, '..', 'public');

const faviconSvg = readFileSync(join(publicDir, 'favicon.svg'));
const iconPaddedSvg = readFileSync(join(assetsDir, 'icon-padded.svg'));
const ogCardSvg = readFileSync(join(assetsDir, 'og-card.svg'));

/** @param {Buffer} svg @param {number} w @param {number} h @param {string} file */
async function render(svg, w, h, file) {
  await sharp(svg, { density: 384 }).resize(w, h).png().toFile(join(publicDir, file));
  console.log(`✓ ${file} (${w}×${h})`);
}

await render(faviconSvg, 32, 32, 'favicon-32.png');
await render(iconPaddedSvg, 180, 180, 'apple-touch-icon.png');
await render(ogCardSvg, 1200, 630, 'og-image.png');

console.log('Assets generados en public/.');
