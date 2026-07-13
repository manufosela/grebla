/**
 * Lógica pura de rondas: una ronda está abierta si está activa y el momento cae
 * dentro de su ventana [startAt, endAt]. El cierre se deriva de las fechas (no
 * hace falta cron): pasada `endAt`, la ronda deja de estar abierta.
 *
 * @typedef {import('./types.js').Round} Round
 */

/** @param {string|Date|number} value @returns {number|null} */
function toMs(value) {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * ¿Está la ronda abierta en `now`? Requiere `active !== false` y now dentro de la
 * ventana. Fechas ausentes se tratan como sin límite por ese lado.
 * @param {Round} round
 * @param {Date|string|number} [now]
 * @returns {boolean}
 */
export function isRoundOpen(round, now = new Date()) {
  if (!round || round.active === false) return false;
  const t = toMs(now);
  if (t == null) return false;
  const start = toMs(round.startAt);
  const end = toMs(round.endAt);
  if (start != null && t < start) return false;
  if (end != null && t > end) return false;
  return true;
}

/**
 * Estado temporal de una ronda respecto a `now`: 'upcoming' (aún no empieza),
 * 'open' (en ventana) o 'closed' (terminada o desactivada).
 * @param {Round} round
 * @param {Date|string|number} [now]
 * @returns {'upcoming'|'open'|'closed'}
 */
export function roundStatus(round, now = new Date()) {
  if (!round) return 'closed';
  const t = toMs(now);
  const start = toMs(round.startAt);
  if (round.active !== false && start != null && t != null && t < start) return 'upcoming';
  return isRoundOpen(round, now) ? 'open' : 'closed';
}

/**
 * Ronda abierta más reciente de una lista (por `startAt` descendente), o null.
 * @param {Round[]} rounds
 * @param {Date|string|number} [now]
 * @returns {Round|null}
 */
export function pickOpenRound(rounds, now = new Date()) {
  const open = (rounds ?? []).filter((r) => isRoundOpen(r, now));
  if (open.length === 0) return null;
  return open.toSorted((a, b) => (toMs(b.startAt) ?? 0) - (toMs(a.startAt) ?? 0))[0];
}

/**
 * Ordena rondas cronológicamente por `startAt` ascendente (para comparativas/evolución).
 * @param {Round[]} rounds
 * @returns {Round[]}
 */
export function sortRoundsChronologically(rounds) {
  return (rounds ?? []).toSorted((a, b) => (toMs(a.startAt) ?? 0) - (toMs(b.startAt) ?? 0));
}

/**
 * Convierte un rango de días (`YYYY-MM-DD`) a la ventana ISO de la ronda: desde el
 * inicio del primer día hasta el final del último (inclusive).
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} endDate    YYYY-MM-DD
 * @returns {{ startAt: string, endAt: string }}
 */
export function dayWindowToIso(startDate, endDate) {
  return { startAt: `${startDate}T00:00:00.000Z`, endAt: `${endDate}T23:59:59.999Z` };
}
