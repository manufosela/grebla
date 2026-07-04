/**
 * Siembra el ÍNDICE del archipiélago del Mapa de Carrera (MC-14):
 * crea /careerMap/_archipelago con las 13 islas del ADR si NO existe todavía
 * (idempotente: si ya existe no toca nada). La isla actual /careerMap/island
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
import { seedArchipelago, serializeArchipelago } from '../src/tools/career/data/archipelago.js';

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
  const count = Array.isArray(snap.data().islands) ? snap.data().islands.length : 0;
  console.log(`✓ /careerMap/_archipelago ya existe (${count} islas): no se toca nada.`);
  process.exit(0);
}

const arch = serializeArchipelago(seedArchipelago());
await ref.set({ ...arch, updatedAt: FieldValue.serverTimestamp() });

const start = arch.islands.find((i) => i.startIsland)?.name ?? '(sin isla de inicio)';
console.log(
  `✓ Sembrado /careerMap/_archipelago con ${arch.islands.length} islas. Isla de inicio: «${start}» (doc /careerMap/island intacto).`,
);
process.exit(0);
