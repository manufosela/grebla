/**
 * Rutas de los documentos para la Cloud Function — espejo puro de
 * src/tools/docs/domain/paths.js (RMR-TSK-0503).
 *
 * Vive aquí, dentro de functions/, porque el paquete de Cloud Functions se
 * despliega solo y no puede importar de ../src. Es el mismo motivo por el que
 * marea tiene functions/pulseAggregate.js.
 *
 * La copia física es inevitable; que diverja, NO: aquí divergir significa que el
 * cliente dice que el documento queda en un sitio y el servidor lo escribe en
 * otro, o —peor— que el saneado del servidor sea más flojo que el del cliente y
 * deje salir una ruta de `docs/`. functions/docsPaths.test.js ejecuta las dos
 * sobre los mismos valores y exige el mismo resultado.
 */

/** Raíz de los documentos en Storage. */
export const DOCS_ROOT = 'docs';

const FOLDER_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** @param {unknown} value @returns {string} */
export function sanitizeFolder(value) {
  const limpio = String(value ?? '').trim().toLowerCase();
  return FOLDER_RE.test(limpio) ? limpio : '';
}

/** @param {unknown} value @returns {string} */
export function sanitizeFileName(value) {
  const base = String(value ?? '').split(/[\\/]/).pop() ?? '';
  const sinExt = base.replace(/\.html?$/i, '');
  const slug = sinExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 60);
  return slug ? `${slug}.html` : '';
}

/** @param {{ folder?: string, fileName?: string }} doc @returns {string} */
export function storagePathOf(doc = {}) {
  const file = sanitizeFileName(doc.fileName);
  if (!file) return '';
  const folder = sanitizeFolder(doc.folder);
  return folder ? `${DOCS_ROOT}/${folder}/${file}` : `${DOCS_ROOT}/${file}`;
}
