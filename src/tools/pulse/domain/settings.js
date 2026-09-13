/**
 * Ajustes administrables de Marea (RMR-TSK-0496).
 *
 * Solo hay uno, y es el que más pesa: el UMBRAL DE ANONIMATO, o cuánta gente
 * tiene que haber respondido para que un grupo enseñe su media. Estaba fijo a 3
 * dentro de la Cloud Function, así que subirlo exigía un despliegue.
 *
 * El 3 no es una preferencia: es la promesa de Marea, y por eso es un SUELO que
 * nadie puede cruzar. Por encima de él, quien gestiona la herramienta ajusta en
 * los dos sentidos: un equipo grande puede querer 5 —con 3 personas en un gremio
 * de treinta, quien las conoce ata cabos— y puede volver a 4 si se pasó. Lo que
 * no se puede es bajar a 2 y convertir el agregado en un señalamiento. El suelo
 * se valida aquí y se vuelve a validar en el servidor: un formulario no protege
 * nada.
 */

/** Suelo intocable: por debajo, el agregado deja de ser anónimo. */
export const MIN_ANON = 3;

/**
 * Techo: más allá, ningún grupo real llega al umbral y la herramienta no enseña
 * nada. Un número que no se puede alcanzar apaga Marea sin decirlo.
 */
export const MAX_ANON = 25;

/** Valor por defecto mientras nadie lo haya tocado. */
export const DEFAULT_ANON = MIN_ANON;

/**
 * Umbral utilizable a partir de lo que venga guardado (o tecleado): entero,
 * dentro de rango, y el defecto ante cualquier cosa que no sea un número.
 * @param {unknown} value
 * @returns {number}
 */
export function sanitizeMinCount(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_ANON;
  if (n < MIN_ANON) return MIN_ANON;
  return n > MAX_ANON ? MAX_ANON : n;
}

/**
 * ¿Se puede guardar tal cual lo tecleado? Se distingue de `sanitizeMinCount`
 * a propósito: al guardar hay que DECIR que 2 no vale, no corregirlo en silencio
 * y dejar a quien administra creyendo que guardó un 2.
 * @param {unknown} value
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateMinCount(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) return { ok: false, reason: 'El umbral es un número entero de personas.' };
  if (n < MIN_ANON) return { ok: false, reason: `El umbral no puede bajar de ${MIN_ANON}: es la promesa de anonimato de Marea.` };
  if (n > MAX_ANON) return { ok: false, reason: `Un umbral por encima de ${MAX_ANON} dejaría a todos los grupos sin resultados.` };
  return { ok: true };
}

/**
 * Pestaña con la que abrir Marea. El hub de administración enlaza a
 * `/marea#admin`, así que quien llega desde allí tiene que aterrizar en la
 * pestaña de administrar y no en el formulario de su propia marea.
 *
 * Quien no gestiona la herramienta cae en «Mi marea» aunque teclee el ancla: la
 * pestaña ni siquiera existe para ella.
 * @param {string} hash        location.hash, con o sin almohadilla
 * @param {boolean} canManage
 * @returns {'mine'|'admin'}
 */
export function initialTab(hash, canManage) {
  const limpio = String(hash ?? '').replace(/^#/, '');
  return canManage && limpio === 'admin' ? 'admin' : 'mine';
}
