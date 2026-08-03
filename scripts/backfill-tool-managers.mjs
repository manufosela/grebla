/**
 * Backfill del espejo /toolManagers (RMR-TSK-0389, ADR «managesToolByPolicy»):
 * materializa una vez el estado deseado — {toolId}--{uid} por cada persona
 * activa CON uid cuyo manage efectivo (canManageTool del DOMINIO REAL) sea true.
 * A partir de aquí lo mantiene la CF syncToolManagers (triggers).
 *
 * SEGURO: dry-run por defecto; idempotente (añade los que faltan, borra los
 * sobrantes; los ya correctos no se tocan).
 *
 * Uso:
 *   node scripts/backfill-tool-managers.mjs --target=app            (dry-run)
 *   node scripts/backfill-tool-managers.mjs --target=app --apply
 *   node scripts/backfill-tool-managers.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { canManageTool } from '../src/tools/team/domain/toolAccess.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const [policiesSnap, peopleSnap, existingSnap] = await Promise.all([
  db.collection('toolPolicies').get(),
  db.collection('people').get(),
  db.collection('toolManagers').get(),
]);

const people = peopleSnap.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((p) => typeof p.uid === 'string' && p.uid && p.active !== false);

const desired = new Map(); // id espejo → etiqueta legible
for (const doc of policiesSnap.docs) {
  const policy = { toolId: doc.id, ...doc.data() };
  for (const p of people) {
    const ref = { personId: p.id, branch: p.orgBranch ?? 'generico', roleId: p.orgRole ?? null, toolOverrides: p.toolOverrides ?? {} };
    if (canManageTool(ref, policy)) desired.set(`${policy.toolId}--${p.uid}`, `${policy.toolId} → ${p.name}`);
  }
}

const existing = new Set(existingSnap.docs.map((d) => d.id));
const toAdd = [...desired.keys()].filter((id) => !existing.has(id));
const toRemove = [...existing].filter((id) => !desired.has(id));

console.log(`«${target}» · ${policiesSnap.size} políticas · ${people.length} personas con cuenta`);
for (const id of toAdd) console.log(`  + ${desired.get(id)} (${id})`);
for (const id of toRemove) console.log(`  − ${id}`);
if (toAdd.length === 0 && toRemove.length === 0) {
  console.log('✓ El espejo ya está al día. Nada que hacer.');
  process.exit(0);
}

if (!apply) {
  console.log('\n(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}

await Promise.all([
  ...toAdd.map((id) => db.doc(`toolManagers/${id}`).set({ grantedAt: FieldValue.serverTimestamp(), source: 'policy' })),
  ...toRemove.map((id) => db.doc(`toolManagers/${id}`).delete()),
]);
console.log(`\n✓ Aplicado: +${toAdd.length} −${toRemove.length}.`);
process.exit(0);
