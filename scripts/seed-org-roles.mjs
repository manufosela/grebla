/**
 * Siembra el catálogo inicial de roles del organigrama (/orgRoles) de una
 * instancia GREBLA (RMR-PCS-0027 · F2). Idempotente: usa merge, no pisa cambios
 * que el superadmin haya hecho luego en el panel. NO borra roles existentes.
 *
 * Uso: node scripts/seed-org-roles.mjs --target=tribbu | app
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '--target=app').split('=')[1];

// Organigrama inicial. reportsToRoleId encadena cada rama hacia su cima.
const ROLES = [
  // Engineering: CTO → Head of Engineering → Engineering Manager → Engineer
  { id: 'cto', label: 'CTO', branch: 'engineering', reportsToRoleId: null },
  { id: 'head-eng', label: 'Head of Engineering', branch: 'engineering', reportsToRoleId: 'cto' },
  { id: 'em', label: 'Engineering Manager', branch: 'engineering', reportsToRoleId: 'head-eng' },
  { id: 'engineer', label: 'Engineer', branch: 'engineering', reportsToRoleId: 'em' },
  // Product: CPO → Product Manager (sin mandos intermedios)
  { id: 'cpo', label: 'CPO', branch: 'product', reportsToRoleId: null },
  { id: 'pm', label: 'Product Manager', branch: 'product', reportsToRoleId: 'cpo' },
  // People: Chief People Officer (solo, sin subordinados de momento)
  { id: 'cpeople', label: 'Chief People Officer', branch: 'people', reportsToRoleId: null },
  // Data: Head of Data (cima de su rama, sin managers debajo)
  { id: 'head-data', label: 'Head of Data', branch: 'data', reportsToRoleId: null },
  // Empleado sin rama asignada: miembro genérico de TRIBBU
  { id: 'generico', label: 'Genérico', branch: 'generico', reportsToRoleId: null },
];

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

async function main() {
  console.log(`\n=== SEED /orgRoles · ${target} ===`);
  let created = 0;
  for (const r of ROLES) {
    const ref = db.collection('orgRoles').doc(r.id);
    // Idempotente y SEGURO: si el rol ya existe, no se toca (no pisar el
    // organigrama que el superadmin haya reordenado). Solo se crean los que faltan.
    if ((await ref.get()).exists) {
      console.log(`  · ${r.id} ya existe → intacto`);
      continue;
    }
    await ref.set({ label: r.label, branch: r.branch, reportsToRoleId: r.reportsToRoleId });
    created += 1;
    console.log(`  ✓ ${r.id} (${r.branch}) → ${r.reportsToRoleId ?? 'cima'}`);
  }
  console.log(`=== ${created} roles creados (${ROLES.length - created} intactos) ===\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
