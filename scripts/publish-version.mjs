/**
 * Publica la versión desplegada en Firestore (/config/appVersion) con el hash
 * corto de git. La app la lee EN VIVO (cross-origin, inmune a la caché del SW) y,
 * si no coincide con la versión que ella misma bakeó al build, avisa de que está
 * ejecutando una versión cacheada y ofrece actualizar.
 *
 * Se ejecuta DESPUÉS de `firebase deploy` (cuando el código nuevo ya está vivo):
 *   node scripts/publish-version.mjs
 * Usa la service account *firebase-adminsdk*.json de la raíz.
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) {
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz.');
  process.exit(1);
}

const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
initializeApp({ credential: cert(join(root, keyFile)) });

await getFirestore().doc('config/appVersion').set({
  version: hash,
  deployedAt: new Date().toISOString(),
});
console.log(`✓ /config/appVersion = grebla-${hash}`);
process.exit(0);
