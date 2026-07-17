/**
 * Dominio puro de la evolución personal de Marea (RMR-TSK-0241): agrupa los
 * registros de una persona por semana ISO, promedia cada dimensión y deriva la
 * tendencia (mejora / estable / empeora). Sin Firestore ni DOM, para testearlo
 * sin mocks. La privacidad la garantizan las reglas (cada uno lee lo suyo); aquí
 * solo hay cálculo.
 */
import { PULSE_DIMS } from './pulse.js';

/**
 * Agrupa entradas de marea por semana ISO y promedia cada dimensión. Devuelve las
 * semanas ordenadas de MÁS ANTIGUA a MÁS RECIENTE (para pintar la trayectoria).
 * @param {Array<Record<string, any>>} [entries]  cada una con `weekIso` y las dims 0..100
 * @returns {Array<{ weekIso: string, count: number, means: Record<string, number> }>}
 */
export function weeklyMeans(entries = []) {
  const byWeek = new Map();
  for (const entry of entries) {
    const wk = entry?.weekIso;
    if (typeof wk !== 'string' || !wk) continue;
    if (!byWeek.has(wk)) {
      byWeek.set(wk, { count: 0, sums: Object.fromEntries(PULSE_DIMS.map((d) => [d, 0])) });
    }
    const acc = byWeek.get(wk);
    acc.count += 1;
    for (const dim of PULSE_DIMS) acc.sums[dim] += Number(entry[dim]) || 0;
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekIso, acc]) => ({
      weekIso,
      count: acc.count,
      means: Object.fromEntries(PULSE_DIMS.map((d) => [d, Math.round(acc.sums[d] / acc.count)])),
    }));
}

/**
 * Tendencia neta de una serie numérica (de más antigua a más reciente): la
 * diferencia entre el último y el primer valor, con una dirección por umbral.
 * @param {number[]} [series]
 * @param {number} [threshold]  cambio mínimo (en puntos) para no considerarlo estable
 * @returns {{ delta: number, dir: 'up'|'flat'|'down' }}
 */
export function netTrend(series = [], threshold = 8) {
  const nums = series.filter((n) => Number.isFinite(n));
  if (nums.length < 2) return { delta: 0, dir: 'flat' };
  const delta = nums.at(-1) - nums[0];
  if (Math.abs(delta) < threshold) return { delta, dir: 'flat' };
  return { delta, dir: delta > 0 ? 'up' : 'down' };
}

/**
 * Traduce una dirección numérica a sentimiento, según si en esa dimensión subir
 * es bueno o malo. En «carga» (warnHigh) subir es EMPEORAR; en el resto, mejorar.
 * @param {'up'|'flat'|'down'} dir
 * @param {boolean} [warnHigh]  true si un valor alto es señal de atención (p. ej. carga)
 * @returns {'better'|'steady'|'worse'}
 */
export function trendSentiment(dir, warnHigh = false) {
  if (dir === 'flat') return 'steady';
  const good = warnHigh ? 'down' : 'up';
  return dir === good ? 'better' : 'worse';
}
