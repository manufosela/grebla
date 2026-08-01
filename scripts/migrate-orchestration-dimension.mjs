/**
 * Migración idempotente (RMR-PCS-0028 · F1): añade la dimensión transversal
 * «Orquestación y juicio» (id `orchestration`) y sus expectativas por nivel al
 * doc /careerFramework/engineering de una instancia ya sembrada.
 *
 * SEGURO: dry-run por defecto; solo AÑADE lo que falta (add-if-missing) y NUNCA
 * pisa una dimensión o una celda de expectativa ya existente (preserva las
 * ediciones del superadmin). Si el doc no existe, siembra el framework completo.
 *
 * Uso:
 *   node scripts/migrate-orchestration-dimension.mjs --target=app            (dry-run)
 *   node scripts/migrate-orchestration-dimension.mjs --target=app --apply
 *   node scripts/migrate-orchestration-dimension.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { ENGINEERING_FRAMEWORK } from '../src/tools/career/data/framework.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

const DIMENSION_ID = 'orchestration';
const seedDimension = ENGINEERING_FRAMEWORK.dimensions.find((d) => d.id === DIMENSION_ID);
const seedExpectations = ENGINEERING_FRAMEWORK.expectations.filter((e) => e.dimensionId === DIMENSION_ID);
if (!seedDimension || seedExpectations.length === 0) {
  console.error(`✗ La semilla del framework no define la dimensión «${DIMENSION_ID}». Aborto.`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();
const ref = db.doc('careerFramework/engineering');

const snap = await ref.get();
if (!snap.exists) {
  console.log(`• /careerFramework/engineering no existe en «${target}».`);
  if (apply) {
    await ref.set(ENGINEERING_FRAMEWORK);
    console.log('✓ Sembrado el framework completo (incluye la dimensión de orquestación).');
  } else {
    console.log('  (dry-run) Con --apply se sembraría el framework completo.');
  }
  process.exit(0);
}

const current = snap.data();
// Si un campo EXISTE pero no es array, el doc tiene una forma inesperada
// (corrupción): abortar en vez de defaultear a [] y arriesgar sobreescribirlo.
for (const field of ['dimensions', 'expectations']) {
  if (current[field] !== undefined && !Array.isArray(current[field])) {
    console.error(`✗ /careerFramework/engineering.${field} no es un array (forma inesperada). Aborto sin escribir.`);
    process.exit(1);
  }
}
const dimensions = Array.isArray(current.dimensions) ? [...current.dimensions] : [];
const expectations = Array.isArray(current.expectations) ? [...current.expectations] : [];

// Dimensión: añadir solo si no existe (preserva la que hubiera, incluidas ediciones).
const hasDimension = dimensions.some((d) => d?.id === DIMENSION_ID);
if (!hasDimension) dimensions.push(seedDimension);

// Expectativas: añadir cada celda (levelId × orchestration) que no exista ya.
const hasCell = (levelId, dimensionId) =>
  expectations.some((e) => e?.levelId === levelId && e?.dimensionId === dimensionId);
const addedCells = seedExpectations.filter((e) => !hasCell(e.levelId, e.dimensionId));
expectations.push(...addedCells);

if (hasDimension && addedCells.length === 0) {
  console.log(`✓ «${target}» ya tiene la dimensión de orquestación y todas sus expectativas. Nada que hacer.`);
  process.exit(0);
}

console.log(`Cambios en «${target}»:`);
console.log(`  · dimensión «${DIMENSION_ID}»: ${hasDimension ? 'ya existe' : 'AÑADIR'}`);
console.log(`  · expectativas a añadir (${addedCells.length}): ${addedCells.map((e) => e.levelId).join(', ') || '—'}`);

if (!apply) {
  console.log('\n(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}

await ref.set({ dimensions, expectations }, { merge: true });
console.log('\n✓ Aplicado. Tracks, niveles, disciplinas y las demás dimensiones/expectativas intactos.');
process.exit(0);
