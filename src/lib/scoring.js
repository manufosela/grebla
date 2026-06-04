/**
 * Lógica de cálculo de perfil. Puro JS, sin DOM ni Firebase: testeable en aislado.
 *
 * @typedef {import('../data/roles.js').Role} Role
 * @typedef {import('../data/roles.js').RoleKey} RoleKey
 * @typedef {import('../data/items.js').Item} Item
 * @typedef {import('../data/items.js').Answers} Answers
 *
 * @typedef {Object} OrgConfig
 * @property {string} [phase] Fase/tamaño de la empresa (etiqueta informativa).
 * @property {Partial<Record<RoleKey, number>>} [roleMultipliers]
 *   Multiplicador aplicado al peso base de cada rol (p. ej. HoE pesa distinto
 *   en seed que en enterprise).
 * @property {Object<string, Partial<Record<RoleKey, 0|1|2>>>} [weightOverrides]
 *   Sobrescritura puntual del peso de un ítem para un rol: weightOverrides[itemId][roleKey].
 */
import { DIMENSIONS } from '../data/items.js';

/** @param {number} n @param {number} min @param {number} max */
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Normaliza la respuesta de un ítem al rango [0, 1].
 * @param {Item} item
 * @param {boolean|number|string[]|undefined} value
 * @returns {number}
 */
export function normalizeAnswer(item, value) {
  switch (item.type) {
    case 'checkbox':
      return value === true ? 1 : 0;
    case 'scale': {
      if (typeof value !== 'number' || Number.isNaN(value)) return 0;
      return (clamp(value, 1, 5) - 1) / 4;
    }
    case 'multi': {
      if (!Array.isArray(value) || !item.options || item.options.length === 0) return 0;
      return clamp(value.length / item.options.length, 0, 1);
    }
    default:
      return 0;
  }
}

/**
 * Indica si un ítem ha sido respondido por el usuario (tiene valor definido).
 * @param {Item} item
 * @param {Answers} answers
 * @returns {boolean}
 */
export function isAnswered(item, answers) {
  const value = answers[item.id];
  if (value === undefined || value === null) return false;
  if (item.type === 'multi') return Array.isArray(value) && value.length > 0;
  if (item.type === 'scale') return typeof value === 'number' && value >= 1;
  // checkbox: se considera respondido en cuanto la clave existe (true o false)
  return Object.prototype.hasOwnProperty.call(answers, item.id);
}

/**
 * Filtra los ítems visibles dado el estado de respuestas (ramificación).
 * @param {ReadonlyArray<Item>} items
 * @param {Answers} answers
 * @returns {Item[]}
 */
export function getVisibleItems(items, answers) {
  return items.filter((item) => typeof item.visibleWhen !== 'function' || item.visibleWhen(answers));
}

/**
 * Resuelve el peso efectivo de un ítem para un rol aplicando la config de org.
 * @param {Item} item
 * @param {RoleKey} roleKey
 * @param {OrgConfig} [orgConfig]
 * @returns {number}
 */
export function resolveWeight(item, roleKey, orgConfig) {
  const base = item.weights[roleKey] ?? 0;
  const override = orgConfig?.weightOverrides?.[item.id]?.[roleKey];
  if (override !== undefined && override !== null) return override;
  const mult = orgConfig?.roleMultipliers?.[roleKey];
  if (typeof mult === 'number') return base * mult;
  return base;
}

/**
 * @typedef {Object} RoleAffinity
 * @property {RoleKey} key
 * @property {string} label
 * @property {string} short
 * @property {string} color
 * @property {string} tagline
 * @property {number} affinity  Porcentaje 0-100.
 * @property {number} score     Suma ponderada obtenida.
 * @property {number} max       Suma ponderada máxima posible.
 */

/**
 * @typedef {Object} DimensionLevel
 * @property {string} key
 * @property {string} label
 * @property {number} level  Nivel medio del usuario en la dimensión, 0-100.
 * @property {number} count  Nº de ítems visibles de la dimensión.
 */

/**
 * @typedef {Object} Profile
 * @property {RoleAffinity[]} affinities  Ordenadas de mayor a menor afinidad.
 * @property {RoleAffinity|null} dominant Rol dominante (o null si sin datos).
 * @property {DimensionLevel[]} byDimension Mapa de competencias del usuario.
 * @property {number} completion  % de ítems visibles respondidos (0-100).
 */

