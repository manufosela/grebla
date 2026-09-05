/**
 * Migra los documentos VIVOS del portal a la clave del subdominio
 * (ADR «De squads a dominios y subdominios», F3 · RMR-TSK-0478).
 *
 * Hasta ahora el puente publicaba en `metrics_lean/{slug(nombre)}`. Con el
 * contrato nuevo publica en `metrics_lean/{key del subdominio}` y cada documento
 * lleva `subdomain` y `domain` explícitos. Este script deja lo ya publicado en
 * su sitio nuevo SIN perder la serie histórica:
 *
 *   caes             → se queda donde está, y recibe los campos nuevos
 *   trust            → igual
 *   internal-products → se MUEVE a internal-products-core
 *   the-mario-netas   → se MUEVE a tribbu-app-core
 *
 * COPIA, no mueve: el id antiguo se queda vivo mientras el portal migra, porque
 * su informe de Slack lo busca por ahí y borrarlo dejaría el mensaje semanal sin
 * esa entidad. La copia se verifica por contenido, y el origen queda marcado con
 * `legacy: true` y `supersededBy` para que el portal pueda filtrarlo y no contar
 * dos veces lo mismo.
 *
 * El borrado de los antiguos es una tarea APARTE y explícita, cuando la sesión
 * del portal confirme que lee por key.
 *
 * NO SE TOCA nada que no esté en el plan. En `metrics_dora` hay documentos
 * sembrados por el propio portal (llevan campo `source`): no son nuestros.
 *
 * Escribe en la base del PORTAL, que es de otro sistema: dry-run por defecto.
 *
 * Uso:
 *   node scripts/migrate-portal-metrics-keys.mjs            (dry-run)
 *   node scripts/migrate-portal-metrics-keys.mjs --apply
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serviceAccountPath } from './lib/service-account.mjs';

const apply = process.argv.includes('--apply');
const COLLECTION = 'metrics_lean';

/**
 * Qué hacer con cada documento ya publicado. Escrito a mano: es el mapeo que
 * fija el ADR, no algo derivable del nombre.
 * @type {Array<{ from: string, to: string, domain: string }>}
 */
const PLAN = [
  { from: 'caes', to: 'caes', domain: 'tribbu-app' },
  { from: 'trust', to: 'trust', domain: 'tribbu-app' },
  { from: 'internal-products', to: 'internal-products-core', domain: 'internal-products' },
  { from: 'the-mario-netas', to: 'tribbu-app-core', domain: 'tribbu-app' },
];

initializeApp({ credential: cert(serviceAccountPath('portal')) });
const db = getFirestore();

const col = db.collection(COLLECTION);
const acciones = [];
for (const paso of PLAN) {
  const origen = await col.doc(paso.from).get();
  if (!origen.exists) { console.log(`  · ${paso.from}: no existe, nada que migrar`); continue; }
  const datos = origen.data();
  if (datos.source) {
    // Sembrado por el portal, no por nuestro cron: no es nuestro.
    console.log(`  · ${paso.from}: lo sembró el portal (source=${datos.source}), NO se toca`);
    continue;
  }
  acciones.push({ ...paso, datos, mueve: paso.from !== paso.to });
}

console.log(`\nplan (${acciones.length} documento(s) de /${COLLECTION}):`);
for (const a of acciones) {
  const serie = (a.datos.series ?? []).length;
  console.log(a.mueve
    ? `  ${a.from} → ${a.to} · COPIA ${serie} punto(s) · domain=${a.domain} · el origen queda marcado legacy`
    : `  ${a.from} · se queda · ${serie} punto(s) · añade subdomain/domain=${a.domain}`);
}

if (!apply) {
  console.log('\nDry-run: no se ha escrito nada en el portal. Repite con --apply.');
  process.exit(0);
}

for (const a of acciones) {
  const nombre = a.datos.name ?? a.datos.squad ?? a.to;
  await col.doc(a.to).set({ ...a.datos, squad: a.to, subdomain: a.to, domain: a.domain, name: nombre });

  if (!a.mueve) { console.log(`  ✓ ${a.to}: campos nuevos`); continue; }

  // Se comprueba POR CONTENIDO que la copia llegó entera. Que el set no lanzara
  // no dice nada sobre lo que hay realmente en el destino.
  const copiado = (await col.doc(a.to).get()).data();
  const puntos = (copiado?.series ?? []).map((p) => p.periodStart).join(',');
  const esperados = (a.datos.series ?? []).map((p) => p.periodStart).join(',');
  if (puntos !== esperados || copiado?.domain !== a.domain) {
    console.error(`  ✗ ${a.from} → ${a.to}: la copia NO coincide. El origen se deja como estaba.`);
    continue;
  }

  // El origen NO se borra: el informe de Slack del portal lo busca por su id.
  // Se marca para que sepan que está duplicado y cuál es su clave nueva.
  await col.doc(a.from).set({ ...a.datos, legacy: true, supersededBy: a.to, name: nombre }, { merge: true });
  console.log(`  ✓ ${a.from} → ${a.to}: serie completa (${(a.datos.series ?? []).length} puntos); origen marcado legacy`);
}
console.log('\n✓ Migración aplicada. Los ids antiguos siguen vivos y marcados: bórralos cuando el portal confirme que lee por key.');
