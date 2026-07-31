/**
 * Siembra las políticas de acceso a herramientas (/toolPolicies) de una instancia
 * GREBLA con los defaults acordados (RMR-PCS-0027 · F3). Idempotente (merge); NO
 * pisa ajustes posteriores del superadmin salvo en los campos sembrados.
 *
 * Uso: node scripts/seed-tool-policies.mjs --target=tribbu | app
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { TOOLS } from '../src/tools/team/data/tools.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '--target=app').split('=')[1];

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

async function main() {
  console.log(`\n=== SEED /toolPolicies · ${target} ===`);
  let created = 0;
  for (const t of TOOLS) {
    const ref = db.collection('toolPolicies').doc(t.toolId);
    // Idempotente y SEGURO: si ya existe, no se toca (no pisar la config que el
    // superadmin haya hecho en el panel). Solo se crean las que faltan.
    if ((await ref.get()).exists) {
      console.log(`  · ${t.toolId} ya existe → intacto`);
      continue;
    }
    await ref.set({ label: t.label, audience: t.audience ?? {}, managedBy: t.managedBy ?? {} });
    created += 1;
    const aud = t.audience?.everyone ? 'everyone' : (t.audience?.branches?.join('+') ?? '—');
    console.log(`  ✓ ${t.toolId} → ve: ${aud}`);
  }
  console.log(`=== ${created} políticas creadas (${TOOLS.length - created} intactas) ===\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
