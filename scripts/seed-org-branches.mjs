/**
 * Siembra el catálogo inicial de ramas (/orgBranches) de una instancia GREBLA.
 * Idempotente: si la rama ya existe, no se toca (no pisar un renombrado del
 * superadmin). Uso: node scripts/seed-org-branches.mjs --target=tribbu | app
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '--target=app').split('=')[1];

const BRANCHES = [
  { id: 'engineering', label: 'Engineering' },
  { id: 'product', label: 'Product' },
  { id: 'people', label: 'People' },
  { id: 'data', label: 'Data' },
  { id: 'generico', label: 'Genérico' },
];

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

async function main() {
  console.log(`\n=== SEED /orgBranches · ${target} ===`);
  let created = 0;
  for (const b of BRANCHES) {
    const ref = db.collection('orgBranches').doc(b.id);
    if ((await ref.get()).exists) { console.log(`  · ${b.id} ya existe → intacto`); continue; }
    await ref.set({ label: b.label });
    created += 1;
    console.log(`  ✓ ${b.id} → «${b.label}»`);
  }
  console.log(`=== ${created} ramas creadas (${BRANCHES.length - created} intactas) ===\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
