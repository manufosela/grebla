/**
 * Tokens de visionado de documentos (RMR-BUG-0124): lo puro de `openDoc` y
 * `serveDoc`, sin Firestore ni Storage, para poder probarlo a secas.
 *
 * Un token abre UN documento durante un rato y luego muere. Es lo que permite
 * servir la presentación desde otro origen (la URL de la función) sin dejar un
 * enlace permanente: la URL de descarga de Storage lleva un token que vale
 * para siempre y se reenvía; este caduca solo.
 */

/** Cuánto vive un token: lo que dura una reunión larga con la presentación abierta. */
export const DOC_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

/** 24 bytes aleatorios en hexadecimal. */
const TOKEN_RE = /^[a-f0-9]{48}$/;

/** @param {unknown} value */
export function isDocToken(value) {
  return TOKEN_RE.test(String(value ?? ''));
}

/**
 * Token de la ruta pedida: `/serveDoc/<token>/`, `/<token>/` o
 * `/<token>/index.html` (gen1 y gen2 recortan la ruta distinto). Cualquier
 * otra cosa —otro fichero, más niveles, un token mal formado— es '' y acaba en
 * 404: la función sirve el documento y nada más.
 * @param {unknown} pathname
 * @returns {string}
 */
export function tokenFromPath(pathname) {
  const parts = String(pathname ?? '').split('/').filter(Boolean);
  if (parts[0] === 'serveDoc') parts.shift();
  if (parts.length === 0 || parts.length > 2) return '';
  if (parts.length === 2 && parts[1] !== 'index.html') return '';
  return isDocToken(parts[0]) ? parts[0] : '';
}

/**
 * Nombre con el que se guarda el fichero al descargarlo (RMR-TSK-0546): el del
 * documento en Storage, dejando solo lo que es seguro escribir en una cabecera.
 * Una cabecera se compone concatenando, así que un nombre con comillas o salto
 * de línea podría colar otra: aquí no pasa de `documento.html`.
 * @param {unknown} storagePath  ruta en Storage (`docs/carpeta/fichero.html`)
 * @returns {string}
 */
export function downloadFileName(storagePath) {
  const bruto = String(storagePath ?? '').split('/').pop() ?? '';
  const limpio = bruto.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^[-.]+/, '').slice(0, 120);
  return limpio || 'documento.html';
}

/**
 * Cabeceras de DESCARGA: el mismo documento, pero el navegador lo guarda en vez
 * de abrirlo. Se sirve por la misma puerta y con el mismo token de un solo
 * documento y caducidad — no con una URL de Storage, que vale para siempre.
 * @param {unknown} storagePath
 */
export function downloadHeaders(storagePath) {
  return {
    ...viewerHeaders(),
    'Content-Disposition': `attachment; filename="${downloadFileName(storagePath)}"`,
  };
}

/**
 * Un registro de token sirve si no ha caducado y apunta a un documento (la
 * ruta sale de la ficha al crearlo, pero aquí se vuelve a exigir `docs/`: el
 * servidor no debe fiarse de lo que haya en la colección).
 * @param {{ path?: unknown, expiresAt?: unknown } | undefined} record
 * @param {number} nowMs
 */
export function tokenIsLive(record, nowMs) {
  const expiresAt = record?.expiresAt;
  return typeof expiresAt === 'number' && expiresAt > nowMs && String(record?.path ?? '').startsWith('docs/');
}

/** Cabeceras con las que se sirve el documento: HTML, sin caché, sin sniffing, sin referer. */
export function viewerHeaders() {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex',
  };
}
