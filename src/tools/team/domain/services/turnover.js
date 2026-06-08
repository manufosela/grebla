/**
 * Rotación del equipo (función pura, sin IO). Dadas las personas (con fecha de
 * alta `startDate` y, si causaron baja, `deactivatedAt`) y un periodo [from, to],
 * calcula altas, bajas y la tasa de rotación = bajas / plantilla media.
 *
 * Es un agregado de equipo (R6) y NO compara ni ordena personas (R3): solo
 * conteos y una tasa. Las fechas se comparan numéricamente (acepta 'YYYY-MM-DD'
 * o ISO completo).
 *
 * @typedef {import('../types.js').Person} Person
 */

/** @param {string} d @returns {number} */
const ms = (d) => new Date(d).getTime();

/**
 * @param {Person[]} people  Todas las personas (activas e inactivas).
 * @param {{ from: string|number|Date, to: string|number|Date }} period
 * @returns {{
 *   from: string, to: string,
 *   headcountStart: number, headcountEnd: number, avgHeadcount: number,
 *   hires: number, departures: number, turnoverRate: number
 * }}
 */
export function turnover(people, period) {
  const list = Array.isArray(people) ? people : [];
  const fromMs = new Date(period.from).getTime();
  const toMs = new Date(period.to).getTime();

  // Plantilla activa en un instante t: ya había entrado y aún no había salido.
  const headcountAt = (t) =>
    list.filter((p) => ms(p.startDate) <= t && (!p.deactivatedAt || ms(p.deactivatedAt) > t)).length;

  const inRange = (t) => t >= fromMs && t <= toMs;

  const hires = list.filter((p) => p.startDate && inRange(ms(p.startDate))).length;
  const departures = list.filter((p) => p.deactivatedAt && inRange(ms(p.deactivatedAt))).length;

  const headcountStart = headcountAt(fromMs);
  const headcountEnd = headcountAt(toMs);
  const avgHeadcount = (headcountStart + headcountEnd) / 2;
  const turnoverRate = avgHeadcount > 0 ? (departures / avgHeadcount) * 100 : 0;

  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    headcountStart,
    headcountEnd,
    avgHeadcount,
    hires,
    departures,
    turnoverRate,
  };
}
