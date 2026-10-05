/**
 * Siembra el catálogo inicial de ramas (/orgBranches) de una instancia GREBLA.
 * Idempotente: si la rama ya existe, no se toca (no pisar un renombrado del
 * superadmin). Uso: node scripts/seed-org-branches.mjs --target=tribbu | app
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '--target=app').split('=')[1];

// Departamentos GENÉRICOS de partida (demo). Cada organización los renombra,
// borra o crea en Admin › Ramas; su color vive en el documento (RMR-TSK-0619).
const BRANCHES = [
  // Solo Engineering se reparte en gremios (RMR-TSK-0593); el resto, gremio único.
  { id: 'engineering', label: 'Engineering', color: '#2a9d8f', hasGuilds: true },
  { id: 'product', label: 'Product', color: '#e76f51' },
  { id: 'people', label: 'People', color: '#9d4edd' },
  { id: 'data', label: 'Data', color: '#457b9d' },
  { id: 'generico', label: 'Genérico', color: '#6b7280' },
];

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

async function main() {
  console.log(`\n=== SEED /orgBranches · ${target} ===`);
  let created = 0;
  for (const b of BRANCHES) {
    const ref = db.collection('orgBranches').doc(b.id);
    if ((await ref.get()).exists) { console.log(`  · ${b.id} ya existe → intacto`); continue; }
    await ref.set({ label: b.label, color: b.color, hasGuilds: b.hasGuilds === true });
    created += 1;
    console.log(`  ✓ ${b.id} → «${b.label}»`);
  }
  console.log(`=== ${created} ramas creadas (${BRANCHES.length - created} intactas) ===\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
