/**
 * Lectura CUALITATIVA de salud del equipo (Alcance 4.8) — agregado de equipo.
 *
 * Invariantes:
 * - R1: no promedia ni combina las cuatro dimensiones en un "nivel global".
 * - R3: no ordena ni puntúa personas entre sí; solo conteos/distribuciones.
 * - R6: todo es agregado (cobertura, riesgos, distribución), exportable; no
 *   incluye niveles individuales identificables.
 *
 * Función pura: `now` se pasa como parámetro.
 *
 * @typedef {import('../types.js').OrgSettings} OrgSettings
 */
import { LEVELS } from '../levels.js';
import { roleCoverage, uncoveredRoles } from './roleCoverage.js';
import { busFactor } from './busFactor.js';
import { silenceAlerts } from './silenceAlerts.js';

/**
 * @param {Object} input
 * @param {import('../types.js').ContributionReading[]} input.contributions  Contribución actual por persona.
 * @param {Array<{personId:string,areaId:string,level:number}>} input.coverage  Conocimiento actual.
 * @param {Array<{personId:string,lastActivityDate:string|null}>} input.activities
 * @param {Array<{level:number}>} input.seniorities  Seniority actual por persona.
 * @param {OrgSettings} input.settings
 * @param {string[]} [input.areaIds]
 * @param {Date|string|number} input.now
 * @param {number} input.teamSize
 * @returns {object}
 */
export function teamHealth({ contributions = [], coverage = [], activities = [], seniorities = [], settings, areaIds = null, now, teamSize }) {
  const cfg = settings || { cadenceDays: 30, busFactorMinLevel: 3 };

  const bf = busFactor(coverage, { minLevel: cfg.busFactorMinLevel, areaIds });
  const silence = silenceAlerts(activities, cfg.cadenceDays, now);

  // Distribución de seniority por nivel (conteo, nunca por persona nombrada).
  const counts = new Map(LEVELS.map((l) => [l.order, 0]));
  for (const s of seniorities) {
    if (s && counts.has(s.level)) counts.set(s.level, counts.get(s.level) + 1);
  }
  const seniorityDistribution = LEVELS.map((l) => ({ order: l.order, name: l.name, count: counts.get(l.order) }));

  return {
    teamSize: typeof teamSize === 'number' ? teamSize : contributions.length,
    roleCoverage: roleCoverage(contributions),
    uncoveredRoles: uncoveredRoles(contributions),
    busFactor: bf,
    areasAtRiskCount: bf.filter((a) => a.atRisk).length,
    busFactorOneCount: bf.filter((a) => a.count === 1).length,
    silence,
    silenceCount: silence.length,
    seniorityDistribution,
  };
}
