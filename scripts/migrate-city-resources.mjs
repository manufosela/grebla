/**
 * Migración idempotente (RMR-TSK-0386): sincroniza los RECURSOS de las casas de
 * una isla YA sembrada con los del contenido en código — añade a cada ciudad del
 * doc /careerMap/{islandId} los recursos del código cuya URL no esté ya (match
 * por URL; los recursos existentes y las ediciones del superadmin, intactos).
 *
 * SEGURO: dry-run por defecto; add-if-missing; no toca textos, posiciones ni
 * prereqs — solo appendea recursos que falten.
 *
 * Uso:
 *   node scripts/migrate-city-resources.mjs --island=devops --target=app          (dry-run)
 *   node scripts/migrate-city-resources.mjs --island=devops --target=app --apply
 *   node scripts/migrate-city-resources.mjs --island=devops --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { ISLAND_CONTENT } from '../src/tools/career/data/islands/index.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const islandId = (process.argv.find((a) => a.startsWith('--island=')) || '').split('=')[1];
const apply = process.argv.includes('--apply');

const seed = ISLAND_CONTENT[islandId];
if (!seed) {
  console.error(`✗ Isla desconocida «${islandId}». Disponibles: ${Object.keys(ISLAND_CONTENT).join(', ')}`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();
const ref = db.doc(`careerMap/${islandId}`);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`✗ «${target}» no tiene /careerMap/${islandId}.`);
  process.exit(1);
}

const doc = snap.data();
const seedByCityId = new Map(seed.cities.map((c) => [c.id, c]));
let additions = 0;
const cities = (doc.cities ?? []).map((city) => {
  const seedCity = seedByCityId.get(city?.id);
  if (!seedCity?.resources?.length) return city;
  const existingUrls = new Set((city.resources ?? []).map((r) => r?.url).filter(Boolean));
  const missing = seedCity.resources.filter((r) => r.url && !existingUrls.has(r.url));
  if (missing.length === 0) return city;
  additions += missing.length;
  for (const r of missing) console.log(`  · ${city.id}: + ${r.label}`);
  return { ...city, resources: [...(city.resources ?? []), ...missing] };
});

if (additions === 0) {
  console.log(`✓ «${target}»: los recursos de ${islandId} ya están al día. Nada que hacer.`);
  process.exit(0);
}

console.log(`\n${additions} recurso(s) nuevos en «${target}» · isla ${islandId}.`);
if (!apply) {
  console.log('(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}

await ref.update({ cities, updatedAt: FieldValue.serverTimestamp() });
console.log('✓ Aplicado.');
process.exit(0);
