/**
 * Compañeros en la isla (RMR-PCS-0029 · F1): quiénes se pintan paseando por TU
 * isla. El juego es personal — los compañeros salen SOLO de tu grupo de
 * shippooling (carpool), nunca de todo el equipo. Función PURA (sin Firebase ni
 * DOM): se testea sola.
 *
 * Privacidad: de cada compañero se expone solo nombre, ciudad actual y % de
 * progreso — nada más.
 *
 * @typedef {import('./types.js').CareerMap} CareerMap
 * @typedef {import('./types.js').Journey} Journey
 */
import { progressPct } from './progress.js';
import { DEFAULT_ISLAND_ID } from './types.js';

/**
 * @typedef {Object} Teammate
 * @property {string} personId
 * @property {string} name
 * @property {string} currentCity
 * @property {number} progressPct
 */

/**
 * Deriva los compañeros a pintar en la isla actual a partir de los MIEMBROS del
 * grupo (dedup, sin uno mismo) y sus journeys. Solo aparece quien tiene ciudad
 * actual EN la isla que se está jugando.
 * @param {Object} params
 * @param {{personId:string, name:string}[]} params.members  miembros del grupo (sin el propio jugador)
 * @param {Map<string, Journey>} params.journeyById            journeys cargados por personId
 * @param {string} params.currentIsland                        isla que se está jugando
 * @param {CareerMap|null} params.map                          mapa de esa isla (para el %)
 * @returns {Teammate[]}
 */
export function deriveTeammates({ members, journeyById, currentIsland, map }) {
  if (!map) return [];
  const seen = new Set();
  const out = [];
  for (const m of members ?? []) {
    if (!m || !m.personId || seen.has(m.personId)) continue;
    seen.add(m.personId);
    const journey = journeyById?.get?.(m.personId);
    if (!journey || !journey.currentCity) continue;
    // Cada compañero se pinta SOLO en su isla (el archipiélago es global).
    if ((journey.currentIsland ?? DEFAULT_ISLAND_ID) !== currentIsland) continue;
    out.push({
      personId: m.personId,
      name: m.name,
      currentCity: journey.currentCity,
      progressPct: progressPct(map, journey.visitedCities),
    });
  }
  return out;
}
