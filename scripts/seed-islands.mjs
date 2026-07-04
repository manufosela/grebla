/**
 * Siembra el CONTENIDO curado de las islas del archipiélago (MC-16): escribe
 * /careerMap/{islandId} a partir de src/tools/career/data/islands/ (registro
 * ISLAND_CONTENT), isla a isla e IDEMPOTENTE:
 *
 *  - Si el doc NO existe, se crea con el contenido en código.
 *  - Si el doc YA existe, NO se toca (las ediciones del superadmin desde
 *    /admin mandan)… salvo que se pase --force, que REEMPLAZA el doc entero
 *    con el contenido en código. En la isla de inicio ('island') esto pisa la
 *    semilla antigua (ids de ciudad sin prefijo) por el contenido nuevo MC-16
 *    — cualquier edición manual previa se pierde y los journeys que apuntaban
 *    a los ids antiguos dejan de casar. Úsalo sabiendo lo que haces.
 *
 * El contenido se escribe pasado por serializeCareerMap (mismo saneo que el
 * panel de admin: sin undefined, recursos válidos, Firestore-safe).
 *
 * Progresión (MC-20): tras procesar cada isla se actualiza su entrada del
 * ÍNDICE /careerMap/_archipelago — `citiesTotal` con el nº de ciudades NO
 * deprecadas del doc que quedó en Firestore (el sembrado, o el existente si
 * se respetó) y `citizenshipPct` solo si faltaba (valor de la semilla/ADR).
 * El índice se lee una vez y se escribe una vez al final, solo si cambió; si
 * no existe, se crea desde la semilla con las islas procesadas al día.
 * Usa la service account *firebase-adminsdk*.json de la raíz.
 *
 * Uso:
 *   pnpm seed:islands --island <id>   # una isla (id del doc, ej. island)
 *   pnpm seed:islands --all           # todas las islas con contenido en código
 *   …añadir --force para reemplazar docs existentes.
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ISLAND_CONTENT } from '../src/tools/career/data/islands/index.js';
import { serializeCareerMap, normalizeCareerMap } from '../src/tools/career/data/maps.js';
import { seedArchipelago, serializeArchipelago, normalizeArchipelago } from '../src/tools/career/data/archipelago.js';

const { values } = parseArgs({
  options: {
    island: { type: 'string' },
    all: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

const available = Object.keys(ISLAND_CONTENT);

if (Boolean(values.island) === values.all) {
  console.error('✗ Indica exactamente una de las dos opciones: --island <id> o --all.');
  console.error(`  Islas con contenido en código: ${available.join(', ')}`);
  process.exit(1);
}

const targetIds = values.all ? available : [values.island];
const unknown = targetIds.filter((id) => !ISLAND_CONTENT[id]);
if (unknown.length) {
  console.error(`✗ Sin contenido en código para: ${unknown.join(', ')}.`);
  console.error(`  Islas disponibles: ${available.join(', ')}`);
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

// Índice del archipiélago (MC-20): se lee UNA vez, se van apuntando los
// totales de las islas procesadas y se escribe al final solo si cambió.
const archRef = db.doc('careerMap/_archipelago');
const archSnap = await archRef.get();
const archipelago = archSnap.exists
  ? normalizeArchipelago(archSnap.data())
  : seedArchipelago();
let archDirty = !archSnap.exists;

/**
 * Actualiza en el índice la entrada de una isla procesada: `citiesTotal` con
 * las ciudades NO deprecadas del doc que quedó en Firestore y, si faltaba en
 * el doc original (la normalización ya lo rellenó), `citizenshipPct` queda
 * persistido con el valor de la semilla. Isla fuera del índice: aviso.
 * @param {string} islandId
 * @param {Record<string, unknown>} docData Doc de la isla tal y como queda en Firestore.
 */
function trackIslandTotal(islandId, docData) {
  const entry = archipelago.islands.find((i) => i.id === islandId);
  if (!entry) {
    console.warn(`⚠ La isla ${islandId} no está en el índice del archipiélago: su citiesTotal no se registra.`);
    return;
  }
  const total = normalizeCareerMap(docData, islandId).cities.filter((c) => !c.deprecated).length;
  if (entry.citiesTotal !== total) {
    entry.citiesTotal = total;
    archDirty = true;
  }
}

for (const islandId of targetIds) {
  const map = ISLAND_CONTENT[islandId];
  const ref = db.doc(`careerMap/${islandId}`);
  const snap = await ref.get();

  if (snap.exists && !values.force) {
    console.log(`• /careerMap/${islandId} ya existe: no se toca (usa --force para reemplazarlo).`);
    trackIslandTotal(islandId, snap.data()); // el índice refleja el doc REAL
    skipped += 1;
    continue;
  }

  if (snap.exists) {
    console.warn(`⚠ /careerMap/${islandId} EXISTE y --force está activo: se REEMPLAZA el doc entero.`);
    console.warn('  Se pierden las ediciones del superadmin sobre esta isla.');
    if (islandId === 'island') {
      console.warn('  Además es la isla de inicio: la semilla antigua (ids git, js…) se sustituye por');
      console.warn('  el contenido MC-16 (ids bases/…); los journeys con ids antiguos dejarán de casar.');
    }
  }

  const doc = serializeCareerMap(map);
  await ref.set({ ...doc, updatedAt: FieldValue.serverTimestamp() });
  console.log(
    `✓ Sembrado /careerMap/${islandId} — «${doc.name}»: ${doc.areas.length} comarcas, ${doc.cities.length} ciudades.`,
  );
  trackIslandTotal(islandId, doc);
  written += 1;
}

if (archDirty) {
  await archRef.set({ ...serializeArchipelago(archipelago), updatedAt: FieldValue.serverTimestamp() });
  console.log(
    `✓ Índice /careerMap/_archipelago ${archSnap.exists ? 'actualizado' : 'creado'}: citiesTotal/citizenshipPct al día (MC-20).`,
  );
} else {
  console.log('• Índice /careerMap/_archipelago ya al día: no se toca.');
}

console.log(`Hecho: ${written} isla(s) sembrada(s), ${skipped} respetada(s) por existir.`);
process.exit(0);
