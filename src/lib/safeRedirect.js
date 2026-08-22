/**
 * Destino seguro tras el login (RMR-BUG-0097).
 *
 * `?redirect=` lo escribe quien manda el enlace, así que es entrada NO confiable:
 * pasarlo tal cual a `location.replace()` permitía ejecutar código en el origen
 * de GREBLA con `javascript:` (XSS con la sesión ya abierta) y sacar a la persona
 * del sitio con `//dominio-malo` justo después de autenticarse.
 *
 * Se resuelve contra un origen de referencia y solo se acepta lo que sigue
 * apuntando a ESE origen; así el saneado lo hace la normalización estándar de
 * URL (que ya se ocupa de `//`, de `/\`, de los esquemas y de los saltos de
 * línea) en vez de una lista de casos que se nos pueda quedar corta.
 * Función PURA: sin `location`, sin DOM.
 */

/** La home: destino cuando el valor recibido no es de fiar. */
export const HOME = '/';

/** Origen ficticio contra el que se resuelve: solo sirve para comparar. */
const REFERENCE = 'https://grebla.invalid';

/**
 * @param {unknown} target valor crudo del parámetro `redirect`
 * @returns {string} ruta interna segura a la que navegar
 */
export function safeRedirect(target) {
  if (typeof target !== 'string') return HOME;
  const value = target.trim();
  // Solo rutas absolutas del propio sitio: una relativa («tools/team») cambiaría
  // de significado según desde dónde se abra el login.
  if (!value.startsWith('/')) return HOME;
  let url;
  try {
    url = new URL(value, REFERENCE);
  } catch {
    return HOME;
  }
  // `//otro-dominio`, `https://…` y `javascript:` dejan de apuntar al origen.
  if (url.origin !== REFERENCE) return HOME;
  return `${url.pathname}${url.search}${url.hash}`;
}
