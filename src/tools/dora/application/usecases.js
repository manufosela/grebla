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
 * Normaliza la agrupación (equipo/gremios) de un repo: equipo recortado o null,
 * gremios recortados, sin vacíos ni duplicados. Compartido por el alta y por la
 * asignación a posteriori para que ambos caminos guarden el mismo formato.
 * @param {{ team?: string|null, guilds?: string[] }} input
 * @returns {{ team: string|null, guilds: string[] }}
 */
export function normalizeGrouping(input) {
  const team = (input?.team ?? '').trim() || null;
  const guilds = Array.isArray(input?.guilds)
    ? [...new Set(input.guilds.map((g) => g.trim()).filter(Boolean))]
    : [];
  return { team, guilds };
}

/** Rama base que cuenta como despliegue. */
export const DEFAULT_BASE_BRANCH = 'main';

/**
 * Normaliza la rama base: recortada, o 'main' por defecto.
 * @param {string} [v]
 * @returns {string}
 */
export function normalizeBaseBranch(v) {
  return String(v ?? '').trim() || DEFAULT_BASE_BRANCH;
}

/** Señales de despliegue válidas para la frecuencia DORA. */
export const DEPLOY_SIGNALS = Object.freeze(['branch', 'release']);

/**
 * Normaliza la señal de despliegue: 'branch' (merges a la rama base) o 'release'
 * (releases/tags de GitHub). Default 'branch'.
 * @param {string} [v]
 * @returns {'branch'|'release'}
 */
export function normalizeDeploySignal(v) {
  return v === 'release' ? 'release' : 'branch';
}

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
    ...normalizeGrouping(input),
    baseBranch: normalizeBaseBranch(input.baseBranch),
    deploySignal: normalizeDeploySignal(input.deploySignal),
    startDate: input.startDate || null,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Actualiza la configuración a posteriori de un repo YA dado de alta: equipo,
 * gremios y rama base (señal de despliegue). No es el alta: solo reescribe la
 * configuración, normalizada igual que en addRepo.
 * @param {DoraPersistence} persistence
 * @param {string} id
 * @param {{ team?: string|null, guilds?: string[], baseBranch?: string }} input
 * @returns {Promise<void>}
 */
export function updateRepoConfig(persistence, id, input) {
  return persistence.repos.update(id, {
    ...normalizeGrouping(input),
    baseBranch: normalizeBaseBranch(input.baseBranch),
    deploySignal: normalizeDeploySignal(input.deploySignal),
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
