/**
 * Backup READ-ONLY de las colecciones de identidad/jerarquía de una instancia
 * GREBLA. No modifica nada: solo lee y vuelca a un JSON con timestamp FUERA del
 * repo (~/grebla-backups/), para poder restaurar si una migración sale mal.
 *
 * Uso: node scripts/backup-firestore.mjs --target=tribbu [--all]
 *   --all incluye TODAS las colecciones de nivel raíz (no solo las de identidad).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1];
if (!target) {
  console.error('✗ Indica la instancia: --target=tribbu | app');
  process.exit(1);
}
const includeAll = process.argv.includes('--all');

// Colecciones clave para identidad/jerarquía. Con --all se descubren todas.
const IDENTITY_COLLECTIONS = ['people', 'leaders', 'supermanagers', 'admins', 'viewers', 'surveyAdmins'];

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(homedir(), 'grebla-backups', `${target}-${stamp}`);
mkdirSync(outDir, { recursive: true });

async function dumpCollection(name) {
  const snap = await db.collection(name).get();
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
  return docs.length;
}

async function main() {
  let names = IDENTITY_COLLECTIONS;
  if (includeAll) {
    const cols = await db.listCollections();
    names = cols.map((c) => c.id);
  }
  console.log(`\n=== BACKUP ${target} → ${outDir} ===`);
  const failures = [];
  for (const name of names) {
    try {
      const n = await dumpCollection(name);
      console.log(`  ✓ ${name}: ${n} docs`);
    } catch (e) {
      // Un fallo de exportación NO se silencia: un backup parcial que se anuncia
      // como completo es peor que ninguno (su función es ser red antes de migrar).
      console.error(`  ✗ ${name}: FALLO — ${e.message}`);
      failures.push(name);
    }
  }
  if (failures.length) {
    console.error(`\n=== BACKUP INCOMPLETO: fallaron ${failures.length} colección(es): ${failures.join(', ')} ===\n`);
    process.exit(1);
  }
  console.log('=== BACKUP COMPLETO ===\n');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
