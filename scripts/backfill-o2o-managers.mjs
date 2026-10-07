#!/usr/bin/env node
/**
 * Siembra los managers de O2O (RMR-TSK-0654) desde el reparto actual: a cada
 * persona con dueño se le pone ese dueño como su manager de O2O. Así nadie deja
 * de ver a su gente el día que el selector de O2O pasa a leer esta lista; luego
 * el superadmin la ajusta a mano (quita a quien no es de su equipo, añade más).
 *
 * Uso:
 *   node scripts/backfill-o2o-managers.mjs <app|tribbu> [--apply]
 *
 * Sin `--apply` no escribe nada: enseña lo que haría. Con `--apply` guarda antes
 * una copia de las personas que va a tocar en ~/.secrets/grebla/backups. Es
 * idempotente: una persona que ya tiene la lista (aunque vacía) no se toca.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = process.argv[2];
if (!['app', 'tribbu'].includes(target)) {
  console.error('✗ Indica la instancia: app o tribbu.');
  process.exit(1);
}
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const people = await db.collection('people').get();
const pending = people.docs.filter((d) => !Array.isArray(d.data().o2oManagerUids) && d.data().ownerLeaderUid);
const ownerless = people.docs.filter((d) => !Array.isArray(d.data().o2oManagerUids) && !d.data().ownerLeaderUid);

console.log(`[${target}] ${people.size} persona(s): ${pending.length} a sembrar, ${ownerless.length} sin dueño (se dejan)${apply ? '' : ' — simulación, no se escribe nada'}`);
const byOwner = Object.groupBy(pending, (d) => d.data().ownerLeaderUid);
for (const [owner, docs] of Object.entries(byOwner)) console.log(`  ${owner}: ${docs.length}`);

if (apply && pending.length) {
  const dir = join(homedir(), '.secrets', 'grebla', 'backups');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, `o2o-managers-${target}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(pending.map((d) => ({ id: d.id, ownerLeaderUid: d.data().ownerLeaderUid })), null, 2), { mode: 0o600 });
  console.log(`  copia en ${file}`);
  for (let i = 0; i < pending.length; i += 400) {
    const batch = db.batch();
    for (const d of pending.slice(i, i + 400)) batch.update(d.ref, { o2oManagerUids: [d.data().ownerLeaderUid] });
    await batch.commit();
  }
  console.log(`✓ ${pending.length} persona(s) sembradas.`);
}
