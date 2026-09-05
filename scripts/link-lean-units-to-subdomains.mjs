/**
 * Engancha las unidades LEAN que YA existen a su subdominio del catálogo
 * (ADR «De squads a dominios y subdominios», F2 · RMR-TSK-0477).
 *
 * Hasta ahora `leanTeams` y el catálogo eran dos listas paralelas que nadie
 * conciliaba: se medía «The Mario Netas» —que no está en el catálogo, es el
 * nombre informal del Core en Linear— y Matcher, que sí está, no lo mide nadie.
 * Aquí cada equipo declara a qué subdominio pertenece con su `subdomainKey`.
 *
 * El mapeo se escribe A MANO y no se deriva del nombre: es una decisión de
 * modelo, no una transformación de texto, y derivar claves de nombres es
 * justamente el bug que este ADR corrige.
 *
 * Solo toca EQUIPOS (`kind: 'squad'`). Los gremios cruzan varios subdominios:
 * publicarlos como si fueran uno sumaría el mismo trabajo dos veces.
 *
 * SEGURO: dry-run por defecto, idempotente, y **no inventa nada**. Si un equipo
 * no está en el plan, o su clave no existe en el catálogo, se lista y se deja
 * intacto — incluida la unidad huérfana sin `kind` ni nombre, que nadie sabe
 * qué mide.
 *
 * Uso:
 *   node scripts/link-lean-units-to-subdomains.mjs --target=tribbu            (dry-run)
 *   node scripts/link-lean-units-to-subdomains.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

/**
 * Nombre del equipo en LEAN → clave del subdominio que mide.
 * «The Mario Netas» es como llaman en Linear al Core de TRIBBU-APP: el rótulo se
 * queda como está, porque lo que dice a qué pertenece es la clave.
 * @type {Record<string, string>}
 */
const PLAN = {
  'The Mario Netas': 'tribbu-app-core',
  CAEs: 'caes',
  Trust: 'trust',
  'Internal Products': 'internal-products-core',
};

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const [unitsSnap, subsSnap] = await Promise.all([
  db.collection('leanTeams').get(),
  db.collection('subdomains').get(),
]);

const catalogo = new Set(subsSnap.docs.map((d) => d.data().key).filter(Boolean));
if (catalogo.size === 0) {
  console.log(`[${target}] el catálogo de subdominios está vacío: migra primero los dominios.`);
  process.exit(1);
}

const acciones = [];
const intactas = [];
for (const doc of unitsSnap.docs) {
  const unit = doc.data();
  const nombre = unit.name || unit.linearLabel || '';
  if (unit.kind !== 'squad') {
    intactas.push({ id: doc.id, nombre: nombre || '(sin nombre)', motivo: unit.kind ? 'es un gremio' : 'sin kind: no se sabe qué mide' });
    continue;
  }
  const key = PLAN[nombre];
  if (!key) { intactas.push({ id: doc.id, nombre, motivo: 'no está en el plan' }); continue; }
  if (!catalogo.has(key)) { intactas.push({ id: doc.id, nombre, motivo: `«${key}» no está en el catálogo` }); continue; }
  if (unit.subdomainKey === key) { intactas.push({ id: doc.id, nombre, motivo: `ya engancha a «${key}»` }); continue; }
  acciones.push({ id: doc.id, nombre, key, antes: unit.subdomainKey ?? null });
}

console.log(`\n[${target}] enganches (${acciones.length}):`);
for (const a of acciones) {
  const antes = a.antes ? ` (antes «${a.antes}»)` : '';
  console.log(`  «${a.nombre}» → ${a.key}${antes} · ${a.id}`);
}
console.log(`\n[${target}] se dejan intactas (${intactas.length}):`);
for (const i of intactas) console.log(`  «${i.nombre}» · ${i.motivo} · ${i.id}`);

if (!apply) {
  console.log('\nDry-run: no se ha escrito nada. Repite con --apply.');
  process.exit(0);
}

for (const a of acciones) {
  await db.collection('leanTeams').doc(a.id).set({ subdomainKey: a.key }, { merge: true });
  console.log(`  ✓ «${a.nombre}» → ${a.key}`);
}
console.log(`\n✓ ${acciones.length} equipo(s) enganchado(s). Nada más se ha tocado.`);
