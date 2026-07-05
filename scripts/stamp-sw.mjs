/**
 * Estampa la versión del service worker en dist/sw.js tras el build: sustituye
 * el placeholder __BUILD__ por el hash corto de git, de modo que CADA deploy
 * publica un SW con versión nueva y su `activate` purga las cachés de versiones
 * anteriores en los dispositivos (fix del móvil sirviendo versiones viejas).
 *
 * Se ejecuta como parte de `pnpm build` (package.json). Falla en alto si el
 * placeholder no está (el SW dejaría de invalidarse en silencio).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SW_PATH = new URL('../dist/sw.js', import.meta.url);
const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();

const source = readFileSync(SW_PATH, 'utf8');
if (!source.includes('__BUILD__')) {
  console.error('✗ dist/sw.js no contiene el placeholder __BUILD__: el SW no se versionará.');
  process.exit(1);
}

writeFileSync(SW_PATH, source.replaceAll('__BUILD__', hash));
console.log(`✓ Service worker estampado: grebla-${hash}`);
