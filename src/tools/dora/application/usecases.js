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

/**
 * Señales de despliegue válidas para la frecuencia DORA. Cubren el modelo real
 * (no ramas de entorno dev→staging→main): la mayoría de repos despliegan por
 * push/merge a una rama ('branch'); algunos por GitHub Release ('release') o por
 * tag que casa un patrón ('tag', p. ej. hoop-api `YYYY.MM.DD.N` o tribbu-infra
 * `prod-*`); los que despliegan por un JOB de GitHub Actions ('workflow', p. ej.
 * el nocturno de Fastlane o un push→Cloud Run) declaran su fichero de workflow y
 * la frecuencia sale de sus runs exitosos (y el CFR de los fallidos); y los que
 * despliegan fuera de GitHub sin job observable no tienen señal ('manual'): su
 * frecuencia sale solo de eventos registrados a mano.
 */
export const DEPLOY_SIGNALS = Object.freeze(['branch', 'release', 'tag', 'workflow', 'manual']);

/**
 * Normaliza la señal de despliegue a una de DEPLOY_SIGNALS. Default 'branch'.
 * @param {string} [v]
 * @returns {'branch'|'release'|'tag'|'workflow'|'manual'}
 */
export function normalizeDeploySignal(v) {
  return DEPLOY_SIGNALS.includes(v) ? v : 'branch';
}

/**
 * Normaliza el fichero de workflow usado cuando la señal es 'workflow'. Acepta
 * el nombre del fichero (`testflight.yml`) o la ruta completa; se queda con el
 * basename, que es lo que admite la API de Actions. Vacío si no aplica.
 * @param {string} [v]
 * @returns {string}
 */
export function normalizeWorkflowFile(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  return raw.split('/').at(-1) ?? '';
}

/**
 * Normaliza el patrón de tag (regex) usado cuando la señal es 'tag'. Recortado;
 * cadena vacía si no aplica. Valida que sea una regex compilable.
 * @param {string} [v]
 * @returns {string}
 */
export function normalizeTagPattern(v) {
  const pattern = String(v ?? '').trim();
  if (!pattern) return '';
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
  } catch {
    throw new Error(`Patrón de tag inválido (no es una expresión regular): ${pattern}`);
  }
  return pattern;
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
    tagPattern: normalizeTagPattern(input.tagPattern),
    workflowFile: normalizeWorkflowFile(input.workflowFile),
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
 * @param {{ team?: string|null, guilds?: string[], baseBranch?: string, deploySignal?: string, tagPattern?: string, workflowFile?: string }} input
 * @returns {Promise<void>}
 */
