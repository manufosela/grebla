/**
 * Casos de uso de configuración DORA sobre el puerto de persistencia. Equipos y
 * gremios son catálogos vivos: se derivan (distinct) de los repos ya guardados.
 *
 * @typedef {import('../domain/ports.js').DoraPersistence} DoraPersistence
 * @typedef {import('../domain/types.js').DoraRepo} DoraRepo
 */
import { isValidFullName } from '../domain/types.js';
import { aggregateMetrics, aggregateByKey, teamKeyOf, guildKeyOf } from '../domain/aggregate.js';

/**
 * @param {DoraPersistence} persistence
 * @param {{ fullName: string, team?: string|null, guilds?: string[], startDate: string }} input
 * @returns {Promise<string>}
 */
export function addRepo(persistence, input) {
  const fullName = String(input?.fullName ?? '').trim();
  if (!isValidFullName(fullName)) throw new Error('El repositorio debe tener el formato owner/repo');
  // Fecha y equipo son OPCIONALES. Si no hay fecha, se medirá desde la creación
  // del repo en GitHub (lo resuelve la Cloud Function).
  return persistence.repos.add({
    fullName,
    team: (input.team ?? '').trim() || null,
    guilds: Array.isArray(input.guilds) ? input.guilds.map((g) => g.trim()).filter(Boolean) : [],
    startDate: input.startDate || null,
    createdAt: new Date().toISOString(),
  });
}

/**
 * @param {DoraPersistence} persistence
 * @returns {Promise<DoraRepo[]>}
 */
export async function listRepos(persistence) {
  const repos = await persistence.repos.list();
  return repos.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * @param {DoraPersistence} persistence
 * @param {string} id
 * @param {Partial<DoraRepo>} patch
 * @returns {Promise<void>}
 */
export function updateRepo(persistence, id, patch) {
  return persistence.repos.update(id, patch);
}

/**
 * @param {DoraPersistence} persistence
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeRepo(persistence, id) {
  return persistence.repos.remove(id);
}

/** Equipos distintos derivados de los repos (catálogo vivo). */
export async function listTeams(persistence) {
  const repos = await persistence.repos.list();
  return [...new Set(repos.map((r) => r.team).filter(Boolean))].sort();
}

/** Gremios distintos derivados de los repos (catálogo vivo). */
export async function listGuilds(persistence) {
  const repos = await persistence.repos.list();
  return [...new Set(repos.flatMap((r) => r.guilds ?? []).filter(Boolean))].sort();
}

/**
 * Resumen DORA agregado: global, por equipo y por gremio (sobre el campo metrics
 * ya calculado en cada repo). Siempre a nivel de equipo, nunca por persona.
 * @param {DoraPersistence} persistence
 */
export async function getDoraSummary(persistence) {
  const repos = await listRepos(persistence);
  return {
    global: aggregateMetrics(repos),
    byTeam: aggregateByKey(repos, teamKeyOf),
    byGuild: aggregateByKey(repos, guildKeyOf),
    repos,
  };
}
