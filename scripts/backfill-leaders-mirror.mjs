/**
 * Backfill del espejo /leaders desde el organigrama (RMR-TSK-0421): deriva
 * reportsTo de la ficha vinculada de cada líder (reportsToPersonId → uid del
 * jefe) y precomputa `chain` (uids ancestros, cercano primero) para que las
 * reglas autoricen la visibilidad transitiva del subárbol.
 *
 * Prudente con lo NO derivable (misma política que la CF syncLeadersMirror):
 * líder sin ficha vinculada o con jefe sin cuenta → su reportsTo actual se
 * respeta (solo se recalcula su chain).
 *
 * SEGURO: dry-run por defecto; muestra el diff completo antes de escribir.
 * Uso: node scripts/backfill-leaders-mirror.mjs --target=app|tribbu [--apply]
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { leaderChainsFrom } from '../src/lib/accessRoles.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();
console.log(`\n=== BACKFILL espejo /leaders · ${target} · ${apply ? 'APLICANDO' : 'dry-run'} ===`);

const [peopleSnap, leadersSnap] = await Promise.all([
  db.collection('people').get(),
  db.collection('leaders').get(),
]);
const peopleById = new Map(peopleSnap.docs.map((d) => [d.id, d.data()]));
const personByUid = new Map();
for (const p of peopleById.values()) {
  if (p.uid) personByUid.set(p.uid, p);
}
const nameOf = (uid) => personByUid.get(uid)?.name ?? uid ?? '—';

const effective = leadersSnap.docs.map((d) => {
  const current = d.data().reportsTo ?? null;
  const persona = personByUid.get(d.id);
  if (!persona) return { uid: d.id, reportsTo: current, note: 'sin ficha vinculada — se respeta' };
  const bossId = persona.reportsToPersonId ?? null;
  if (!bossId) return { uid: d.id, reportsTo: null, note: 'organigrama: sin superior' };
  const boss = peopleById.get(bossId);
  if (!boss?.uid) return { uid: d.id, reportsTo: current, note: 'jefe sin cuenta — se respeta' };
  return { uid: d.id, reportsTo: boss.uid, note: `organigrama: reporta a ${boss.name ?? boss.uid}` };
});
const chains = leaderChainsFrom(effective);

let changes = 0;
for (const doc of leadersSnap.docs) {
  const next = effective.find((l) => l.uid === doc.id);
  const chain = chains.get(doc.id) ?? [];
  const prevReports = doc.data().reportsTo ?? null;
  const prevChain = Array.isArray(doc.data().chain) ? doc.data().chain : [];
  const sameChain = prevChain.length === chain.length && prevChain.every((v, i) => v === chain[i]);
  if (prevReports === next.reportsTo && sameChain) {
    console.log(`  = ${nameOf(doc.id)}: sin cambios`);
    continue;
  }
  changes += 1;
  console.log(`  ~ ${nameOf(doc.id)} (${next.note})`);
  if (prevReports !== next.reportsTo) {
    console.log(`      reportsTo: ${nameOf(prevReports)} → ${nameOf(next.reportsTo)}`);
  }
  if (!sameChain) {
    console.log(`      chain: [${prevChain.map(nameOf).join(', ')}] → [${chain.map(nameOf).join(', ')}]`);
  }
  if (apply) await doc.ref.set({ reportsTo: next.reportsTo, chain }, { merge: true });
}
console.log(`=== líderes a tocar: ${changes}/${leadersSnap.size} · ${apply ? 'APLICADO' : 're-ejecuta con --apply'} ===`);
process.exit(0);
