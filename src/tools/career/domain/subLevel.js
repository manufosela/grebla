/**
 * Sub-nivel DERIVADO (.1/.2/.3) — progresión dentro del nivel (RMR-PCS-0034).
 *
 * Los sub-niveles nunca son niveles del framework ni aparecen en las JDs: se
 * derivan al vuelo de la evidencia del mapa — cuántas paradas de la ruta del
 * SIGUIENTE nivel de la persona ya están certificadas en su journey (visitar
 * una casa = su certificado, mismo criterio que challengeProgress y la
 * ciudadanía). Nada se persiste salvo el ajuste manual del manager (F3).
 *
 *  - .1  < 25 %  → recién alcanzado el nivel.
 *  - .2  25–70 % → lo consolida y empieza a evidenciar el siguiente.
 *  - .3  > 70 %  → a las puertas del siguiente.
 *
 * Sin ruta publicada o sin siguiente nivel → null (no se inventa un badge).
 * Aritmética en ENTEROS (done·100 vs total·umbral), como la ciudadanía.
 */

import { routeDocId, suggestedTierKey } from './careerRoutes.js';

/** Umbrales en % sobre la ruta del siguiente nivel. */
export const SUB_LEVEL_THRESHOLDS = Object.freeze({ consolidating: 25, atTheGates: 70 });

/**
 * Siguiente nivel del MISMO track por `order`, o null si es el último (o el
 * nivel no existe). Los tracks no se cruzan: la progresión .x es dentro de tu
 * escalera.
 * @param {ReadonlyArray<{ id: string, trackId: string, order: number }>} levels
 * @param {string} levelId
 * @returns {{ id: string, code?: string } | null}
 */
export function nextLevelFor(levels, levelId) {
  const current = (levels ?? []).find((l) => l.id === levelId);
  if (!current) return null;
  return (
    (levels ?? [])
      .filter((l) => l.trackId === current.trackId && l.order > current.order)
      .toSorted((a, b) => a.order - b.order)
      .at(0) ?? null
  );
}

/**
 * Sub-nivel derivado de la evidencia: paradas de la ruta del siguiente nivel
 * ya visitadas (= certificadas) en el journey.
 * @param {ReadonlyArray<string>|null|undefined} routeStops  Paradas de la ruta del SIGUIENTE nivel.
 * @param {{ visitedCities?: string[] }|null|undefined} journey
 * @returns {{ sub: 1|2|3, done: number, total: number, pct: number } | null}
 */
export function subLevelFor(routeStops, journey) {
  const stops = Array.isArray(routeStops) ? routeStops : [];
  const total = stops.length;
  if (total === 0) return null;
  const visited = new Set(journey?.visitedCities ?? []);
  const done = stops.filter((id) => visited.has(id)).length;
  let sub = 1;
  if (done * 100 > SUB_LEVEL_THRESHOLDS.atTheGates * total) sub = 3;
  else if (done * 100 >= SUB_LEVEL_THRESHOLDS.consolidating * total) sub = 2;
  return { sub, done, total, pct: Math.round((done * 100) / total) };
}

/**
 * Etiqueta del badge: código del nivel + sub («L1.2»). Solo para vistas
 * internas (ficha, listado del manager) — nunca para JDs.
 * @param {string} code @param {1|2|3} sub
 */
export function subLevelLabel(code, sub) {
  return `${code}.${sub}`;
}

/**
 * Resolución completa persona → badge de sub-nivel: nivel actual → siguiente
 * nivel del track → hito de ruta (posición relativa) → ruta publicada de su
 * disciplina → subLevelFor sobre el journey. Cualquier pieza ausente (sin
 * nivel, sin siguiente, sin disciplina, ruta no publicada) → null: el badge no
 * se inventa.
 * @param {{ person: { levelId?: string|null, disciplines?: string[] }, framework: { levels?: any[] }|null, routes: ReadonlyArray<{ routeId: string, stops: string[] }>|null, journey: { visitedCities?: string[] }|null }} input
 * @returns {{ sub: 1|2|3, done: number, total: number, pct: number, label: string } | null}
 */
export function subLevelForPerson({ person, framework, routes, journey }) {
  const levels = framework?.levels ?? [];
  const current = levels.find((l) => l.id === person?.levelId);
  if (!current) return null;
  const next = nextLevelFor(levels, current.id);
  if (!next) return null;
  const discipline = (person?.disciplines ?? []).at(0);
  const tierKey = suggestedTierKey(next.id, levels);
  if (!discipline || !tierKey) return null;
  let routeId;
  try {
    routeId = routeDocId(discipline, tierKey);
  } catch {
    return null;
  }
  const route = (routes ?? []).find((r) => r.routeId === routeId);
  const result = subLevelFor(route?.stops, journey);
  if (!result) return null;
  return { ...result, label: subLevelLabel(current.code ?? current.id, result.sub) };
}
