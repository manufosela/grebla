/**
 * Retira del catálogo las RAMAS SIN NINGÚN ROL (RMR-TSK-0475).
 *
 * Una rama es un ÁREA de la organización (Engineering, Data, Product…). Con el
 * tiempo se colaron entradas que no son áreas sino categorías de mando
 * («Engineering Manager») o restos de pruebas («Management»), y ninguna tiene
 * roles: solo ensucian los desplegables y el catálogo.
 *
 * SEGURO: dry-run por defecto, y **nunca borra una rama con roles**. Si alguna
 * los tiene, se lista y se deja intacta — el borrado se decide con los datos
 * delante, no a ciegas.
 *
 * Uso:
 *   node scripts/cleanup-org-branches.mjs --target=tribbu            (dry-run)
 *   node scripts/cleanup-org-branches.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const [ramas, roles] = await Promise.all([
  db.collection('orgBranches').get(),
  db.collection('orgRoles').get(),
]);

/** Cuántos roles usa cada rama. La rama de un rol es su campo `branch`. */
const usos = new Map();
for (const d of roles.docs) {
  const b = d.data().branch ?? '(sin rama)';
  usos.set(b, (usos.get(b) ?? 0) + 1);
}

const huerfanas = ramas.docs.filter((d) => !usos.get(d.id));
const enUso = ramas.docs.filter((d) => usos.get(d.id));

console.log(`[${target}] ramas en uso:`);
for (const d of enUso) console.log(`  · ${d.id} — ${usos.get(d.id)} rol(es)`);

if (huerfanas.length === 0) {
  console.log('\nNo hay ramas huérfanas: nada que hacer.');
  process.exit(0);
}

console.log(`\nramas SIN roles (${huerfanas.length}):`);
for (const d of huerfanas) console.log(`  · ${d.id} — «${d.data().label ?? d.id}»`);

if (!apply) {
  console.log('\nDry-run: no se ha borrado nada. Repite con --apply para retirarlas.');
  process.exit(0);
}

for (const d of huerfanas) await d.ref.delete();
console.log(`\n✓ Retiradas ${huerfanas.length} rama(s) del catálogo.`);
