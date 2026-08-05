/**
 * Backfill de la propiedad derivada del organigrama (RMR-PCS-0035 · F2).
 * DRY-RUN por defecto: lista quién cambiaría de dueño y por qué; aplica solo
 * con --apply. Usa el dominio real (ownerUidFor) — misma regla que la CF.
 *
 * Uso: node scripts/backfill-org-ownership.mjs --target=tribbu|app [--apply]
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { ownerUidFor } from '../src/tools/team/domain/orgOwnership.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '--target=app').split('=')[1];
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const snap = await db.collection('people').get();
const peopleById = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
const nameOfUid = (uid) => [...peopleById.values()].find((p) => p.uid === uid)?.name ?? uid ?? '—';

console.log(`\n=== BACKFILL org-ownership · ${target} · ${apply ? 'APLICANDO' : 'dry-run'} ===`);
let changes = 0;
const skipped = new Map();
for (const person of peopleById.values()) {
  const { ownerUid, reason } = ownerUidFor(person, peopleById);
  if (ownerUid === undefined) {
    skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
    continue;
  }
  const current = person.ownerLeaderUid ?? null;
  if (current === ownerUid) continue;
  changes += 1;
  console.log(
    `  ${person.name}: ${nameOfUid(current)} → ${ownerUid === null ? '(sin dueño: solo superadmin)' : nameOfUid(ownerUid)} [${reason}]`,
  );
  if (apply) await db.doc(`people/${person.id}`).set({ ownerLeaderUid: ownerUid }, { merge: true });
}
console.log(`=== ${changes} cambios ${apply ? 'aplicados' : 'pendientes (re-ejecuta con --apply)'} ===`);
for (const [reason, n] of skipped) console.log(`  · sin cambio (${reason}): ${n}`);
process.exit(0);
