/**
 * Dónde vive cada documento de la organización (RMR-PCS-0041).
 *
 * Los documentos son HTML ya hechos —presentaciones, sobre todo— que se guardan
 * en Storage bajo `docs/`. La ruta se construye AQUÍ, con un nombre saneado y
 * una carpeta validada, porque una ruta es un permiso: las reglas de Storage
 * protegen `docs/**`, así que todo lo que se salga de ahí se queda sin
 * protección o pisa lo que no debe.
 *
 * La estructura es de un solo nivel de carpetas a propósito: GREBLA en la raíz,
 * el plan de Tecnología en «Tech». Un árbol con profundidad libre se convierte
 * en un gestor de ficheros, y lo que hace falta es encontrar cuatro documentos.
 */

/** Raíz de los documentos en Storage. Todo cuelga de aquí, y las reglas de ahí. */
export const DOCS_ROOT = 'docs';

/** Nombre de carpeta admisible: letras, números, guiones. Sin barras ni puntos. */
const FOLDER_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Carpeta saneada, o '' para la raíz.
 *
 * Devuelve '' ante cualquier cosa que no sea una carpeta válida —incluidos
 * `..`, rutas con barra y nombres vacíos—: la alternativa sería inventarse una
 * carpeta o dejar escapar una ruta fuera de `docs/`.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeFolder(value) {
  const limpio = String(value ?? '').trim().toLowerCase();
  return FOLDER_RE.test(limpio) ? limpio : '';
}

/**
 * Nombre de fichero seguro a partir del que traiga el documento: sin rutas, sin
 * acentos y sin espacios. Se conserva la extensión .html.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeFileName(value) {
  const base = String(value ?? '').split(/[\\/]/).pop() ?? '';
  const sinExt = base.replace(/\.html?$/i, '');
  const slug = sinExt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 60);
  return slug ? `${slug}.html` : '';
}

/**
 * Ruta completa en Storage de un documento.
 * @param {{ folder?: string, fileName?: string }} doc
 * @returns {string} '' si el nombre no vale — sin nombre no hay documento
 */
export function storagePathOf(doc = {}) {
  const file = sanitizeFileName(doc.fileName);
  if (!file) return '';
  const folder = sanitizeFolder(doc.folder);
  return folder ? `${DOCS_ROOT}/${folder}/${file}` : `${DOCS_ROOT}/${file}`;
}

/**
 * Agrupa los documentos para pintarlos: primero los de la raíz, después cada
 * carpeta con los suyos, todo por nombre.
 *
 * Las carpetas salen de los propios documentos: una carpeta vacía no existe
 * —no hay nada que enseñar en ella—, y así no hay dos sitios que mantener.
 *
 * @param {ReadonlyArray<{ name?: string, folder?: string }>} docs
 * @returns {{ root: object[], folders: Array<{ name: string, docs: object[] }> }}
 */
export function groupByFolder(docs = []) {
  const porNombre = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es');
  const lista = [...(docs ?? [])];
  const root = lista.filter((d) => !sanitizeFolder(d.folder)).sort(porNombre);
  const carpetas = new Map();
  for (const doc of lista) {
    const folder = sanitizeFolder(doc.folder);
    if (!folder) continue;
    if (!carpetas.has(folder)) carpetas.set(folder, []);
    carpetas.get(folder).push(doc);
  }
  const folders = [...carpetas.entries()]
    .map(([name, docs]) => ({ name, docs: docs.sort(porNombre) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return { root, folders };
}

/** ¿Es un HTML? Es lo único que se publica por ahora, y se comprueba al subir. */
export function isHtmlFile(file) {
  const name = String(file?.name ?? '');
  const type = String(file?.type ?? '');
  return /\.html?$/i.test(name) || type === 'text/html';
}
