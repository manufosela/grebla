/**
 * Bus factor por área de conocimiento.
 *
 * Para cada área: nº de personas DISTINTAS que la cubren con nivel ≥ umbral
 * (default Peritus=3). Riesgo si el área la cubren menos de 2 personas
 * (bus factor 0 = nadie, o 1 = una sola persona). Agregado de equipo (R6),
 * no compara personas (R3).
 *
 * @typedef {Object} KnowledgeCoverageEntry
 * @property {string} personId
 * @property {string} areaId
 * @property {number} level
 */

/**
 * @param {KnowledgeCoverageEntry[]} coverage  Cobertura ACTUAL (última lectura por persona+área).
 * @param {Object} [opts]
 * @param {number} [opts.minLevel=3]           Umbral de dominio para contar.
 * @param {string[]} [opts.areaIds]            Áreas a incluir (para mostrar las de cobertura 0).
 * @returns {Array<{ areaId: string, count: number, atRisk: boolean }>}
 */
export function busFactor(coverage, opts = {}) {
  const { minLevel = 3, areaIds = null } = opts;
  const list = Array.isArray(coverage) ? coverage : [];

  /** @type {Map<string, Set<string>>} areaId → set de personId que cumplen el umbral */
  const byArea = new Map();
  const ensure = (areaId) => {
    if (!byArea.has(areaId)) byArea.set(areaId, new Set());
    return byArea.get(areaId);
  };

  if (Array.isArray(areaIds)) for (const a of areaIds) ensure(a);

  for (const entry of list) {
    if (!entry || entry.areaId == null) continue;
    if (typeof entry.level === 'number' && entry.level >= minLevel) {
      ensure(entry.areaId).add(entry.personId);
    } else {
      ensure(entry.areaId); // el área existe aunque nadie alcance el umbral
    }
  }

  return [...byArea.entries()].map(([areaId, people]) => ({
    areaId,
    count: people.size,
    atRisk: people.size < 2,
  }));
}

/**
 * Áreas en riesgo (bus factor < 2).
 * @param {KnowledgeCoverageEntry[]} coverage
 * @param {Object} [opts]
 * @returns {Array<{ areaId: string, count: number, atRisk: boolean }>}
 */
export function areasAtRisk(coverage, opts = {}) {
  return busFactor(coverage, opts).filter((a) => a.atRisk);
}
