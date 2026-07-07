/**
 * Seed del contenido inicial de la herramienta O2O (Admin SDK): la guía por
 * defecto (/o2oGuides/o2o-default) y el formulario previo (/o2oForms/preo2o-default).
 * Idempotente: no toca los docs que ya existan salvo con --force.
 *
 * Uso:  node scripts/seed-o2o.mjs           (crea los que falten)
 *       node scripts/seed-o2o.mjs --force   (sobreescribe)
 * Usa la service account *firebase-adminsdk*.json de la raíz.
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_GUIDE, DEFAULT_FORM } from '../src/tools/o2o/data/index.js';

const force = process.argv.includes('--force');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyFile = readdirSync(root).find((f) => /firebase-adminsdk.*\.json$/.test(f));
if (!keyFile) {
  console.error('✗ No se encontró la service account (*firebase-adminsdk*.json) en la raíz.');
  process.exit(1);
}

initializeApp({ credential: cert(join(root, keyFile)) });
const db = getFirestore();

/** @param {string} path @param {object} data */
async function seedDoc(path, data) {
  const ref = db.doc(path);
  if (!force && (await ref.get()).exists) {
    console.log(`• /${path} ya existe: no se toca (usa --force para sobreescribir)`);
    return;
  }
  await ref.set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log(`✓ /${path} sembrado`);
}

await seedDoc(`o2oGuides/${DEFAULT_GUIDE.id}`, DEFAULT_GUIDE);
await seedDoc(`o2oForms/${DEFAULT_FORM.id}`, DEFAULT_FORM);
console.log('\nHecho.');
process.exit(0);
