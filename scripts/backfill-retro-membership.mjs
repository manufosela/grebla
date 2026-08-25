#!/usr/bin/env node
/**
 * Migra las retros al modelo de membresía (RMR-TSK-0453, ADR «Retros por
 * membresía»): quien la convocó queda dentro y su cadena de managers pasa a
 * `branchUids`, para que siga viéndola quien la veía por el organigrama.
 *
 * Sin esto, una retro anterior al cambio no la vería NADIE: las reglas y el
 * listado miran campos que ese documento no tiene.
 *
 * Uso:
 *   node scripts/backfill-retro-membership.mjs [app|tribbu] [--apply]
 *
 * Sin `--apply` no escribe nada: enseña lo que haría. Es idempotente — volver a
 * ejecutarlo sobre una retro ya migrada no la toca.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = process.argv[2] === 'tribbu' ? 'tribbu' : 'app';
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

/** Cadena de managers de un uid, siguiendo `reportsTo` hacia arriba. */
function chainOf(leaders, uid) {
  const chain = [];
  const visto = new Set([uid]);
  let actual = leaders.get(uid)?.reportsTo ?? null;
  while (actual && !visto.has(actual)) {
    chain.push(actual);
    visto.add(actual);
    actual = leaders.get(actual)?.reportsTo ?? null;
  }
  return chain;
}

const [retros, leadersSnap] = await Promise.all([
  db.collection('retros').get(),
  db.collection('leaders').get(),
]);
const leaders = new Map(leadersSnap.docs.map((d) => [d.id, d.data()]));

console.log(`[${target}] ${retros.size} retro(s)${apply ? '' : ' — simulación, no se escribe nada'}\n`);

let migradas = 0;
let intactas = 0;
for (const snap of retros.docs) {
  const retro = snap.data();
  if (Array.isArray(retro.memberUids) && retro.memberUids.length > 0) {
    intactas += 1;
    continue;
  }
  const owner = retro.ownerLeaderUid;
  if (!owner) {
    console.log(`  ✗ ${snap.id} «${retro.name ?? 'sin nombre'}» no tiene dueño: se deja como está para revisarla a mano`);
    continue;
  }
  const memberUids = [owner];
  const branchUids = chainOf(leaders, owner);
  console.log(`  · ${snap.id} «${retro.name ?? 'sin nombre'}» → dentro: ${memberUids.join(', ')} · rama: ${branchUids.join(', ') || '(ninguna)'}`);
  if (apply) await snap.ref.update({ memberUids, branchUids, migratedAt: FieldValue.serverTimestamp() });
  migradas += 1;
}

console.log(`\n${migradas} migrada(s), ${intactas} ya lo estaban.`);
if (!apply && migradas > 0) console.log('Vuelve a ejecutarlo con --apply para escribir.');
