/**
 * Migración idempotente (RMR-TSK-0384): teje el tramo del LECHO en los docs
 * /careerRoutes YA sembrados de una instancia — APPENDEA el pack de orquestación
 * al final de `stops` de cada ruta *--veteranus / *--magister que aún no tenga
 * NINGUNA parada orchestration/*. Los docs con lecho (total o parcial, p.ej.
 * editados por el superadmin) no se tocan; los *--peritus tampoco.
 *
 * SEGURO: dry-run por defecto; add-if-missing; preserva el resto del doc.
 *
 * Uso:
 *   node scripts/migrate-routes-orchestration.mjs --target=app            (dry-run)
 *   node scripts/migrate-routes-orchestration.mjs --target=app --apply
 *   node scripts/migrate-routes-orchestration.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import {
  ORCHESTRATION_VETERANUS_STOPS,
  ORCHESTRATION_MAGISTER_STOPS,
} from '../src/tools/career/data/routes/orchestration.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

const PACKS = {
  veteranus: ORCHESTRATION_VETERANUS_STOPS,
  magister: ORCHESTRATION_MAGISTER_STOPS,
};

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const snap = await db.collection('careerRoutes').get();
if (snap.empty) {
  console.error(`✗ «${target}» no tiene docs en /careerRoutes. Nada que migrar.`);
  process.exit(1);
}

/** @type {Array<{id: string, stops: string[]}>} */
const pending = [];
let untouched = 0;
for (const doc of snap.docs) {
  const tierKey = doc.id.split('--').at(-1);
  const pack = PACKS[tierKey];
  if (!pack) { untouched += 1; continue; } // peritus u otros: no se tejen
  const stops = Array.isArray(doc.data().stops) ? doc.data().stops : [];
  if (stops.some((s) => String(s).startsWith('orchestration/'))) { untouched += 1; continue; }
  pending.push({ id: doc.id, stops: [...stops, ...pack] });
}

if (pending.length === 0) {
  console.log(`✓ «${target}»: las ${snap.size} rutas ya están tejidas (o no aplican). Nada que hacer.`);
  process.exit(0);
}

console.log(`Cambios en «${target}» (${snap.size} rutas, ${untouched} intactas):`);
for (const p of pending) console.log(`  · ${p.id}: +${PACKS[p.id.split('--').at(-1)].length} paradas del lecho al final`);

if (!apply) {
  console.log('\n(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}

for (const p of pending) {
  await db.collection('careerRoutes').doc(p.id).update({ stops: p.stops, updatedAt: FieldValue.serverTimestamp() });
}
console.log(`\n✓ Aplicado: ${pending.length} rutas tejidas.`);
process.exit(0);
