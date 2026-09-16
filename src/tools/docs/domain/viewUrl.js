/**
 * URL con la que el visor carga un documento (RMR-BUG-0124).
 *
 * El documento NO se pinta desde nuestro origen: lo sirve la Cloud Function
 * `serveDoc` con el suyo, y por eso las presentaciones reveal.js funcionan
 * enteras (vista del orador incluida) sin que sus scripts alcancen la sesión ni
 * los datos de GREBLA. Ver la cabecera de <docs-reader>.
 *
 * La URL lleva el token de visionado que devuelve `openDoc`: de un documento y
 * con caducidad. Aquí solo se construye; validar el token en el boundary evita
 * que una respuesta rara acabe pegada en una URL.
 */

/** Región de las Cloud Functions (la misma que `getRegionalFunctions`). */
export const DOC_VIEW_REGION = 'europe-west1';

const PROJECT_RE = /^[a-z][a-z0-9-]{4,29}$/;
const TOKEN_RE = /^[a-f0-9]{48}$/;

/**
 * @param {{ projectId: string, token: string, emulatorHost?: string }} args
 *   `emulatorHost` (solo en los E2E): host del emulador de functions.
 * @returns {string}
 */
export function docViewUrl({ projectId, token, emulatorHost = '' }) {
  if (!PROJECT_RE.test(String(projectId ?? ''))) throw new Error('Falta el proyecto Firebase del visor.');
  if (!TOKEN_RE.test(String(token ?? ''))) throw new Error('Token de visionado no válido.');
  return emulatorHost
    ? `http://${emulatorHost}:5001/${projectId}/${DOC_VIEW_REGION}/serveDoc/${token}/`
    : `https://${DOC_VIEW_REGION}-${projectId}.cloudfunctions.net/serveDoc/${token}/`;
}
