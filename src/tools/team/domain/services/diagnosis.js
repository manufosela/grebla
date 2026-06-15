/**
 * Diagnóstico de equipo (GREBLA §13): deriva una lista de gaps por prioridad y un
 * score de salud 0-100 a partir del agregado de salud del equipo (teamHealth).
 * Cada gap incluye la palanca recomendada (§12.3). Los pesos son explícitos y el
 * score es ORIENTATIVO, no un veredicto. Función pura; no compara personas (R3).
 *
 * @typedef {ReturnType<import('./teamHealth.js').teamHealth>} TeamHealth
 */
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const SEVERITY_ORDER = { critical: 0, medium: 1, low: 2 };

/** Penalizaciones del score de salud (documentadas, ajustables). */
export const PENALTY = Object.freeze({
  busFactorZero: 15,
  busFactorOne: 10,
  uncoveredRole: 3,
  uncoveredRoleCap: 15,
  silencePerPerson: 3,
  silenceCap: 15,
  sizeSmall: 5,
  sizeLarge: 3,
});

/**
 * @param {TeamHealth|object} health
 * @returns {{ healthScore: number, gaps: Array<object>, counts: { critical: number, medium: number, low: number } }}
 */
export function diagnoseTeam(health) {
  const h = health || {};
  const gaps = [];
  let score = 100;

  for (const b of h.busFactor ?? []) {
    if (b.count === 0) {
      gaps.push({ severity: 'critical', kind: 'busFactorZero', areaId: b.areaId, lever: 'Formación técnica o contratación' });
      score -= PENALTY.busFactorZero;
    } else if (b.count === 1) {
      gaps.push({ severity: 'critical', kind: 'busFactorOne', areaId: b.areaId, lever: 'Formación técnica (resoluble internamente)' });
      score -= PENALTY.busFactorOne;
    }
  }

  const uncovered = h.uncoveredRoles ?? [];
  for (const r of uncovered) {
    gaps.push({ severity: 'medium', kind: 'uncoveredRole', sigla: r.sigla, name: r.name, lever: 'Redistribución de responsabilidades o contratación' });
  }
  score -= Math.min(PENALTY.uncoveredRoleCap, uncovered.length * PENALTY.uncoveredRole);

  const silenceCount = h.silenceCount ?? 0;
  if (silenceCount > 0) {
    gaps.push({ severity: 'medium', kind: 'silence', count: silenceCount, lever: 'Acompañamiento y más frecuencia de seguimiento' });
    score -= Math.min(PENALTY.silenceCap, silenceCount * PENALTY.silencePerPerson);
  }

  const size = h.teamSize ?? 0;
  if (size > 0 && size < 5) {
    gaps.push({ severity: 'low', kind: 'sizeSmall', teamSize: size, lever: 'Quien lidera cubre roles temporalmente o contratación' });
    score -= PENALTY.sizeSmall;
  } else if (size > 6) {
    gaps.push({ severity: 'low', kind: 'sizeLarge', teamSize: size, lever: 'Gestionar la superposición de roles' });
    score -= PENALTY.sizeLarge;
  }

  gaps.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    healthScore: clamp(Math.round(score), 0, 100),
    gaps,
    counts: {
      critical: gaps.filter((g) => g.severity === 'critical').length,
      medium: gaps.filter((g) => g.severity === 'medium').length,
      low: gaps.filter((g) => g.severity === 'low').length,
    },
  };
}
