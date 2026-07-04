/**
 * Siembra el ÍNDICE del archipiélago del Mapa de Carrera (MC-14, progresión
 * MC-20): crea /careerMap/_archipelago con las 13 islas del ADR si NO existe
 * todavía. Si YA existe, desde MC-20 lo único que hace es RELLENAR los campos
 * de progresión que falten en cada isla — `citizenshipPct` (el % objetivo de
 * la ciudadanía, con los valores del ADR/semilla) y `citiesTotal` (0 hasta que
 * seed-islands lo escriba) — sin tocar nombres, posiciones ni islas añadidas a
 * mano (las ediciones del superadmin mandan). La isla actual /careerMap/island
 * queda registrada en el índice como la isla de inicio «Bases de software» —
 * este script NO modifica ese documento ni ningún otro de la colección; los
 * docs de las islas nuevas llegarán con su contenido (MC-16) o desde el botón
 * «Nueva isla» del panel /admin. Usa la service account *firebase-adminsdk*.json.
 *
 * Uso: pnpm seed:archipelago
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { seedArchipelago, serializeArchipelago, normalizeArchipelago } from '../src/tools/career/data/archipelago.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) {
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz.');
  process.exit(1);
}

initializeApp({ credential: cert(join(root, keyFile)) });
const db = getFirestore();

const ref = db.doc('careerMap/_archipelago');
const snap = await ref.get();

if (snap.exists) {
  // MC-20: backfill de citizenshipPct/citiesTotal en índices anteriores. La
  // normalización rellena los campos que faltan (pct de la semilla/ADR por id,
  // citiesTotal 0 hasta que seed-islands lo escriba) SIN tocar lo demás; solo
  // se escribe si de verdad cambió algo.
  const raw = snap.data();
  const backfilled = serializeArchipelago(normalizeArchipelago(raw));
  const missing = (Array.isArray(raw.islands) ? raw.islands : []).filter(
    (i) => !Number.isFinite(Number(i?.citizenshipPct)) || !Number.isFinite(Number(i?.citiesTotal)),
  ).length;
  if (missing === 0) {
    console.log(
      `✓ /careerMap/_archipelago ya existe (${backfilled.islands.length} islas) con los campos de progresión: no se toca nada.`,
    );
    process.exit(0);
  }
  await ref.set({ ...backfilled, updatedAt: FieldValue.serverTimestamp() });
  console.log(
    `✓ /careerMap/_archipelago actualizado: rellenados citizenshipPct/citiesTotal en ${missing} isla(s) (el resto, intacto).`,
  );
  process.exit(0);
}

const arch = serializeArchipelago(seedArchipelago());
await ref.set({ ...arch, updatedAt: FieldValue.serverTimestamp() });

const start = arch.islands.find((i) => i.startIsland)?.name ?? '(sin isla de inicio)';
console.log(
  `✓ Sembrado /careerMap/_archipelago con ${arch.islands.length} islas. Isla de inicio: «${start}» (doc /careerMap/island intacto).`,
);
process.exit(0);
