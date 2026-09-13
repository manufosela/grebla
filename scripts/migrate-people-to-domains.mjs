/**
 * Lleva la pertenencia de las personas del SQUAD al DOMINIO
 * (ADR «De squads a dominios y subdominios», F4 · RMR-TSK-0479).
 *
 * El squad mezclaba dónde ocurre el trabajo con quién pertenece a él. Con
 * equipos fluidos lo segundo deja de tener sentido: hoy estás en Trust y mañana
 * en Matcher, y eso no puede exigir que nadie te reasigne. Así que la persona
 * pasa a pertenecer al PRODUCTO y se mueve libre por sus subdominios.
 *
 * El mapeo squad→dominio se escribe a mano y por NOMBRE del squad, igual que en
 * la migración del catálogo: es una decisión de modelo, no una transformación
 * del texto.
 *
 * NO se borra `squadIds`. El concepto sigue vivo durante la transición —decisión
 * explícita del usuario— y así relanzar esto no depende de haber destruido nada.
 *
 * SEGURO: dry-run por defecto e idempotente (si ya tiene el dominio, no escribe).
 *
 * Uso:
 *   node scripts/migrate-people-to-domains.mjs --target=tribbu            (dry-run)
 *   node scripts/migrate-people-to-domains.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { domainKeysFromSquads } from '../src/tools/team/domain/membership.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

/** Nombre del squad → key del dominio al que pasa su gente. */
const SQUAD_A_DOMINIO = {
  CAES: 'tribbu-app',
  Trust: 'tribbu-app',
  Core: 'tribbu-app',
  Matcher: 'tribbu-app',
  Plataforma: 'plataforma',
  'Internal Products': 'internal-products',
};

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const [people, squads, domains] = await Promise.all([
  db.collection('people').get(),
  db.collection('squads').get(),
  db.collection('domains').get(),
]);

const claves = new Set(domains.docs.map((d) => d.data().key));
// id de squad → key de dominio, resuelto por el nombre del squad.
const porId = {};
const sinPlan = [];
for (const d of squads.docs) {
  const nombre = d.data().name;
  const key = SQUAD_A_DOMINIO[nombre];
  if (!key) { sinPlan.push(nombre); continue; }
  if (!claves.has(key)) { sinPlan.push(`${nombre} → «${key}» no está en /domains`); continue; }
  porId[d.id] = key;
}
if (sinPlan.length > 0) {
  console.log(`[${target}] ⚠ squads sin destino (su gente NO se toca): ${sinPlan.join(', ')}`);
}

const acciones = [];
const intactas = [];
for (const doc of people.docs) {
  const p = doc.data();
  const squadIds = p.squadIds ?? [];
  if (squadIds.length === 0) { intactas.push({ n: p.name, motivo: 'sin squad' }); continue; }
  const domainKeys = domainKeysFromSquads(squadIds, porId);
  if (domainKeys.length === 0) { intactas.push({ n: p.name, motivo: 'su squad no tiene destino' }); continue; }
  const ya = (p.domainKeys ?? []).toSorted();
  if (ya.join() === domainKeys.join()) { intactas.push({ n: p.name, motivo: `ya está en ${ya.join(', ')}` }); continue; }
  acciones.push({ id: doc.id, name: p.name ?? doc.id, domainKeys });
}

console.log(`\n[${target}] personas a mover (${acciones.length}):`);
for (const a of acciones) console.log(`  ${a.name} → ${a.domainKeys.join(', ')}`);
console.log(`\n[${target}] sin cambios (${intactas.length}): ` +
  intactas.slice(0, 6).map((i) => `${i.n} (${i.motivo})`).join(' · ') +
  (intactas.length > 6 ? ` … y ${intactas.length - 6} más` : ''));

if (!apply) {
  console.log('\nDry-run: no se ha escrito nada. Repite con --apply.');
  process.exit(0);
}

for (const a of acciones) {
  // merge: la ficha tiene mucho más que esto, y `squadIds` se queda donde está.
  await db.collection('people').doc(a.id).set({ domainKeys: a.domainKeys }, { merge: true });
  console.log(`  ✓ ${a.name}`);
}
console.log(`\n✓ ${acciones.length} persona(s) en su dominio. squadIds NO se ha tocado.`);
