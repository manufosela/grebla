/**
 * Seed inicial de Firestore (Admin SDK).
 *
 * - Crea /config/org con la fase por defecto (y sus multiplicadores de rol).
 * - Opcionalmente marca al primer administrador por email:
 *     pnpm seed --admin=tu-email@dominio.com
 *   El usuario debe haber iniciado sesión al menos una vez (existir en Auth).
 *
 * Usa la service account *firebase-adminsdk*.json de la raíz del proyecto.
 * NO subir esa clave al repositorio (está en .gitignore).
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ORG_PHASE_BY_KEY, DEFAULT_ORG_PHASE } from '../src/data/org.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) {
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz del proyecto.');
  process.exit(1);
}

initializeApp({ credential: cert(join(root, keyFile)) });
const db = getFirestore();
const auth = getAuth();

// 1) Configuración de organización
const phase = ORG_PHASE_BY_KEY[DEFAULT_ORG_PHASE];
await db.doc('config/org').set(
  { phase: phase.key, roleMultipliers: phase.roleMultipliers, updatedAt: FieldValue.serverTimestamp() },
  { merge: true },
);
console.log(`✓ /config/org = "${phase.key}" (${phase.label})`);

// 2) Primer administrador (opcional, por email)
const emailArg = process.argv.find((a) => a.startsWith('--admin='));
const email = emailArg ? emailArg.split('=')[1] : process.env.SEED_ADMIN_EMAIL;

if (!email) {
  console.log('ℹ Sin --admin=<email>: omito el alta de administrador.');
  console.log('  Puedes marcarte admin desde /login (bootstrap) o re-ejecutar: pnpm seed --admin=tu@email.com');
} else {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { admin: true });
    await db.doc(`admins/${user.uid}`).set(
      { email: user.email ?? email, createdAt: FieldValue.serverTimestamp(), seededBy: 'seed-script' },
      { merge: true },
    );
    await db.doc('config/adminsInitialized').set(
      { by: user.uid, at: FieldValue.serverTimestamp() },
      { merge: true },
    );
    console.log(`✓ admin: ${email} (${user.uid})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`⚠ ${email} aún no existe en Auth. Inicia sesión una vez con Google y reintenta.`);
    console.log(`  Detalle: ${msg}`);
  }
}

console.log('Seed completado.');
process.exit(0);
