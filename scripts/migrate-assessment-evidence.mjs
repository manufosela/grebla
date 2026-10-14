/**
 * Migra las valoraciones del nivel actual (/people/{id}/career/assessment, una
 * nota por dimensión) al historial de expectativas
 * (/people/{id}/careerEvidence), RMR-TSK-0713. La conversión es la función pura
 * `entriesFromLegacyAssessment`; aquí solo se lee y se escribe.
 *
 * SEGURO: dry-run por defecto; idempotente (ids fijos por dimensión, `create`
 * no pisa lo que ya existe). No borra la valoración antigua.
 *
 * Uso:
 *   node scripts/migrate-assessment-evidence.mjs --target=app            (dry-run)
 *   node scripts/migrate-assessment-evidence.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { entriesFromLegacyAssessment } from '../src/tools/career/domain/evidence.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const LEGACY_AUTHOR = { uid: 'grebla-migracion', name: 'Valoración anterior' };
const authorOf = (data) => (data?.updatedBy?.uid && data?.updatedBy?.name
  ? { uid: data.updatedBy.uid, name: data.updatedBy.name } : LEGACY_AUTHOR);
const instantOf = (data) => (typeof data?.updatedAt?.toDate === 'function'
  ? data.updatedAt.toDate().toISOString() : new Date().toISOString());

const people = (await db.collection('people').get()).docs;
const plan = [];
for (const person of people) {
  const snap = await db.doc(`people/${person.id}/career/assessment`).get();
  if (!snap.exists) continue;
  const data = snap.data();
  const entries = entriesFromLegacyAssessment(data, {
    levelId: person.data().levelId ?? null, by: authorOf(data), at: instantOf(data),
  });
  for (const e of entries) plan.push({ personId: person.id, name: person.data().name ?? person.id, ...e });
}

for (const p of plan) console.log(`  ${p.name} · ${p.entry.levelId}/${p.entry.dimensionId} · ${p.kind} · ${p.entry.text}`);
console.log(`«${target}» · ${plan.length} entradas a crear.`);
if (!apply) {
  console.log('(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}
let created = 0;
for (const p of plan) {
  try {
    await db.doc(`people/${p.personId}/careerEvidence/${p.id}`).create(p.entry);
    created += 1;
  } catch (err) {
    // 6 = ALREADY_EXISTS: ya migrada en una pasada anterior.
    if (err?.code !== 6) throw err;
  }
}
console.log(`✓ Hecho: ${created} creadas, ${plan.length - created} ya estaban.`);
process.exit(0);
