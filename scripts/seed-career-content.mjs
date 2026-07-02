/**
 * Carga la matriz de expectativas y los addendums del documento de carrera de
 * TRIBBU en el doc /careerFramework/engineering, y añade el nivel Tech Lead (L3)
 * si falta. NO pisa el resto del framework (tracks, disciplinas, dimensiones ni
 * las ediciones de niveles ya hechas): solo actualiza levels (append de l3tl),
 * expectations y addendums. Usa la service account *firebase-adminsdk*.json.
 *
 * Uso: pnpm seed:career-content
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ENGINEERING_FRAMEWORK } from '../src/tools/career/data/framework.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) {
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz.');
  process.exit(1);
}

initializeApp({ credential: cert(join(root, keyFile)) });
const db = getFirestore();

const ref = db.doc('careerFramework/engineering');
const snap = await ref.get();

if (!snap.exists) {
  // No existe: siembra el framework completo del documento.
  await ref.set(ENGINEERING_FRAMEWORK);
  console.log('✓ /careerFramework/engineering no existía: sembrado el framework completo.');
  process.exit(0);
}

const current = snap.data();
const levels = Array.isArray(current.levels) && current.levels.length
  ? [...current.levels]
  : [...ENGINEERING_FRAMEWORK.levels];

// Añade el nivel Tech Lead (l3tl) si no está ya.
if (!levels.some((l) => l.id === 'l3tl')) {
  const l3tl = ENGINEERING_FRAMEWORK.levels.find((l) => l.id === 'l3tl');
  if (l3tl) levels.push(l3tl);
}

await ref.set(
  {
    levels,
    expectations: ENGINEERING_FRAMEWORK.expectations,
    addendums: ENGINEERING_FRAMEWORK.addendums,
  },
  { merge: true },
);

console.log(
  `✓ Cargado: ${levels.length} niveles, ${ENGINEERING_FRAMEWORK.expectations.length} expectativas, ${ENGINEERING_FRAMEWORK.addendums.length} addendums. Tracks/disciplinas/dimensiones intactos.`,
);
process.exit(0);