export function updateRepoConfig(persistence, id, input) {
  return persistence.repos.update(id, {
    ...normalizeGrouping(input),
    baseBranch: normalizeBaseBranch(input.baseBranch),
    deploySignal: normalizeDeploySignal(input.deploySignal),
    tagPattern: normalizeTagPattern(input.tagPattern),
    workflowFile: normalizeWorkflowFile(input.workflowFile),
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

/** Estados válidos de un evento de despliegue. */
export const DEPLOYMENT_STATUSES = Object.freeze(['success', 'failed']);

/**
 * Registra un evento de despliegue REAL de un repo. Valida el estado
 * (success|failed) y la marca de tiempo `at` (ISO parseable); el entorno es
 * 'production' por defecto. `createdBy` solo se incluye si se aporta un autor
 * completo (uid + name). Sin fallbacks silenciosos: si `at` o `status` no son
 * válidos, lanza en vez de registrar un evento corrupto.
 * @param {DoraPersistence} persistence
 * @param {string} repoId
 * @param {{ at: string, sha?: string|null, environment?: string, status: string, note?: string, createdBy?: { uid: string, name: string } }} input
 * @returns {Promise<string>}  id del evento creado
 */
export function registerDeployment(persistence, repoId, input) {
  if (!repoId) throw new Error('registerDeployment requiere el id del repo');
  const status = String(input?.status ?? '').trim();
  if (!DEPLOYMENT_STATUSES.includes(status)) {
    throw new Error("El estado del despliegue debe ser 'success' o 'failed'");
  }
  const at = String(input?.at ?? '').trim();
  if (!at || Number.isNaN(new Date(at).getTime())) {
    throw new Error('La fecha del despliegue (at) debe ser una fecha ISO válida');
  }
  const environment = String(input?.environment ?? '').trim() || 'production';
  const sha = (input?.sha ?? '').trim() || null;
  const note = (input?.note ?? '').trim();
  /** @type {Omit<import('../domain/types.js').Deployment,'id'>} */
  const event = {
    at: new Date(at).toISOString(),
    sha,
    environment,
    status,
    createdAt: new Date().toISOString(),
  };
  if (note) event.note = note;
  // createdBy solo si viene completo (uid + name); no se estampa a medias.
  if (input?.createdBy?.uid && input?.createdBy?.name) {
    event.createdBy = { uid: input.createdBy.uid, name: input.createdBy.name };
  }
  return persistence.deployments.add(repoId, event);
}

/**
 * Lista los eventos de despliegue de un repo (ordenados por `at` desc).
 * @param {DoraPersistence} persistence
 * @param {string} repoId
 * @returns {Promise<import('../domain/types.js').Deployment[]>}
 */
export function listDeployments(persistence, repoId) {
  return persistence.deployments.listByRepo(repoId);
}

/**
 * Elimina un evento de despliegue de un repo.
 * @param {DoraPersistence} persistence
 * @param {string} repoId
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeDeployment(persistence, repoId, id) {
  return persistence.deployments.remove(repoId, id);
}

/**
 * Registra un INCIDENTE en producción de un repo (base del MTTR, DORA D4).
 * Espejo de `registerDeployment`. Valida `startedAt` (ISO parseable). El
 * incidente puede nacer ABIERTO (`restoredAt` null) o ya RESUELTO (`restoredAt`
 * ISO parseable). `note`, `deploymentId` y `createdBy` (uid + name) solo se
 * incluyen si vienen; no se escriben campos vacíos ni `undefined`. Sin fallbacks
 * silenciosos: si `startedAt` o `restoredAt` no son válidos, lanza.
 * @param {DoraPersistence} persistence
 * @param {string} repoId
 * @param {{ startedAt: string, restoredAt?: string|null, note?: string, deploymentId?: string|null, createdBy?: { uid: string, name: string } }} input
 * @returns {Promise<string>}  id del incidente creado
 */
export function registerIncident(persistence, repoId, input) {
  if (!repoId) throw new Error('registerIncident requiere el id del repo');
  const startedAt = String(input?.startedAt ?? '').trim();
  if (!startedAt || Number.isNaN(new Date(startedAt).getTime())) {
    throw new Error('La fecha de inicio del incidente (startedAt) debe ser una fecha ISO válida');
  }
  // restoredAt opcional: null (abierto) o fecha ISO válida (resuelto de inicio).
  const restoredRaw = input?.restoredAt == null ? null : String(input.restoredAt).trim();
  let restoredAt = null;
  if (restoredRaw) {
    if (Number.isNaN(new Date(restoredRaw).getTime())) {
      throw new Error('La fecha de restauración (restoredAt) debe ser una fecha ISO válida');
    }
    restoredAt = new Date(restoredRaw).toISOString();
  }
  const note = (input?.note ?? '').trim();
  const deploymentId = (input?.deploymentId ?? '').trim();
  /** @type {Omit<import('../domain/types.js').Incident,'id'>} */
  const incident = {
    startedAt: new Date(startedAt).toISOString(),
    restoredAt,
    createdAt: new Date().toISOString(),
  };
  if (note) incident.note = note;
  if (deploymentId) incident.deploymentId = deploymentId;
  // createdBy solo si viene completo (uid + name); no se estampa a medias.
  if (input?.createdBy?.uid && input?.createdBy?.name) {
    incident.createdBy = { uid: input.createdBy.uid, name: input.createdBy.name };
  }
  return persistence.incidents.add(repoId, incident);
}

/**
 * Lista los incidentes de un repo (ordenados por `startedAt` desc).
 * @param {DoraPersistence} persistence
 * @param {string} repoId
 * @returns {Promise<import('../domain/types.js').Incident[]>}
 */
export function listIncidents(persistence, repoId) {
  return persistence.incidents.listByRepo(repoId);
}

/**
 * Marca un incidente ABIERTO como RESUELTO, fijando su `restoredAt`. Valida que
 * la fecha de restauración sea ISO parseable (sin fallbacks silenciosos).
 * @param {DoraPersistence} persistence
 * @param {string} repoId
 * @param {string} id
 * @param {string} restoredAt  Marca de restauración (ISO 8601).
 * @returns {Promise<void>}
 */
export function resolveIncident(persistence, repoId, id, restoredAt) {
  if (!repoId) throw new Error('resolveIncident requiere el id del repo');
  if (!id) throw new Error('resolveIncident requiere el id del incidente');
  const value = String(restoredAt ?? '').trim();
  if (!value || Number.isNaN(new Date(value).getTime())) {
    throw new Error('La fecha de restauración (restoredAt) debe ser una fecha ISO válida');
  }
  return persistence.incidents.update(repoId, id, { restoredAt: new Date(value).toISOString() });
}

/**
 * Elimina un incidente de un repo.
 * @param {DoraPersistence} persistence
 * @param {string} repoId
 * @param {string} id
 * @returns {Promise<void>}
 */
export function removeIncident(persistence, repoId, id) {
  return persistence.incidents.remove(repoId, id);
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
