/**
 * Flow efficiency (LEAN, Fase 2): qué proporción del cycle time se pasa realmente
 * TRABAJANDO (estados activos = `type='started'`) frente a ESPERANDO (parado en
 * review/blocked/backlog tras haber empezado). Funciones puras a partir del
 * historial de estados de cada issue de Linear.
 *
 * Una eficiencia baja (p. ej. 20 %) significa que el trabajo pasa la mayor parte
 * del tiempo esperando, no en curso: señal de cuellos de botella en el proceso.
 *
 * @typedef {{ stateType: string, at: string|number|Date }} StateTransition
 * @typedef {{ startedAt: string|number|Date, completedAt: string|number|Date, transitions?: StateTransition[] }} IssueHistory
 */
const ms = (d) => new Date(d).getTime();

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

  // Transiciones (entrada a un estado) ordenadas por fecha.
  const trans = (issue.transitions ?? [])
    .map((t) => ({ stateType: t.stateType, at: ms(t.at) }))
    .filter((t) => Number.isFinite(t.at))
    .sort((a, b) => a.at - b.at);

  // Estado vigente al empezar: la última transición con `at <= started`, o `started`.
  let current = 'started';
  const lastBefore = trans.findLast((t) => t.at <= started);
  if (lastBefore) current = lastBefore.stateType;

  let active = 0;
  let cursor = started;
  for (const t of trans) {
    if (t.at <= started || t.at >= completed) continue;
    if (current === 'started') active += t.at - cursor;
    cursor = t.at;
    current = t.stateType;
  }
  if (current === 'started') active += completed - cursor;

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
