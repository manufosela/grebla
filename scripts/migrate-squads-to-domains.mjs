/**
 * Migra el catálogo de SQUADS a DOMINIOS y SUBDOMINIOS
 * (ADR «De squads a dominios y subdominios», RMR-TSK-0476).
 *
 * Los seis squads actuales ya eran los dos niveles mezclados en uno: cuatro son
 * subdominios de un producto mayor y dos son ese nivel mayor. Aquí se colocan
 * donde les toca y se les asigna su `key`, que a partir de ahora es la clave del
 * contrato con el portal.
 *
 * Reglas que cumple:
 *  - CONSERVA los ids de Firestore. Las referencias que ya existen (personas,
 *    retros, repos de DORA) siguen apuntando a lo mismo.
 *  - Todo dominio acaba con AL MENOS un subdominio: los que no se han dividido
 *    reciben su «Core», con key `{dominio}-core` para que no colisionen entre sí.
 *  - NO borra `/squads`. El concepto se mantiene mientras dure la transición —
 *    decisión explícita del usuario, para poder volver atrás.
 *
 * SEGURO: dry-run por defecto e idempotente (relanzarlo no duplica nada).
 *
 * Uso:
 *   node scripts/migrate-squads-to-domains.mjs --target=tribbu            (dry-run)
 *   node scripts/migrate-squads-to-domains.mjs --target=tribbu --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';
import { coreKeyFor, CORE_NAME } from '../src/tools/team/domain/domains.js';

const target = (process.argv.find((a) => a.startsWith('--target=')) || '').split('=')[1] || 'app';
const apply = process.argv.includes('--apply');

/**
 * Dónde va cada squad y con qué clave. Se escribe a mano y no se deriva del
 * nombre: es una decisión de modelo, no una transformación de texto — y derivar
 * claves de nombres es justo el bug que este ADR corrige.
 * @type {Record<string, { key: string, level: 'domain'|'subdomain', domainKey?: string }>}
 */
const PLAN = {
  CAES: { key: 'caes', level: 'subdomain', domainKey: 'tribbu-app' },
  Trust: { key: 'trust', level: 'subdomain', domainKey: 'tribbu-app' },
  Core: { key: 'tribbu-app-core', level: 'subdomain', domainKey: 'tribbu-app' },
  Matcher: { key: 'matcher', level: 'subdomain', domainKey: 'tribbu-app' },
  Plataforma: { key: 'plataforma', level: 'domain' },
  'Internal Products': { key: 'internal-products', level: 'domain' },
};

/** Dominios que no salen de ningún squad y hay que crear. */
const NUEVOS_DOMINIOS = [{ key: 'tribbu-app', name: 'TRIBBU-APP' }];

initializeApp({ credential: cert(serviceAccountPath(target)) });
const db = getFirestore();

const squads = await db.collection('squads').get();
if (squads.empty) {
  console.log(`[${target}] no hay squads: nada que migrar.`);
  process.exit(0);
}

const sinPlan = squads.docs.filter((d) => !PLAN[d.data().name]);
if (sinPlan.length) {
  // No se inventa dónde va: un squad fuera del plan es una decisión pendiente.
  console.log(`[${target}] ⚠ squads SIN plan (${sinPlan.length}), no se migran:`);
  for (const d of sinPlan) console.log(`      "${d.data().name}" (${d.id})`);
}

const acciones = [];
for (const { key, name } of NUEVOS_DOMINIOS) {
  const ya = await db.collection('domains').where('key', '==', key).get();
  if (ya.empty) acciones.push({ tipo: 'dominio nuevo', level: 'domain', key, name, id: null });
}
for (const d of squads.docs) {
  const plan = PLAN[d.data().name];
  if (!plan) continue;
  acciones.push({
    tipo: plan.level === 'domain' ? 'squad → dominio' : 'squad → subdominio',
    level: plan.level,
    key: plan.key, name: d.data().name, id: d.id, domainKey: plan.domainKey,
  });
}
// Los dominios sin subdominio reciben su «Core».
const clavesDominio = [...NUEVOS_DOMINIOS.map((d) => d.key),
  ...Object.values(PLAN).filter((p) => p.level === 'domain').map((p) => p.key)];
const conHijos = new Set(Object.values(PLAN).filter((p) => p.domainKey).map((p) => p.domainKey));
for (const domainKey of clavesDominio.filter((k) => !conHijos.has(k))) {
  acciones.push({
    tipo: 'Core del dominio', level: 'subdomain',
    key: coreKeyFor(domainKey), name: CORE_NAME, id: null, domainKey,
  });
}

console.log(`\n[${target}] plan de migración (${acciones.length} acciones):`);
for (const a of acciones) {
  const donde = a.domainKey ? ` · dentro de ${a.domainKey}` : '';
  const id = a.id ? ` · id conservado ${a.id}` : ' · id nuevo';
  console.log(`  ${a.tipo}: "${a.name}" → key «${a.key}»${donde}${id}`);
}

if (!apply) {
  console.log('\nDry-run: no se ha escrito nada. Repite con --apply.');
  process.exit(0);
}

for (const a of acciones) {
  // El nivel viene del PLAN, no de leer el rótulo de la acción: «squad →
  // subdominio» termina en «dominio», y una comprobación por texto metió una vez
  // todas las entidades en /domains. El dato manda sobre la cadena.
  const esDominio = a.level === 'domain';
  const col = esDominio ? 'domains' : 'subdomains';
  const otra = esDominio ? 'subdomains' : 'domains';
  const data = esDominio ? { key: a.key, name: a.name } : { key: a.key, name: a.name, domainKey: a.domainKey };

  // Repara lo mal colocado: si esta entidad está en la colección contraria, se
  // retira de ahí. Así relanzarlo arregla una migración a medias en vez de
  // dejar dos copias con la misma clave.
  const mal = await db.collection(otra).where('key', '==', a.key).get();
  for (const d of mal.docs) {
    await d.ref.delete();
    console.log(`  ↩ ${a.key}: retirado de /${otra}`);
  }

  // Y retira los que lleven esta MISMA clave con OTRO id en la colección buena:
  // un intento anterior pudo dejarla con id nuevo, y escribir sin mirar dejaría
  // dos entidades con la misma clave — que es lo único que este modelo no puede
  // permitirse, porque la clave es la identidad.
  const mismos = await db.collection(col).where('key', '==', a.key).get();
  const sobrantes = mismos.docs.filter((d) => d.id !== a.id);
  for (const d of sobrantes.slice(a.id ? 0 : 1)) {
    await d.ref.delete();
    console.log(`  ↩ ${a.key}: retirado duplicado (id ${d.id})`);
  }

  if (a.id) await db.collection(col).doc(a.id).set(data, { merge: true });
  else if (mismos.empty) await db.collection(col).add(data);
  console.log(`  ✓ ${a.key} → /${col}`);
}
console.log('\n✓ Migración aplicada. /squads NO se ha tocado: el concepto sigue vivo durante la transición.');