/**
 * Calcula el perfil completo del usuario.
 * @param {Object} params
 * @param {ReadonlyArray<Item>} params.items
 * @param {ReadonlyArray<Role>} params.roles
 * @param {Answers} params.answers
 * @param {OrgConfig} [params.orgConfig]
 * @returns {Profile}
 */
export function computeProfile({ items, roles, answers, orgConfig }) {
  const visible = getVisibleItems(items, answers);

  /** @type {RoleAffinity[]} */
  const affinities = roles.map((role) => {
    let score = 0;
    let max = 0;
    for (const item of visible) {
      const weight = resolveWeight(item, role.key, orgConfig);
      if (weight <= 0) continue;
      score += normalizeAnswer(item, answers[item.id]) * weight;
      max += weight; // respuesta máxima normalizada = 1
    }
    const affinity = max > 0 ? (score / max) * 100 : 0;
    return {
      key: role.key,
      label: role.label,
      short: role.short,
      color: role.color,
      tagline: role.tagline,
      affinity,
      score,
      max,
    };
  });

  affinities.sort((a, b) => b.affinity - a.affinity);
  const dominant = affinities.length > 0 && affinities[0].max > 0 ? affinities[0] : null;

  const byDimension = computeDimensionLevels(visible, answers);
  const completion = computeCompletion(visible, answers);

  return { affinities, dominant, byDimension, completion };
}

/**
 * Nivel del usuario por dimensión (media de respuestas normalizadas, 0-100).
 * @param {ReadonlyArray<Item>} visibleItems
 * @param {Answers} answers
 * @returns {DimensionLevel[]}
 */
export function computeDimensionLevels(visibleItems, answers) {
  return DIMENSIONS.map(({ key, label }) => {
    const dimItems = visibleItems.filter((item) => item.dimension === key);
    if (dimItems.length === 0) return { key, label, level: 0, count: 0 };
    const sum = dimItems.reduce((acc, item) => acc + normalizeAnswer(item, answers[item.id]), 0);
    return { key, label, level: (sum / dimItems.length) * 100, count: dimItems.length };
  });
}

/**
 * Porcentaje de ítems visibles respondidos.
 * @param {ReadonlyArray<Item>} visibleItems
 * @param {Answers} answers
 * @returns {number}
 */
export function computeCompletion(visibleItems, answers) {
  if (visibleItems.length === 0) return 0;
  const answered = visibleItems.filter((item) => isAnswered(item, answers)).length;
  return (answered / visibleItems.length) * 100;
}

/**
 * Perfil ideal de un rol por dimensión (0-100), derivado de los pesos del rol.
 * Sirve de "perfil deseado" para calcular la brecha.
 * @param {ReadonlyArray<Item>} items
 * @param {RoleKey} roleKey
 * @param {OrgConfig} [orgConfig]
 * @returns {DimensionLevel[]}
 */
export function computeRoleIdeal(items, roleKey, orgConfig) {
  return DIMENSIONS.map(({ key, label }) => {
    const dimItems = items.filter((item) => item.dimension === key);
    if (dimItems.length === 0) return { key, label, level: 0, count: 0 };
    const sum = dimItems.reduce((acc, item) => acc + resolveWeight(item, roleKey, orgConfig), 0);
    // peso máximo por ítem = 2 → normalizamos a 0-100
    const level = (sum / (dimItems.length * 2)) * 100;
    return { key, label, level: clamp(level, 0, 100), count: dimItems.length };
  });
}

/**
 * @typedef {Object} DimensionGap
 * @property {string} key
 * @property {string} label
 * @property {number} user
 * @property {number} ideal
 * @property {number} gap  ideal - user (positivo = área a desarrollar).
 */

/**
 * Brecha entre el perfil actual del usuario y el ideal de un rol objetivo.
 * @param {DimensionLevel[]} userByDimension
 * @param {DimensionLevel[]} idealByDimension
 * @returns {DimensionGap[]}
 */
export function computeGap(userByDimension, idealByDimension) {
  const idealMap = new Map(idealByDimension.map((d) => [d.key, d.level]));
  return userByDimension.map((d) => {
    const ideal = idealMap.get(d.key) ?? 0;
    return { key: d.key, label: d.label, user: d.level, ideal, gap: ideal - d.level };
  });
}
