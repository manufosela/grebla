/**
 * Valoración por umbrales de las métricas de flujo (LEAN). SOLO las métricas con
 * una referencia razonable llevan nivel: flow efficiency y aging. Throughput,
 * cycle time y WIP son contextuales (dependen del tamaño del equipo y del tipo de
 * trabajo) y NO se valoran con un umbral absoluto — dar uno engañaría. Reutiliza
 * la escala de DORA (elite/high/medium/low).
 *
 * @typedef {'elite'|'high'|'medium'|'low'} FlowLevel
 */

/**
 * Flow efficiency (% de tiempo activo sobre total): más es mejor. Referencias de
 * la industria (la eficiencia típica ronda el 15–25 %; >40 % es muy buena).
 * @param {number|null|undefined} pct
 * @returns {FlowLevel|null}
 */
export function flowEfficiencyLevel(pct) {
  if (pct == null) return null;
  if (pct >= 40) return 'elite';
  if (pct >= 25) return 'high';
  if (pct >= 15) return 'medium';
  return 'low';
}

/**
 * Aging máximo de un WIP (días): menos es mejor (un item que lleva >2 semanas en
 * curso es un atasco).
 * @param {number|null|undefined} days
 * @returns {FlowLevel|null}
 */
export function agingLevel(days) {
  if (days == null) return null;
  if (days < 7) return 'high';
  if (days <= 14) return 'medium';
  return 'low';
}
