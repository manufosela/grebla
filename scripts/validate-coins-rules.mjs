/**
 * Validación en EMULADOR de las reglas de /coins (CP-2, RMR-TSK-0138).
 *
 * Comprueba contra el emulador de Firestore (puerto 8181, firebase.json) que:
 *  1. Un autenticado LEE /coins/meta, el ledger y los saldos (auditoría libre).
 *  2. Un NO autenticado no lee nada de /coins.
 *  3. NADIE escribe /coins desde el cliente (ni meta, ni apuntes, ni saldos):
 *     solo la Cloud Function con Admin SDK (que omite reglas).
 *  4. La query del ledger (orderBy seq) pasa las reglas (rules are not
 *     filters: la lectura de colección debe estar respaldada).
 *
 * Uso (arranca el emulador, ejecuta y lo apaga):
 *   firebase emulators:exec --only firestore --project demo-grebla \
 *     "node scripts/validate-coins-rules.mjs"
 */
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, collection, query, orderBy } from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-grebla';

const env = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    host: '127.0.0.1',
    port: 8181,
    rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
});

/** Contador de comprobaciones pasadas (el script FALLA a la primera que no). */
let passed = 0;
/** @param {string} label @param {Promise<unknown>} assertion */
async function check(label, assertion) {
  try {
    await assertion;
    passed += 1;
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.error(`  ✗ ${label}`);
    throw err;
  }
}

try {
  // Semilla como el EMISOR (Admin SDK omite reglas): un meta, un apunte y un saldo.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'coins', 'meta'), { seq: 1, headHash: 'a'.repeat(64), updatedAt: 'x' });
    await setDoc(doc(db, 'coins', 'ledger', 'entries', 'cert:p1:bases~git'), {
      id: 'cert:p1:bases~git',
      seq: 1,
      personId: 'p1',
      delta: 10,
      ruleId: 'certificate',
      ruleVersion: 1,
    });
    await setDoc(doc(db, 'coins', 'balances', 'people', 'p1'), { balance: 10, updatedAt: 'x' });
  });

  const leader = env.authenticatedContext('leader-uid').firestore();
  const anon = env.unauthenticatedContext().firestore();

  console.log('Lecturas (cualquier autenticado audita el ledger):');
  await check('autenticado lee /coins/meta', assertSucceeds(getDoc(doc(leader, 'coins', 'meta'))));
  await check(
    'autenticado lee un apunte del ledger',
    assertSucceeds(getDoc(doc(leader, 'coins', 'ledger', 'entries', 'cert:p1:bases~git'))),
  );
  await check(
    'autenticado consulta el ledger completo (orderBy seq)',
    assertSucceeds(getDocs(query(collection(leader, 'coins', 'ledger', 'entries'), orderBy('seq')))),
  );
  await check(
    'autenticado lee un saldo materializado',
    assertSucceeds(getDoc(doc(leader, 'coins', 'balances', 'people', 'p1'))),
  );
  await check(
    'autenticado lista todos los saldos',
    assertSucceeds(getDocs(collection(leader, 'coins', 'balances', 'people'))),
  );

  console.log('Sin sesión no hay auditoría:');
  await check('anónimo NO lee /coins/meta', assertFails(getDoc(doc(anon, 'coins', 'meta'))));
  await check(
    'anónimo NO consulta el ledger',
    assertFails(getDocs(collection(anon, 'coins', 'ledger', 'entries'))),
  );

  console.log('Escrituras de cliente PROHIBIDAS (emisor único = Function con Admin SDK):');
  await check(
    'autenticado NO escribe /coins/meta',
    assertFails(setDoc(doc(leader, 'coins', 'meta'), { seq: 99, headHash: 'f'.repeat(64) })),
  );
  await check(
    'autenticado NO inserta apuntes («me pongo 1000 puntos»)',
    assertFails(
      setDoc(doc(leader, 'coins', 'ledger', 'entries', 'badge:p1:legend'), {
        id: 'badge:p1:legend',
        seq: 2,
        personId: 'p1',
        delta: 1000,
      }),
    ),
  );
  await check(
    'autenticado NO altera un apunte existente',
    assertFails(
      setDoc(doc(leader, 'coins', 'ledger', 'entries', 'cert:p1:bases~git'), { delta: 1000 }, { merge: true }),
    ),
  );
  await check(
    'autenticado NO infla su saldo materializado',
    assertFails(setDoc(doc(leader, 'coins', 'balances', 'people', 'p1'), { balance: 99999 })),
  );

  console.log(`\n${passed} comprobaciones de reglas de /coins pasadas.`);
} finally {
  await env.cleanup();
}
