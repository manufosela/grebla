/**
 * Llamada al portal de métricas (RMR-TSK-0601).
 *
 * GREBLA dejó de calcular DORA y LEAN: las lee del portal, que es quien tiene
 * las fuentes. La llamada vive en una Cloud Function y no en el cliente porque
 * lleva un bearer: un token en el navegador es un token público.
 *
 * Este módulo NO interpreta las métricas —de eso va
 * `src/tools/metrics/domain/portalMetrics.js`—; solo trae la respuesta y
 * distingue por qué no pudo traerla. Esa distinción es el trabajo: «el portal
 * aún no ha calculado» y «el portal no me reconoce» se arreglan de formas
 * distintas, y una pantalla que solo sepa decir «error» obliga a ir a los logs.
 */

/** Por qué no se pudieron leer las métricas. Lista cerrada. */
export const PORTAL_ERRORS = Object.freeze({
  /** Falta configuración en esta instancia (URL o token). */
  noConfigurado: 'no-configurado',
  /** El portal no reconoce nuestra credencial: token mal puesto o rotado. */
  credencial: 'credencial',
  /** El portal está en pie pero aún no ha calculado nada. */
  sinCalcular: 'sin-calcular',
  /** El portal no respondió, o respondió algo que no es JSON. */
  caido: 'caido',
});

/** Cuánto se espera al portal antes de considerarlo caído. */
export const PORTAL_TIMEOUT_MS = 15_000;

/** Error con motivo, para que quien llame pueda decir QUÉ pasó y no solo que falló. */
export class PortalError extends Error {
  /** @param {string} reason @param {string} message */
  constructor(reason, message) {
    super(message);
    this.name = 'PortalError';
    this.reason = reason;
  }
}

/**
 * Trae las métricas del portal.
 *
 * El token no aparece en ningún mensaje de error a propósito: los errores acaban
 * en logs, y un log es un sitio donde un secreto se queda para siempre sin que
 * nadie se acuerde de que está ahí.
 *
 * @param {Object} params
 * @param {string} params.url     endpoint del portal
 * @param {string} params.token   bearer
 * @param {typeof fetch} [params.fetchImpl] inyectable para poder probarlo
 * @returns {Promise<Record<string, unknown>>} la respuesta cruda, sin interpretar
 */
export async function fetchPortalMetrics({ url, token, fetchImpl = fetch }) {
  if (!url || !token) {
    throw new PortalError(
      PORTAL_ERRORS.noConfigurado,
      'Esta instancia no tiene configurado el portal de métricas (falta la URL o el token).',
    );
  }

  let res;
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(PORTAL_TIMEOUT_MS),
    });
  } catch {
    // Sin detalle del error de red a propósito: puede traer la URL con el token
    // si alguien la construyó mal alguna vez.
    throw new PortalError(PORTAL_ERRORS.caido, 'El portal de métricas no respondió.');
  }

  if (res.status === 401 || res.status === 403) {
    throw new PortalError(
      PORTAL_ERRORS.credencial,
      'El portal no reconoce la credencial de GREBLA. ¿Se ha rotado el token?',
    );
  }
  if (res.status === 503) {
    throw new PortalError(
      PORTAL_ERRORS.sinCalcular,
      'El portal todavía no ha calculado las métricas.',
    );
  }
  if (!res.ok) {
    throw new PortalError(PORTAL_ERRORS.caido, `El portal respondió ${res.status}.`);
  }

  try {
    return await res.json();
  } catch {
    // Un 200 con cuerpo ilegible es el portal caído de otra forma. Devolver un
    // objeto vacío aquí sería justo el fallo silencioso que se quiere evitar: la
    // pantalla lo pintaría como «cero actividad».
    throw new PortalError(PORTAL_ERRORS.caido, 'El portal respondió algo que no es JSON.');
  }
}
