/**
 * Formateo legible de duraciones DORA (lead time, MTTR, downtime). Convierte una
 * cantidad de horas en una etiqueta compacta: horas hasta 1 día, días a partir de
 * ahí. Redondea a 1 decimal. Devuelve null para valores no medibles (el llamador
 * decide el texto de "sin datos"), sin fallbacks silenciosos a "0".
 */
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {number|null|undefined} hours
 * @returns {string|null}  "Xh" (< 24 h), "Xd" (>= 24 h) o null si no es medible.
 */
export function formatHours(hours) {
  if (hours == null || !Number.isFinite(hours)) return null;
  if (hours < 24) return `${round1(hours)} h`;
  return `${round1(hours / 24)} d`;
}
