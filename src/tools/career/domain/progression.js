/**
 * Curva de progresión del sub-nivel (épica RMR-PCS-0037 · F2): lógica PURA que
 * deriva la serie temporal del sub-nivel — cómo maduró la persona DENTRO de
 * cada nivel — sin persistir nada.
 *
 * Fuentes (ambas solo-añadir, ya existentes):
 *  - La BITÁCORA (JG-23): sus apuntes `certificate` fechan cada casa. Los
 *    achievements NO sirven aquí: solo fechan ciudadanías por isla.
 *  - El historial de nivel (F1, person.levelHistory): dice qué nivel estaba
 *    vigente en cada fecha y pinta los hitos de promoción sobre la curva.
 *
 * En cada fecha-evento el sub-nivel se mide contra la ruta del SIGUIENTE nivel
 * vigente ENTONCES (mismo criterio que el badge actual, reutilizando
 * subLevelFor): tras una promoción la curva cae a la ruta siguiente — la
 * maduración empieza de nuevo. Certificados pre-JG-23 sin apunte fechado no
 * entran: la curva empieza donde empieza la bitácora, no se inventan fechas.
 */

import { nextLevelFor, subLevelFor } from './subLevel.js';
import { routeDocId, suggestedTierKey } from './careerRoutes.js';

/**
 * Guard local del historial de nivel: entradas con destino y fecha, resto
 * fuera. ESPEJO mínimo de normalizeLevelHistory (tools/team/domain/
 * levelHistory.js) — las herramientas no pueden importarse entre sí (regla de
 * arquitectura), así que este dominio sanea lo justo para lo que consume
 * (from/to/at/note). Si cambia el modelo allí, cambia este guard.
 * @param {unknown} raw
 * @returns {Array<{ from: string|null, to: string, at: string, note: string|null }>}
 */
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === 'object')
    .filter((e) => typeof e.to === 'string' && e.to.trim() && typeof e.at === 'string' && e.at.trim())
    .map((e) => ({
      from: typeof e.from === 'string' && e.from.trim() ? e.from.trim() : null,
      to: e.to.trim(),
      at: e.at.trim(),
      note: typeof e.note === 'string' && e.note.trim() ? e.note.trim() : null,
    }));
}

/**
 * Fechas de certificado por ciudad desde la bitácora: el PRIMER apunte
 * `certificate` de cada casa (los siguientes son re-obtenciones y no cambian
 * cuándo se logró). Bitácora ausente o rota → mapa vacío.
 * @param {{ entries?: Array<{ kind: string, ref: string, at: string }> }|null|undefined} logbook
 * @returns {Map<string, string>} cityId → fecha ISO
 */
export function certificateDatesFrom(logbook) {
  const dates = new Map();
  const entries = Array.isArray(logbook?.entries) ? logbook.entries : [];
  for (const e of entries) {
    if (e?.kind !== 'certificate' || typeof e.ref !== 'string' || typeof e.at !== 'string') continue;
    if (!e.ref || !e.at || dates.has(e.ref)) continue;
    dates.set(e.ref, e.at);
  }
  return dates;
}

/**
 * Nivel vigente en una fecha según el historial: la última entrada con
 * `at <= date`. Antes de la primera entrada rige su `from` (puede ser null:
 * aún sin nivel); sin historial, el nivel actual (fallback) para toda fecha.
 * Las fechas ISO se comparan lexicográficamente (orden natural del formato).
 * @param {unknown} levelHistory
 * @param {string|null} fallbackLevelId
 * @param {string} date  fecha ISO
 * @returns {string|null}
 */
export function levelAtDate(levelHistory, fallbackLevelId, date) {
  const entries = sanitizeHistory(levelHistory);
  if (entries.length === 0) return fallbackLevelId ?? null;
  let current = entries[0].from;
  for (const e of entries) {
    if (e.at <= date) current = e.to;
  }
  return current;
}

/**
 * Ruta del siguiente nivel a un nivel dado, o null si alguna pieza falta
 * (último nivel, sin disciplina, hito no resoluble, ruta no publicada).
 * @param {string|null} levelId
 * @param {{ levels?: any[] }|null} framework
 * @param {string|undefined} discipline
 * @param {ReadonlyArray<{ routeId: string, stops: string[] }>|null} routes
 * @returns {{ stops: string[], levelCode: string }|null}
 */
function routeTowardsNext(levelId, framework, discipline, routes) {
  const levels = framework?.levels ?? [];
  const current = levels.find((l) => l.id === levelId);
  if (!current) return null;
  const next = nextLevelFor(levels, current.id);
  const tierKey = next ? suggestedTierKey(next.id, levels) : null;
  if (!discipline || !tierKey) return null;
  let routeId;
  try {
    routeId = routeDocId(discipline, tierKey);
  } catch {
    return null;
  }
  const route = (routes ?? []).find((r) => r.routeId === routeId);
  if (!Array.isArray(route?.stops) || route.stops.length === 0) return null;
  return { stops: route.stops, levelCode: current.code ?? current.id };
}

/**
 * Serie temporal de la progresión: un punto por fecha-evento (certificados
 * fechados de la bitácora ∪ hitos del historial) medido contra la ruta del
 * siguiente nivel VIGENTE en esa fecha, más los hitos de promoción para
 * pintarlos encima. Sin datos → serie vacía (la vista no inventa gráfica).
 * @param {{
 *   person: { levelId?: string|null, disciplines?: string[], levelHistory?: unknown },
 *   framework: { levels?: any[] }|null,
 *   routes: ReadonlyArray<{ routeId: string, stops: string[] }>|null,
 *   logbook: { entries?: any[] }|null,
 * }} input
 * @returns {{
 *   points: Array<{ at: string, pct: number, sub: 1|2|3, levelCode: string }>,
 *   milestones: Array<{ at: string, fromCode: string|null, toCode: string, note: string|null }>,
 * }}
 */
export function progressionSeries({ person, framework, routes, logbook }) {
  const certDates = certificateDatesFrom(logbook);
  const history = sanitizeHistory(person?.levelHistory);
  const levels = framework?.levels ?? [];
  const codeOf = (id) => levels.find((l) => l.id === id)?.code ?? id;
  const milestones = history.map((e) => ({
    at: e.at,
    fromCode: e.from ? codeOf(e.from) : null,
    toCode: codeOf(e.to),
    note: e.note,
  }));

  const eventDates = [...new Set([...certDates.values(), ...history.map((e) => e.at)])]
    .toSorted((a, b) => a.localeCompare(b));
  const discipline = (person?.disciplines ?? []).at(0);
  const points = [];
  for (const at of eventDates) {
    const levelId = levelAtDate(history, person?.levelId ?? null, at);
    const route = routeTowardsNext(levelId, framework, discipline, routes);
    if (!route) continue;
    const visitedCities = [...certDates.entries()].filter(([, d]) => d <= at).map(([cityId]) => cityId);
    const result = subLevelFor(route.stops, { visitedCities });
    if (!result) continue;
    points.push({ at, pct: result.pct, sub: result.sub, levelCode: route.levelCode });
  }
  return { points, milestones };
}
