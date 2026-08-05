/**
 * Migración idempotente (RMR-TSK-0430): añade las casas del paquete «listo
 * para L3» a las islas YA sembradas y teje sus paradas en las rutas.
 *
 *  - /careerMap/island: añade bases/mutation-testing (si falta) y actualiza
 *    citiesTotal del ref del índice _archipelago.
 *  - /careerMap/software-architect: añade software-architect/rfcs (si falta) y
 *    actualiza su citiesTotal.
 *  - /careerRoutes/{rol-ingeniería}--{veteranus|magister}: appendea las
 *    paradas del paquete que FALTEN, al final y en orden (add-if-missing por
 *    parada; los peritus y el rol software-architect no se tocan).
 *
 * SEGURO: dry-run por defecto; nunca reescribe ni reordena lo existente.
 * Uso: node scripts/migrate-l3-readiness.mjs --target=app|tribbu [--apply]
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { ISLAND_CONTENT } from '../src/tools/career/data/islands/index.js';
import { L3_READINESS_STOPS } from '../src/tools/career/data/routes/l3Readiness.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

const NEW_CITIES = [
  { islandDocId: 'island', cityId: 'bases/mutation-testing' },
  { islandDocId: 'software-architect', cityId: 'software-architect/rfcs' },
];
const ENGINEERING_DISCIPLINES = new Set([
  'backend-php', 'backend-python', 'frontend', 'android', 'ios', 'devops', 'fde', 'ai-engineer',
]);

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();
console.log(`\n=== MIGRACIÓN l3-readiness · ${target} · ${apply ? 'APLICANDO' : 'dry-run'} ===`);

// ── Casas nuevas en las islas ────────────────────────────────────────────────
const archRef = db.doc('careerMap/_archipelago');
const archSnap = await archRef.get();
for (const { islandDocId, cityId } of NEW_CITIES) {
  const ref = db.doc(`careerMap/${islandDocId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`  · isla ${islandDocId}: SIN doc en esta instancia — se salta`);
    continue;
  }
  const cities = snap.data().cities ?? [];
  if (cities.some((c) => c.id === cityId)) {
    console.log(`  · ${cityId}: ya existe — intacta`);
    continue;
  }
  const seed = ISLAND_CONTENT[islandDocId]?.cities?.find((c) => c.id === cityId);
  if (!seed) {
    console.error(`  ✗ ${cityId}: no está en el seed en código — abortando esa isla`);
    continue;
  }
  console.log(`  + ${cityId} → ${islandDocId} (${cities.length} → ${cities.length + 1} casas)`);
  if (apply) {
    await ref.update({ cities: [...cities, seed] });
    // citiesTotal del ref del índice (si la instancia lo tiene)
    if (archSnap.exists) {
      const islands = archSnap.data().islands ?? [];
      const updated = islands.map((i) => (i.id === islandDocId ? { ...i, citiesTotal: cities.length + 1 } : i));
      await archRef.update({ islands: updated });
    }
  }
}

// ── Paradas en las rutas de ingeniería ───────────────────────────────────────
const routes = await db.collection('careerRoutes').get();
let touched = 0;
for (const doc of routes.docs) {
  const [discipline, tierKey] = [doc.id.split('--').slice(0, -1).join('--'), doc.id.split('--').at(-1)];
  if (!ENGINEERING_DISCIPLINES.has(discipline)) continue;
  if (tierKey !== 'veteranus' && tierKey !== 'magister') continue;
  const stops = doc.data().stops ?? [];
  const missing = L3_READINESS_STOPS.filter((s) => !stops.includes(s));
  if (missing.length === 0) continue;
  touched += 1;
  console.log(`  + ${doc.id}: ${stops.length} → ${stops.length + missing.length} paradas (${missing.join(', ')})`);
  if (apply) await doc.ref.update({ stops: [...stops, ...missing] });
}
console.log(`=== rutas a tocar: ${touched} · ${apply ? 'APLICADO' : 're-ejecuta con --apply'} ===`);
process.exit(0);
