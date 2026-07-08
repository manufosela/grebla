/**
 * Estadísticas de los periodos de O2O (funciones puras, sin Firebase).
 *  - coverageOf: cobertura de un periodo = cuántas personas del equipo tienen al
 *    menos un O2O registrado en él.
 *  - evolutionOf: la cobertura de cada periodo, para comparar la evolución.
 *
 * @typedef {import('../../domain/types.js').O2OSession} O2OSession
 * @typedef {import('../../domain/types.js').O2OPeriod} O2OPeriod
 * @typedef {{ id: string, name: string }} Person
 */

/**
 * Cobertura de un periodo: personas del equipo con ≥1 sesión (frente al total).
 * @param {O2OSession[]} sessions  Sesiones del periodo.
 * @param {Person[]} people        Equipo del líder.
 * @returns {{ done: number, total: number, pct: number, doneIds: Set<string> }}
 */
export function coverageOf(sessions, people) {
  const sessionPersonIds = new Set((sessions ?? []).map((s) => s.personId));
  const team = people ?? [];
  const doneIds = new Set(team.filter((p) => sessionPersonIds.has(p.id)).map((p) => p.id));
  const total = team.length;
  const done = doneIds.size;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, doneIds };
}

/**
 * Cobertura de cada periodo (más recientes primero, como vienen los periodos),
 * para ver la evolución del ciclo de O2O.
 * @param {O2OPeriod[]} periods       Periodos del líder.
 * @param {O2OSession[]} allSessions  TODAS las sesiones del líder (con periodId).
 * @param {Person[]} people           Equipo del líder.
 * @returns {{ periodId: string, name: string, done: number, total: number, pct: number, sessions: number }[]}
 */
export function evolutionOf(periods, allSessions, people) {
  return (periods ?? []).map((period) => {
    const sessions = (allSessions ?? []).filter((s) => s.periodId === period.id);
    const cov = coverageOf(sessions, people);
    return { periodId: period.id, name: period.name, done: cov.done, total: cov.total, pct: cov.pct, sessions: sessions.length };
  });
}
