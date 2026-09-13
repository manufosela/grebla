/**
 * Sube un documento HTML a la documentación de una instancia (RMR-PCS-0041).
 *
 * Es la puerta de servicio del gestor que ya existe en Administración: sirve
 * para el primer arranque —cuando aún no hay nada— y para subir algo desde el
 * disco sin pasar por el navegador.
 *
 * Escribe las DOS partes, igual que la aplicación: el fichero en Storage y sus
 * datos en Firestore. Solo una de las dos dejaría un documento invisible o una
 * entrada que no se puede abrir.
 *
 * Uso:
 *   node scripts/upload-doc.mjs --target=tribbu --file=./grebla.html \
 *     --name="GREBLA — marco de gestión" --description="..." [--folder=tech]
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { serviceAccountPath } from './lib/service-account.mjs';
import { storagePathOf } from '../src/tools/docs/domain/paths.js';

const arg = (name, fallback = '') => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const target = arg('target', 'app');
const file = arg('file');
const name = arg('name');
const description = arg('description');
const folder = arg('folder');

if (!file || !name) {
  console.error('Faltan argumentos: --file=<ruta.html> --name="<nombre visible>"');
  process.exit(1);
}

const path = storagePathOf({ folder, fileName: basename(file) });
if (!path) {
  console.error(`El nombre de fichero no da una ruta utilizable: ${file}`);
  process.exit(1);
}

const projectId = target === 'tribbu' ? 'grebla-tribbu' : 'grebla-app';
initializeApp({ credential: cert(serviceAccountPath(target)), storageBucket: `${projectId}.firebasestorage.app` });

const db = getFirestore();
const bucket = getStorage().bucket();

async function main() {
  console.log(`\n=== SUBIR DOCUMENTO · ${target} ===`);
  const html = readFileSync(file);
  await bucket.file(path).save(html, { contentType: 'text/html' });
  console.log(`  ✓ fichero en ${path} (${(html.length / 1024).toFixed(1)} kB)`);

  // Mismo id que la Cloud Function: `__` por cada carpeta, para que
  // `docs/a-b.html` y `docs/a/b.html` no acaben en la misma ficha.
  const id = path.replaceAll('/', '__').replaceAll(/[^a-zA-Z0-9_]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
  await db.collection('docs').doc(id).set({
    name, description, folder: folder || '', path, updatedAt: new Date(),
  }, { merge: true });
  console.log(`  ✓ ficha /docs/${id} → «${name}»${folder ? ` (carpeta ${folder})` : ''}`);
  console.log('=== hecho ===\n');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
