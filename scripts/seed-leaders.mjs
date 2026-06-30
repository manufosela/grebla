/**
 * Siembra superadmins (/admins/{uid}) y líderes (/leaders/{uid}) a nivel raíz
 * (modelo multi-leader, ADR -OwN-T_4VB3Ut1Dbn-j8). Una instancia = una
 * organización. El usuario debe haber iniciado sesión al menos una vez (existir
 * en Auth). Usa la service account *firebase-adminsdk*.json de la raíz.
 *
 * Uso:
 *   pnpm seed:leaders --admin=tu-email@dominio.com --leader=otro@dominio.com [--leader=...]
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) {
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz del proyecto.');
  process.exit(1);
}

const argList = (name) =>
  process.argv.filter((x) => x.startsWith(`--${name}=`)).map((x) => x.split('=').slice(1).join('='));
const admins = argList('admin');
const leaders = argList('leader');
if (admins.length === 0 && leaders.length === 0) {
  console.error('✗ Indica al menos --admin=<email> o --leader=<email>.');
  console.error('  Uso: pnpm seed:leaders --admin=tu@email.com --leader=otro@email.com');
  process.exit(1);
}

initializeApp({ credential: cert(join(root, keyFile)) });
const db = getFirestore();
const auth = getAuth();

/** @param {'admins'|'leaders'} col @param {string} email */
async function seed(col, email) {
  try {
    const user = await auth.getUserByEmail(email);
    await db.doc(`${col}/${user.uid}`).set(
      {
        email: user.email ?? email,
        displayName: user.displayName ?? user.email ?? email,
        addedAt: FieldValue.serverTimestamp(),
        addedBy: 'seed-leaders',
      },
      { merge: true },
    );
    console.log(`✓ ${email} (${user.uid}) → /${col}`);
  } catch (err) {
    console.error(`✗ ${email}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

for (const email of admins) await seed('admins', email);
for (const email of leaders) await seed('leaders', email);
process.exit(0);
