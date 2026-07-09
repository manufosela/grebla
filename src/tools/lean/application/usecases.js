/**
 * Casos de uso LEAN: alta/baja/listado de equipos de Linear monitorizados y el
 * resumen de flujo (global + por equipo). La UI nunca toca el repo directamente.
 * Espeja el patrón de `tools/dora/application/usecases.js`.
 *
 * @typedef {import('../domain/ports.js').LeanPersistence} LeanPersistence
 * @typedef {import('../domain/types.js').LeanTeam} LeanTeam
 */
import { aggregateFlow } from '../domain/aggregate.js';

/** Normaliza la key del equipo de Linear (mayúsculas, sin espacios). */
function normalizeKey(value) {
  return String(value ?? '').trim().toUpperCase();
}

/**
 * Da de alta un equipo de Linear a monitorizar.
 * @param {LeanPersistence} persistence
 * @param {{ linearTeamKey: string, name?: string }} input
 * @returns {Promise<string>}
 */
export function addTeam(persistence, input) {
  const linearTeamKey = normalizeKey(input.linearTeamKey);
  if (!linearTeamKey) throw new Error('La key del equipo de Linear es obligatoria');
  const name = String(input.name ?? '').trim() || linearTeamKey;
  return persistence.teams.add({ linearTeamKey, name, createdAt: new Date().toISOString() });
}

/** @param {LeanPersistence} persistence */
export function listTeams(persistence) {
  return persistence.teams.list();
}

/** @param {LeanPersistence} persistence @param {string} id */
export function removeTeam(persistence, id) {
  return persistence.teams.remove(id);
}

/**
 * Resumen de flujo: los equipos (con sus métricas) y un agregado global.
 * @param {LeanPersistence} persistence
 * @returns {Promise<{ teams: LeanTeam[], global: ReturnType<typeof aggregateFlow> }>}
 */
export async function getFlowSummary(persistence) {
  const teams = await persistence.teams.list();
  return { teams, global: aggregateFlow(teams) };
}
