/**
 * Backfill de /orgBranches/{id}.color (RMR-TSK-0619): el color de cada
 * departamento dejó de estar fijo en el código y pasó a ser dato de la instancia.
 * Las ramas que antes tenían color de marca en el código lo reciben en su
 * documento, para que no cambien de color al desplegar; el resto sigue con el
 * determinista hasta que el superadmin elija uno.
 *
 * SEGURO: dry-run por defecto; idempotente (nunca pisa un color ya guardado).
 *
 * Uso:
 *   node scripts/backfill-branch-colors.mjs --target=app            (dry-run)
 *   node scripts/backfill-branch-colors.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

/** Los colores que vivían en CANONICAL_BRANCH_COLORS antes de RMR-TSK-0619. */
const PREVIOUS_CODE_COLORS = {
  engineering: '#2a9d8f',
  product: '#e76f51',
  people: '#9d4edd',
  data: '#457b9d',
  generico: '#6b7280',
};

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const snap = await db.collection('orgBranches').get();
const pending = snap.docs.filter((d) => !d.data().color && PREVIOUS_CODE_COLORS[d.id]);

console.log(`«${target}» · ${snap.size} ramas`);
for (const d of pending) console.log(`  + ${d.id} «${d.data().label}» → ${PREVIOUS_CODE_COLORS[d.id]}`);
if (pending.length === 0) {
  console.log('✓ Ninguna rama necesita color. Nada que hacer.');
  process.exit(0);
}
if (!apply) {
  console.log('\n(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}

const batch = db.batch();
for (const d of pending) batch.update(d.ref, { color: PREVIOUS_CODE_COLORS[d.id] });
await batch.commit();
console.log(`✓ ${pending.length} ramas con color.`);
process.exit(0);
