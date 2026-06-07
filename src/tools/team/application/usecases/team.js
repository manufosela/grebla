/**
 * Casos de uso agregados de equipo. Derivan el estado ACTUAL (última lectura por
 * persona, y por persona+área en Conocimiento) desde el histórico y lo pasan a
 * los servicios puros del dominio. Todo es agregado (R6) y no compara personas
 * (R3). El export excluye cualquier dato individual identificable.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 */
import { roleCoverage, uncoveredRoles } from '../../domain/services/roleCoverage.js';
import { busFactor } from '../../domain/services/busFactor.js';
import { silenceAlerts } from '../../domain/services/silenceAlerts.js';
import { teamHealth } from '../../domain/services/teamHealth.js';

/** @param {PersistencePort} persistence */
async function activePeople(persistence) {
  return (await persistence.people.list()).filter((p) => p.active);
}

/** Última contribución (perfil Belbin) de cada persona. */
async function currentContributions(persistence, people) {
  const out = [];
  for (const p of people) {
    const latest = await persistence.readings.contribution.latest(p.id);
    if (latest) out.push(latest);
  }
  return out;
}

/** Última seniority de cada persona. */
async function currentSeniorities(persistence, people) {
  const out = [];
  for (const p of people) {
    const latest = await persistence.readings.seniority.latest(p.id);
    if (latest) out.push(latest);
  }
  return out;
}

/** Cobertura de conocimiento actual: última lectura por (persona, área). */
async function currentKnowledgeCoverage(persistence, people) {
  const out = [];
  for (const p of people) {
    const readings = await persistence.readings.knowledge.listByPerson(p.id); // asc por fecha
    const latestByArea = new Map();
    for (const r of readings) latestByArea.set(r.areaId, r); // asc → la última gana
    for (const [areaId, r] of latestByArea) {
      out.push({ personId: p.id, areaId, level: r.level });
    }
  }
  return out;
}

/** Última actividad (conversación) de cada persona, para los avisos de silencio. */
async function currentActivities(persistence, people) {
  const out = [];
  for (const p of people) {
    const convs = await persistence.conversations.listByPerson(p.id); // asc por fecha
    out.push({ personId: p.id, lastActivityDate: convs.at(-1)?.date ?? null });
  }
  return out;
}

/**
 * Radar de cobertura de roles Belbin del equipo (R9a).
 * @param {PersistencePort} persistence
 */
export async function getTeamCoverage(persistence) {
  const people = await activePeople(persistence);
  const contributions = await currentContributions(persistence, people);
  return { coverage: roleCoverage(contributions), uncovered: uncoveredRoles(contributions) };
}

/**
 * Bus factor por área de conocimiento.
 * @param {PersistencePort} persistence
 */
export async function getBusFactor(persistence) {
  const people = await activePeople(persistence);
  const [settings, areas, coverage] = await Promise.all([
    persistence.config.getSettings(),
    persistence.areas.list(),
    currentKnowledgeCoverage(persistence, people),
  ]);
  return busFactor(coverage, { minLevel: settings.busFactorMinLevel, areaIds: areas.map((a) => a.id) });
}

/**
 * Avisos de silencio según la cadencia configurada (R7).
 * @param {PersistencePort} persistence
 * @param {Date|string|number} now
 */
export async function getSilenceAlerts(persistence, now) {
  const people = await activePeople(persistence);
  const { cadenceDays } = await persistence.config.getSettings();
  const activities = await currentActivities(persistence, people);
  return silenceAlerts(activities, cadenceDays, now);
}

/**
 * Lectura cualitativa de salud del equipo (agregado completo).
 * @param {PersistencePort} persistence
 * @param {Date|string|number} now
 */
export async function getTeamHealth(persistence, now) {
  const people = await activePeople(persistence);
  const [settings, areas] = await Promise.all([
    persistence.config.getSettings(),
    persistence.areas.list(),
  ]);
  const [contributions, coverage, activities, seniorities] = await Promise.all([
    currentContributions(persistence, people),
    currentKnowledgeCoverage(persistence, people),
    currentActivities(persistence, people),
    currentSeniorities(persistence, people),
  ]);
  return teamHealth({
    contributions,
    coverage,
    activities,
    seniorities,
    settings,
    areaIds: areas.map((a) => a.id),
    now,
    teamSize: people.length,
  });
}

/**
 * Export de agregados (R6). Devuelve SOLO datos agregados: nunca niveles
 * individuales ni la lista nominal de personas en silencio (se conserva el
 * conteo). Las support notes (R5) jamás se incluyen.
 * @param {PersistencePort} persistence
 * @param {Date|string|number} now
 */
export async function exportAggregate(persistence, now) {
  const health = await getTeamHealth(persistence, now);
  const { silence, ...aggregate } = health; // elimina personIds del export
  return { generatedAt: new Date(now).toISOString(), ...aggregate };
}
