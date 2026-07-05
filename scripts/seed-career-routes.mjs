/**
 * Siembra las RUTAS DE ROL Y NIVEL del Modo Reto (JG-14): escribe
 * /careerRoutes/{disciplina}--{hito} a partir de src/tools/career/data/routes/
 * (registro CAREER_ROUTES), ruta a ruta e IDEMPOTENTE:
 *
 *  - Si el doc NO existe, se crea con el contenido en código.
 *  - Si el doc YA existe, NO se toca (las ediciones del superadmin desde el
 *    editor de juego mandan; ADR JG-14: tras el seed inicial la fuente de
 *    verdad es Firestore)… salvo que se pase --force, que REEMPLAZA el doc
 *    entero con el contenido en código y pisa cualquier edición manual.
 *
 * Cada doc lleva los campos del ADR: {discipline, levelKey, name, description,
 * stops, active} más updatedAt (server timestamp). routes.test.js valida el
 * contenido en código ANTES de llegar aquí (paradas existentes, orden por
 * prereqs, tamaños, hitos crecientes). Usa la service account
 * *firebase-adminsdk*.json de la raíz.
 *
 * Uso:
 *   pnpm seed:career-routes                       # todas las rutas en código
 *   pnpm seed:career-routes --route <routeId>     # una (ej. backend-php--veteranus)
 *   …añadir --force para reemplazar docs existentes.
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { routeDocs } from '../src/tools/career/data/routes/index.js';

const { values } = parseArgs({
  options: {
    route: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
});

const available = routeDocs();

const targets = values.route
  ? available.filter((d) => d.routeId === values.route)
  : available;
if (targets.length === 0) {
  console.error(`✗ Sin contenido en código para la ruta "${values.route}".`);
  console.error(`  Rutas disponibles: ${available.map((d) => d.routeId).join(', ')}`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) {
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz.');
  process.exit(1);
}

initializeApp({ credential: cert(join(root, keyFile)) });
const db = getFirestore();

let written = 0;
let skipped = 0;

for (const { routeId, data } of targets) {
  const ref = db.doc(`careerRoutes/${routeId}`);
  const snap = await ref.get();

  if (snap.exists && !values.force) {
    console.log(`• /careerRoutes/${routeId} ya existe: no se toca (usa --force para reemplazarlo).`);
    skipped += 1;
    continue;
  }

  if (snap.exists) {
    console.warn(`⚠ /careerRoutes/${routeId} EXISTE y --force está activo: se REEMPLAZA el doc entero.`);
    console.warn('  Se pierden las ediciones del superadmin sobre esta ruta.');
  }

  await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() });
  console.log(`✓ Sembrado /careerRoutes/${routeId} — «${data.name}»: ${data.stops.length} paradas.`);
  written += 1;
}

console.log(`Hecho: ${written} ruta(s) sembrada(s), ${skipped} respetada(s) por existir.`);
process.exit(0);
