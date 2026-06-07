/**
 * Cobertura de roles de contribución (Belbin) del EQUIPO — R9a.
 *
 * Para cada rol: score = Σ entre quienes lo ejercen ( 1.0 si primario + 0.5 si
 * secundario ). Ese score por rol alimenta el polígono del radar de cobertura
 * de equipo; un valle = gap. Es un agregado de equipo (R6): NO compara personas
 * ni las ordena (R3).
 *
 * @typedef {import('../types.js').ContributionReading} ContributionReading
 * @typedef {import('../belbin.js').BelbinRole} BelbinRole
 */
import { BELBIN_ROLES, COVERAGE_WEIGHT } from '../belbin.js';

/**
 * @param {ContributionReading[]} contributions  Lectura de contribución ACTUAL de cada persona.
 * @param {ReadonlyArray<BelbinRole>} [roles]
 * @returns {Array<{ sigla: string, name: string, category: string, score: number }>}
 */
export function roleCoverage(contributions, roles = BELBIN_ROLES) {
  const list = Array.isArray(contributions) ? contributions : [];
  return roles.map((role) => {
    let score = 0;
    for (const c of list) {
      const strength = c?.roles?.[role.sigla];
      if (strength === 'primary') score += COVERAGE_WEIGHT.primary;
      else if (strength === 'secondary') score += COVERAGE_WEIGHT.secondary;
    }
    return { sigla: role.sigla, name: role.name, category: role.category, score };
  });
}

/**
 * Roles que el equipo NO cubre (score 0) — gaps de cobertura.
 * @param {ContributionReading[]} contributions
 * @param {ReadonlyArray<BelbinRole>} [roles]
 * @returns {Array<{ sigla: string, name: string }>}
 */
export function uncoveredRoles(contributions, roles = BELBIN_ROLES) {
  return roleCoverage(contributions, roles)
    .filter((r) => r.score === 0)
    .map((r) => ({ sigla: r.sigla, name: r.name }));
}
