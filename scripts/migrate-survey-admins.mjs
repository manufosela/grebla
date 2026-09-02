/**
 * Migra los «People account» a PERMISO DE HERRAMIENTA (RMR-TSK-0476).
 *
 * Gestionar encuestas era un rol aparte (/surveyAdmins) creado antes de que
 * existiera el sistema de permisos. Es exactamente «puede gestionar la
 * herramienta Encuestas», así que pasa a ser un permiso por persona
 * (`toolOverrides.surveys.manage`), que la CF syncToolManagers materializa en
 * /toolManagers — el espejo que ya consultan las reglas.
 *
 * SEGURO: dry-run por defecto; aditivo (NO borra /surveyAdmins, que las reglas
 * siguen aceptando durante la transición); idempotente. Avisa de las cuentas sin
 * ficha de persona, que no se pueden migrar así y hay que resolver a mano.
 *
 * Uso:
 *   node scripts/migrate-survey-admins.mjs --target=tribbu            (dry-run)
 *   node scripts/migrate-survey-admins.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const admins = await db.collection('surveyAdmins').get();
if (admins.empty) {
  console.log(`[${target}] no hay People accounts: nada que migrar.`);
  process.exit(0);
}

const people = await db.collection('people').get();
const personaDe = new Map();
for (const d of people.docs) {
  const uid = d.data().uid;
  if (uid) personaDe.set(uid, d);
}

const migrar = [];
const sinFicha = [];
const yaEstaban = [];
for (const a of admins.docs) {
  const persona = personaDe.get(a.id);
  if (!persona) { sinFicha.push(`${a.id} · ${a.data().email ?? a.data().displayName ?? '—'}`); continue; }
  const ya = persona.data().toolOverrides?.surveys?.manage === true;
  (ya ? yaEstaban : migrar).push(persona);
}

console.log(`[${target}] People accounts: ${admins.size}`);
console.log(`  ya con el permiso: ${yaEstaban.length}`);
console.log(`  a migrar: ${migrar.length} → ${migrar.map((p) => p.data().name ?? p.id).join(', ') || '—'}`);
if (sinFicha.length) {
  console.log(`  ⚠ SIN ficha de persona (${sinFicha.length}), no migrables así:`);
  for (const s of sinFicha) console.log(`      ${s}`);
}

if (!apply) {
  console.log('\nDry-run: no se ha escrito nada. Repite con --apply.');
  process.exit(0);
}

for (const persona of migrar) {
  const overrides = { ...(persona.data().toolOverrides ?? {}) };
  overrides.surveys = { ...(overrides.surveys ?? {}), manage: true };
  await persona.ref.set({ toolOverrides: overrides }, { merge: true });
  console.log(`  ✓ ${persona.data().name ?? persona.id}`);
}
console.log(`\n✓ Migradas ${migrar.length}. /surveyAdmins NO se toca: las reglas lo siguen aceptando hasta que se retire.`);
