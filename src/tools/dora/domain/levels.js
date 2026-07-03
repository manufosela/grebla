/**
 * Clasificación de las CUATRO métricas DORA en niveles (Elite/Alto/Medio/Bajo).
 * Referencia única para todos los cortes: benchmarks DORA de getdx.com (2026),
 * basados en el State of DevOps Report. Cortes aplicados:
 *   - Lead Time for Changes: Elite <1h, Alto <1 día, Medio <1 semana, Bajo ≥1 semana.
 *   - Deployment Frequency:  Elite ≈diario (≥7/sem), Alto ≈semanal (≥1), Medio ≈mensual, Bajo por debajo.
 *   - Change Failure Rate:   Elite 0–5%, Alto ≤15%, Medio ≤30%, Bajo >30%.
 *   - Time to Restore (MTTR): Elite <1h, Alto <1 día, Medio <1 semana, Bajo ≥1 semana.
 * Fuentes: getdx.com/blog/lead-time-for-changes, /change-failure-rate,
 * /mean-time-to-restore (2026).
 *
 * @typedef {'elite'|'high'|'medium'|'low'} DoraLevel
 */

const LABELS = Object.freeze({ elite: 'Elite', high: 'Alto', medium: 'Medio', low: 'Bajo' });

/** Etiqueta legible de un nivel ('—' si no hay nivel). @param {DoraLevel|null} level */
export function levelLabel(level) {
  return level ? LABELS[level] : '—';
}

/**
 * Nivel por lead time medio en horas: Elite <1h, Alto <1 día, Medio <1 semana,
 * Bajo ≥1 semana.
 * @param {number|null|undefined} hours
 * @returns {DoraLevel|null}
 */
export function leadTimeLevel(hours) {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return null;
  if (hours < 1) return 'elite';
  if (hours < 24) return 'high';
  if (hours < 24 * 7) return 'medium';
  return 'low';
}

/**
 * Nivel por frecuencia de despliegue por semana: Elite ≈a diario (≥7), Alto
 * ≈semanal (≥1), Medio ≈mensual (≥1/mes ≈ 0.23/sem), Bajo por debajo.
 * @param {number|null|undefined} perWeek
 * @returns {DoraLevel|null}
 */
export function deployFrequencyLevel(perWeek) {
  if (perWeek == null || !Number.isFinite(perWeek) || perWeek < 0) return null;
  if (perWeek >= 7) return 'elite';
  if (perWeek >= 1) return 'high';
  if (perWeek >= 1 / 4.345) return 'medium'; // 1 mes ≈ 4.345 semanas
  return 'low';
}

/**
 * Nivel por Change Failure Rate (porcentaje 0–100): Elite 0–5%, Alto ≤15%,
 * Medio ≤30%, Bajo >30% (getdx 2026). Menos es mejor.
 * @param {number|null|undefined} pct
 * @returns {DoraLevel|null}
 */
export function changeFailureRateLevel(pct) {
  if (pct == null || !Number.isFinite(pct) || pct < 0) return null;
  if (pct <= 5) return 'elite';
  if (pct <= 15) return 'high';
  if (pct <= 30) return 'medium';
  return 'low';
}

/**
 * Nivel por Time to Restore / MTTR en horas: Elite <1h, Alto <1 día, Medio
 * <1 semana, Bajo ≥1 semana (getdx 2026). Menos es mejor.
 * @param {number|null|undefined} hours
 * @returns {DoraLevel|null}
 */
export function mttrLevel(hours) {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return null;
  if (hours < 1) return 'elite';
  if (hours < 24) return 'high';
  if (hours < 24 * 7) return 'medium';
  return 'low';
}
