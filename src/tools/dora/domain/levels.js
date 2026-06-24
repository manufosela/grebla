/**
 * Clasificación de métricas DORA en niveles (Elite/Alto/Medio/Bajo) según los
 * umbrales orientativos del modelo DORA (State of DevOps). El informe usa rangos
 * cualitativos; aquí se fijan cortes numéricos para poder etiquetar en la UI.
 * Son aproximaciones razonables, no un estándar exacto.
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
