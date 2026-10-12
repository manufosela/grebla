/**
 * Backfill de quién revisa la carrera de cada persona (RMR-TSK-0683): rellena
 * `careerReviewers` en las fichas que ya existían. A partir de aquí lo mantiene
 * el trigger del organigrama (RMR-TSK-0676), con la MISMA función pura.
 *
 * SEGURO: dry-run por defecto; idempotente (solo escribe las fichas que cambian).
 *
 * Uso:
 *   node scripts/backfill-career-reviewers.mjs --target=app            (dry-run)
 *   node scripts/backfill-career-reviewers.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { careerReviewersPatches } from '../functions/careerReviewers.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const snap = await db.collection('people').get();
const people = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const names = new Map(people.map((p) => [p.uid, p.name]));
const patches = careerReviewersPatches(people);

const who = (uid) => (uid ? names.get(uid) ?? uid : '—');
for (const { id, reviewers } of patches) {
  const name = people.find((p) => p.id === id)?.name ?? id;
  console.log(`  ${name}: ${who(reviewers.firstUid)} + ${who(reviewers.secondUid)} · desempata ${who(reviewers.arbiterUid)}`);
}
console.log(`«${target}» · ${patches.length} de ${people.length} fichas cambian.`);
if (!apply) {
  console.log('(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}
for (const { id, reviewers } of patches) {
  await db.doc(`people/${id}`).set({ careerReviewers: reviewers }, { merge: true });
}
console.log('✓ Hecho.');
process.exit(0);
