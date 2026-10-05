/**
 * Backfill de /orgBranches/engineering.hasGuilds (RMR-TSK-0593): desde ahora
 * solo los departamentos marcados se reparten en gremios. Engineering lo era
 * siempre, así que recibe `hasGuilds: true` si no tiene el campo; un valor que
 * ya haya puesto el superadmin no se toca.
 *
 * SEGURO: dry-run por defecto; idempotente.
 *
 * Uso:
 *   node scripts/backfill-branch-guilds.mjs --target=app            (dry-run)
 *   node scripts/backfill-branch-guilds.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

initializeApp({ credential: cert(serviceAccountPath(target)) });
const ref = getFirestore().doc('orgBranches/engineering');
const snap = await ref.get();

if (!snap.exists) {
  console.log(`«${target}» · no hay rama engineering: nada que hacer.`);
  process.exit(0);
}
if (typeof snap.data().hasGuilds === 'boolean') {
  console.log(`«${target}» · engineering ya dice hasGuilds=${snap.data().hasGuilds}: no se toca.`);
  process.exit(0);
}
console.log(`«${target}» · engineering «${snap.data().label}» → hasGuilds: true`);
if (!apply) {
  console.log('(dry-run) No se ha escrito nada. Repite con --apply para aplicar.');
  process.exit(0);
}
await ref.update({ hasGuilds: true });
console.log('✓ Hecho.');
process.exit(0);
