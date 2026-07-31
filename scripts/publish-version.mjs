/**
 * Publica la versión desplegada en Firestore (/config/appVersion) con el hash
 * corto de git. La app la lee EN VIVO (cross-origin, inmune a la caché del SW) y,
 * si no coincide con la versión que ella misma bakeó al build, avisa de que está
 * ejecutando una versión cacheada y ofrece actualizar.
 *
 * Se ejecuta DESPUÉS de `firebase deploy` (cuando el código nuevo ya está vivo):
 *   node scripts/publish-version.mjs [app|tribbu]   (por defecto, app/demo)
 * La clave sale de ~/.secrets/firebase/ (ver scripts/lib/service-account.mjs); el
 * proyecto destino lo determina la propia clave.
 */
import { execSync } from 'node:child_process';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const VALID_TARGETS = ['app', 'tribbu'];
const target = process.argv[2] ?? 'app';
if (!VALID_TARGETS.includes(target)) {
  console.error(`✗ Instancia no válida: «${target}». Usa una de: ${VALID_TARGETS.join(' | ')}.`);
  process.exit(1);
}
const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
initializeApp({ credential: cert(serviceAccountPath(target)) });

await getFirestore().doc('config/appVersion').set({
  version: hash,
  deployedAt: new Date().toISOString(),
});
console.log(`✓ [${target}] /config/appVersion = grebla-${hash}`);
process.exit(0);
