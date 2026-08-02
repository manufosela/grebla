/**
 * Migración idempotente (RMR-TSK-0383): añade al doc /careerMap/seabed de una
 * instancia YA sembrada los arrecifes NUEVOS del contenido en código (y sus
 * áreas si faltaran), sin tocar los existentes — así se preservan las ediciones
 * del superadmin (posiciones, textos, prereqs) sobre los arrecifes previos.
 * También actualiza citiesTotal del ref del lecho en el índice _archipelago.
 *
 * SEGURO: dry-run por defecto; add-if-missing; nunca reescribe un arrecife ya
 * presente ni reordena nada.
 *
 * Uso:
 *   node scripts/migrate-seabed-arrecifes.mjs --target=app            (dry-run)
 *   node scripts/migrate-seabed-arrecifes.mjs --target=app --apply
 *   node scripts/migrate-seabed-arrecifes.mjs --target=tribbu --apply
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
const seed = serializeCareerMap(SEABED_ISLAND);
const seedRef = ARCHIPELAGO_ISLANDS.find((i) => i.id === SEABED_ID);

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();
const archRef = db.doc('careerMap/_archipelago');
const islandRef = db.doc(`careerMap/${SEABED_ID}`);

const [archSnap, islandSnap] = await Promise.all([archRef.get(), islandRef.get()]);
if (!islandSnap.exists) {
  console.error(`✗ «${target}» no tiene /careerMap/seabed. Ejecuta antes migrate-seabed-island.mjs.`);
  process.exit(1);
}

const doc = islandSnap.data();
const existingCityIds = new Set((doc.cities ?? []).map((c) => c?.id));
const existingAreaIds = new Set((doc.areas ?? []).map((a) => a?.id));
const newCities = (seed.cities ?? []).filter((c) => !existingCityIds.has(c.id));
const newAreas = (seed.areas ?? []).filter((a) => !existingAreaIds.has(a.id));

// Índice: actualizar citiesTotal del ref del lecho si difiere (preservando el resto).
const archipelago = archSnap.exists ? normalizeArchipelago(archSnap.data()) : { islands: [...ARCHIPELAGO_ISLANDS] };
const idxRef = archipelago.islands.find((i) => i?.id === SEABED_ID);
const wantTotal = seedRef?.citiesTotal ?? (doc.cities ?? []).length + newCities.length;
const needsIndexWrite = Boolean(idxRef && idxRef.citiesTotal !== wantTotal);
if (idxRef) idxRef.citiesTotal = wantTotal;

if (newCities.length === 0 && newAreas.length === 0 && !needsIndexWrite) {
  console.log(`✓ «${target}» ya tiene todos los arrecifes del código. Nada que hacer.`);
  process.exit(0);
}

console.log(`Cambios en «${target}»:`);
for (const a of newAreas) console.log(`  · área nueva: ${a.id} («${a.name}»)`);
for (const c of newCities) console.log(`  · arrecife nuevo: ${c.id} («${c.name}»)`);
if (needsIndexWrite) console.log(`  · índice: citiesTotal del lecho → ${wantTotal}`);
console.log(`  (arrecifes existentes intactos: ${existingCityIds.size})`);

if (!apply) {
  console.log('\n(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}

if (newCities.length || newAreas.length) {
  await islandRef.update({
    cities: [...(doc.cities ?? []), ...newCities],
    areas: [...(doc.areas ?? []), ...newAreas],
    updatedAt: FieldValue.serverTimestamp(),
  });
}
if (needsIndexWrite) {
  await archRef.set({ ...serializeArchipelago(archipelago), updatedAt: FieldValue.serverTimestamp() });
}
console.log('\n✓ Aplicado.');
process.exit(0);
