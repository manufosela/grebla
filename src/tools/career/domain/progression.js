/**
 * Curva de progresión del sub-nivel (épica RMR-PCS-0037 · F2): lógica PURA que
 * deriva la serie temporal del sub-nivel — cómo maduró la persona DENTRO de
 * cada nivel — sin persistir nada. Los puntos son los cierres de valoración; el
 * historial de nivel (person.levelHistory) pinta los hitos de promoción.
 */

import { subLevelFromCompletion } from './levelProgress.js';

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
 * La curva a partir de las VALORACIONES (RMR-TSK-0556), que es de donde sale el
 * sub-nivel desde RMR-PCS-0044. El mapa es formación: recorrer un camino no sube
 * de nivel, así que no hay curva hecha con certificados (RMR-TSK-0695).
 *
 * Cada cierre de una valoración es un punto: el porcentaje que se cumplía ese
 * día y el sub-nivel que salía de él, juzgado contra el cierre anterior del
 * mismo nivel — el `.3` pide mantener el 80 %, así que el orden importa. Los
 * hitos de promoción siguen saliendo del historial de nivel.
 *
 * Sin valoraciones cerradas no hay curva: antes que dibujar una con los
 * certificados, mejor no dibujar nada.
 *
 * @param {{ person: { levelId?: string|null, levelHistory?: unknown },
 *   framework: { levels?: Array<{id: string, code?: string}> }|null,
 *   assessments: Array<{ levelId: string, closures?: Array<{ at: string, earned?: number, total?: number, pct: number }> }> }} input
 * @returns {{ points: Array<{ at: string, pct: number, sub: 1|2|3, levelCode: string }>,
 *   milestones: Array<{ at: string, fromCode: string|null, toCode: string, note: string|null }> }}
 */
export function assessmentProgressionSeries({ person, framework, assessments }) {
  const history = sanitizeHistory(person?.levelHistory);
  const levels = framework?.levels ?? [];
  const codeOf = (id) => levels.find((l) => l.id === id)?.code ?? id;
  const milestones = history.map((e) => ({
    at: e.at,
    fromCode: e.from ? codeOf(e.from) : null,
    toCode: codeOf(e.to),
    note: e.note,
  }));

  const points = [];
  for (const valoracion of assessments ?? []) {
    // Los cierres de un mismo nivel, en orden: cada uno se juzga con el anterior.
    const cierres = [...(valoracion?.closures ?? [])].toSorted((a, b) => String(a.at ?? '').localeCompare(String(b.at ?? '')));
    for (const [i, cierre] of cierres.entries()) {
      const at = typeof cierre?.at === 'string' ? cierre.at : '';
      if (!at || typeof cierre.pct !== 'number') continue;
      const veredicto = subLevelFromCompletion(cierre, cierres.slice(0, i).toReversed());
      if (!veredicto) continue;
      // El nivel que tenía ESE día, no el de hoy: la curva cuenta una historia.
      points.push({ at, pct: cierre.pct, sub: veredicto.sub, levelCode: codeOf(levelAtDate(history, person?.levelId ?? null, at)) });
    }
  }
  return { points: points.toSorted((a, b) => a.at.localeCompare(b.at)), milestones };
}
