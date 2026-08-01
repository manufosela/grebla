/**
 * Migración idempotente (RMR-PCS-0028 · F2): incorpora el LECHO al archipiélago
 * de una instancia ya sembrada. Hace dos cosas, solo si faltan:
 *   1. Añade el IslandRef del lecho (seabed:true) al índice /careerMap/_archipelago.
 *   2. Siembra el doc /careerMap/seabed con el contenido en código.
 *
 * SEGURO: dry-run por defecto; add-if-missing; NO pisa el índice existente (lee,
 * normaliza —preserva ediciones, posiciones y totales— y solo AÑADE la entrada
 * del lecho) ni el doc del lecho si ya existe. El seed-islands normal no basta:
 * no reconcilia islas nuevas en el índice (avisaría «seabed no está en el índice»).
 *
 * Uso:
 *   node scripts/migrate-seabed-island.mjs --target=app            (dry-run)
 *   node scripts/migrate-seabed-island.mjs --target=app --apply
 *   node scripts/migrate-seabed-island.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { ARCHIPELAGO_ISLANDS, normalizeArchipelago, serializeArchipelago } from '../src/tools/career/data/archipelago.js';
import { serializeCareerMap } from '../src/tools/career/data/maps.js';
import { SEABED_ISLAND } from '../src/tools/career/data/islands/seabed.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

const SEABED_ID = 'seabed';
const seabedRef = ARCHIPELAGO_ISLANDS.find((i) => i.id === SEABED_ID);
if (!seabedRef) {
  console.error(`✗ La semilla del archipiélago no define la isla «${SEABED_ID}». Aborto.`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();
const archRef = db.doc('careerMap/_archipelago');
const islandRef = db.doc(`careerMap/${SEABED_ID}`);

const [archSnap, islandSnap] = await Promise.all([archRef.get(), islandRef.get()]);

// 1) Índice: añadir el ref del lecho si falta (preservando el resto). Si el doc
//    del índice NO existe, hay que crearlo completo aunque el fallback en memoria
//    ya contenga el lecho (si no, nunca se escribiría).
const archExists = archSnap.exists;
const archipelago = archExists ? normalizeArchipelago(archSnap.data()) : { islands: [...ARCHIPELAGO_ISLANDS] };
const hasRef = archipelago.islands.some((i) => i?.id === SEABED_ID);
if (!hasRef) archipelago.islands.push(seabedRef);
const needsIndexWrite = !archExists || !hasRef;

// 2) Doc del lecho: sembrar si falta.
const needsDoc = !islandSnap.exists;

if (!needsIndexWrite && !needsDoc) {
  console.log(`✓ «${target}» ya tiene el lecho en el índice y su doc /careerMap/seabed. Nada que hacer.`);
  process.exit(0);
}

const indexAction = !archExists ? 'CREAR índice completo (incluye el lecho)' : hasRef ? 'ya incluye el lecho' : 'AÑADIR ref del lecho';
console.log(`Cambios en «${target}»:`);
console.log(`  · índice _archipelago: ${indexAction}`);
console.log(`  · doc /careerMap/seabed: ${needsDoc ? 'SEMBRAR' : 'ya existe (no se toca)'}`);

if (!apply) {
  console.log('\n(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}

if (needsIndexWrite) {
  await archRef.set({ ...serializeArchipelago(archipelago), updatedAt: FieldValue.serverTimestamp() });
}
if (needsDoc) {
  await islandRef.set({ ...serializeCareerMap(SEABED_ISLAND), updatedAt: FieldValue.serverTimestamp() });
}
console.log('\n✓ Aplicado. El resto del archipiélago (13 islas del mar) intacto.');
process.exit(0);
