/**
 * Escala de 7 niveles GREBLA (orden ascendente, 4 grupos). Catálogo de datos:
 * añadir/renombrar no requiere tocar la lógica. Aplica a Seniority, Emocional
 * y al nivel por área de Conocimiento. Se admite TRÁNSITO entre niveles
 * adyacentes (`toNext`) como estado válido — no se fuerza asignación exacta.
 *
 * Colores: cálidos (bajos) → fríos (altos); Magister en plata (aspiracional,
 * "trasciende el espectro ordinario").
 *
 * @typedef {1|2|3|4|5|6|7} LevelValue
 * @typedef {Object} Level
 * @property {LevelValue} order
 * @property {string} key
 * @property {string} name
 * @property {string} color
 * @property {1|2|3|4} group
 * @property {string} groupName
 */

/** @type {ReadonlyArray<Level>} */
export const LEVELS = [
  { order: 1, key: 'tiro', name: 'Tiro', color: '#e5484d', group: 1, groupName: 'Ejecuta con guía' },
  { order: 2, key: 'novicius', name: 'Novicius', color: '#f76b15', group: 1, groupName: 'Ejecuta con guía' },
  { order: 3, key: 'peritus', name: 'Peritus', color: '#ffc53d', group: 2, groupName: 'Ejecuta con autonomía' },
  { order: 4, key: 'expertus', name: 'Expertus', color: '#46a758', group: 2, groupName: 'Ejecuta con autonomía' },
  { order: 5, key: 'veteranus', name: 'Veteranus', color: '#3b82f6', group: 3, groupName: 'Decide y anticipa' },
  { order: 6, key: 'primus', name: 'Primus', color: '#8b5cf6', group: 3, groupName: 'Decide y anticipa' },
  { order: 7, key: 'magister', name: 'Magister', color: '#c7ccd1', group: 4, groupName: 'Transforma' },
];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 7;

/** @type {Readonly<Record<number, Level>>} */
export const LEVEL_BY_ORDER = Object.freeze(Object.fromEntries(LEVELS.map((l) => [l.order, l])));

/**
 * Valor numérico de una lectura para series temporales / radar. El tránsito
 * "entre N y N+1" se representa como N + 0.5.
 * @param {number} level
 * @param {boolean} [toNext]
 * @returns {number}
 */
export function levelToNumber(level, toNext = false) {
  const base = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
  return toNext && base < MAX_LEVEL ? base + 0.5 : base;
}

/**
 * Etiqueta legible de una lectura, incluyendo el tránsito.
 * @param {number} level
 * @param {boolean} [toNext]
 * @returns {string}
 */
export function levelLabel(level, toNext = false) {
  const current = LEVEL_BY_ORDER[level];
  if (!current) return '—';
  if (!toNext || level >= MAX_LEVEL) return current.name;
  const next = LEVEL_BY_ORDER[level + 1];
  return `entre ${current.name} y ${next.name}`;
}
