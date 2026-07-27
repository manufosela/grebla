/**
 * Recuento de resultados de la encuesta (RMR-TSK-0318). Dominio puro.
 *
 * - eNPS: clasifica cada puntuación (promotor/pasivo/detractor) y calcula
 *   %promotores − %detractores (rango −100..100). Se usa el corte estándar de
 *   NPS (9–10 promotor, 7–8 pasivo, ≤6 detractor), válido también para 1–10.
 * - Escalas (p. ej. Q12 de Gallup 1–5): n, media y distribución.
 */

/** Categoría eNPS de una puntuación, o null si no es número. */
export function enpsCategory(score) {
  if (typeof score !== 'number') return null;
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

/** eNPS = %promotores − %detractores, redondeado; null si no hay puntuaciones. */
export function enps(scores) {
  const values = (scores ?? []).filter((s) => typeof s === 'number');
  if (values.length === 0) return null;
  let promoters = 0;
  let detractors = 0;
  for (const score of values) {
    const category = enpsCategory(score);
    if (category === 'promoter') promoters += 1;
    else if (category === 'detractor') detractors += 1;
  }
  return Math.round(((promoters - detractors) / values.length) * 100);
}

/** Resumen de una escala: n, media y distribución ordenada por valor. */
export function summarizeScale(values) {
  const nums = (values ?? []).filter((v) => typeof v === 'number');
  const counts = new Map();
  for (const v of nums) counts.set(v, (counts.get(v) ?? 0) + 1);
  const distribution = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value - b.value);
  return {
    n: nums.length,
    average: nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : null,
    distribution,
  };
}
