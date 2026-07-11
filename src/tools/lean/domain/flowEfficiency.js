/**
 * Flow efficiency (LEAN): qué proporción del cycle time se pasa realmente TRABAJANDO
 * frente a ESPERANDO. Funciones puras a partir del historial de estados de Linear.
 *
 * OJO: Linear tipa TODOS los estados de trabajo como `type='started'` (In Progress,
 * In Review, In QA, Blocked, Ready for QA, Merged…). Por eso el `type` no basta para
 * medir eficiencia: hay que mirar el NOMBRE del estado. Aplicamos el criterio ESTRICTO
 * de Lean (touch time): solo cuenta como ACTIVO el trabajo hands-on (`Doing`,
 * `In Progress`, `Breakdown Parents`); revisión, QA, colas y bloqueos (`In Review`,
 * `In Code Review`, `In QA`, `Ready for CR/QA`, `Blocked`, `Merged`, `QA Rejected`) son
 * ESPERA, igual que volver a backlog/unstarted. Un estado desconocido cuenta como espera
 * (conservador: no inflar la eficiencia).
 *
 * Una eficiencia baja (p. ej. 15 %) significa que el trabajo pasa la mayor parte del
 * tiempo esperando (en colas de review/QA), no en curso: señal de cuellos de botella.
 *
 * @typedef {{ stateType: string, stateName?: string, at: string|number|Date }} StateTransition
 * @typedef {{ startedAt: string|number|Date, completedAt: string|number|Date, transitions?: StateTransition[] }} IssueHistory
 */
const ms = (d) => new Date(d).getTime();

/** Nombres de estado `started` que cuentan como TRABAJO ACTIVO (touch time), en minúsculas. */
export const ACTIVE_STATE_NAMES = new Set(['doing', 'in progress', 'breakdown parents']);

/**
 * ¿La issue se está trabajando activamente (hands-on) en este estado? Criterio estricto:
 * solo `started` con un nombre de trabajo real; review/QA/colas/bloqueos son espera.
 * @param {string} stateType  tipo Linear: backlog|unstarted|started|completed|canceled
 * @param {string} [stateName]  nombre del estado (In Progress, In Review, Blocked…)
 * @returns {boolean}
 */
export function isActiveWork(stateType, stateName) {
  return stateType === 'started' && ACTIVE_STATE_NAMES.has(String(stateName ?? '').trim().toLowerCase());
}

/**
 * Tiempo activo (en `started`) y total (started→completed) de una issue.
 * @param {IssueHistory} issue
 * @returns {{ activeMs: number, totalMs: number }}
 */
export function activeAndTotal(issue) {
  const started = ms(issue.startedAt);
  const completed = ms(issue.completedAt);
  if (!(Number.isFinite(started) && Number.isFinite(completed) && completed > started)) {
    return { activeMs: 0, totalMs: 0 };
  }
  const total = completed - started;

  // Transiciones (entrada a un estado) como booleano activo/espera, ordenadas por fecha.
  const trans = (issue.transitions ?? [])
    .map((t) => ({ active: isActiveWork(t.stateType, t.stateName), at: ms(t.at) }))
    .filter((t) => Number.isFinite(t.at))
    .sort((a, b) => a.at - b.at);

  // Estado vigente al empezar: la última transición con `at <= started`, o activo por defecto.
  let current = true;
  const lastBefore = trans.findLast((t) => t.at <= started);
  if (lastBefore) current = lastBefore.active;

  let active = 0;
  let cursor = started;
  for (const t of trans) {
    if (t.at <= started || t.at >= completed) continue;
    if (current) active += t.at - cursor;
    cursor = t.at;
    current = t.active;
  }
  if (current) active += completed - cursor;

  return { activeMs: active, totalMs: total };
}

/**
 * Flow efficiency agregada del conjunto de issues, en % (Σ activo / Σ total).
 * @param {IssueHistory[]} issues
 * @returns {number|null}  porcentaje 0–100, o null si no hay tiempo medible.
 */
export function flowEfficiency(issues) {
  let active = 0;
  let total = 0;
  for (const issue of issues ?? []) {
    const { activeMs, totalMs } = activeAndTotal(issue);
    active += activeMs;
    total += totalMs;
  }
  return total > 0 ? Math.round((active / total) * 1000) / 10 : null;
}
