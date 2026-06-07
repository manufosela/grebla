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
import { DIMENSIONS, MULTI_NA } from '../data/items.js';

/** @param {number} n @param {number} min @param {number} max */
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Indica si la respuesta de un ítem de selección múltiple es "No procede": el
 * usuario ha marcado únicamente la opción reservada `MULTI_NA`. En ese caso el
 * ítem se considera respondido (no penaliza la completitud) pero queda fuera del
 * cálculo de afinidad y de la media por dimensión: lo que no aplica no puntúa.
 * @param {boolean|number|string[]|undefined} value
 * @returns {boolean}
 */
export function isNotApplicable(value) {
  return Array.isArray(value) && value.length > 0 && value.every((v) => v === MULTI_NA);
}

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
      // Las opciones de un multi no llevan peso por rol: no miden intensidad sino
      // alcance. Por eso es binario — tener alcance en algún ámbito real cuenta
      // como respuesta plena del ítem. "No procede" (solo MULTI_NA) no es alcance.
      const real = value.filter((v) => v !== MULTI_NA);
      return real.length > 0 ? 1 : 0;
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
 * @property {number} affinity  Porcentaje 0-100 (similitud con el patrón del rol).
 * @property {number} match     Similitud 0-1 (1 = patrón idéntico al del rol).
 * @property {number} considered Nº de ítems comparados (relevantes para el rol o el usuario).
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
    // Afinidad por similitud de patrón: comparamos la respuesta del usuario con
    // el "patrón ideal" del rol (peso/2 ∈ [0,1]) en cada ítem. Penaliza tanto
    // quedarse corto donde el rol exige como puntuar alto donde el rol NO pone
    // foco. Así un perfil senior maximizado no se confunde con el rol junior que
    // engloba: el ideal del junior es 0 justo donde el senior puntúa alto, por lo
    // que el patrón diverge y la afinidad con el junior baja.
    let err = 0;
    let considered = 0;
    for (const item of visible) {
      if (isNotApplicable(answers[item.id])) continue; // "No procede": fuera del cálculo.
      const ideal = clamp(resolveWeight(item, role.key, orgConfig) / 2, 0, 1);
      const user = normalizeAnswer(item, answers[item.id]);
      if (ideal === 0 && user === 0) continue; // ítem irrelevante para rol y usuario.
      err += Math.abs(user - ideal);
      considered += 1;
    }
    const match = considered > 0 ? 1 - err / considered : 0;
    return {
      key: role.key,
      label: role.label,
      short: role.short,
      color: role.color,
      tagline: role.tagline,
      affinity: clamp(match * 100, 0, 100),
      match,
      considered,
    };
  });

  affinities.sort((a, b) => b.affinity - a.affinity);
  // Hay rol dominante solo si el usuario ha respondido algo (si no, todo es 0).
  const answered = visible.some((item) => isAnswered(item, answers));
  const dominant =
    answered && affinities.length > 0 && affinities[0].considered > 0 ? affinities[0] : null;

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
    // Los ítems "No procede" no cuentan en el nivel de la dimensión.
    const dimItems = visibleItems.filter(
      (item) => item.dimension === key && !isNotApplicable(answers[item.id]),
    );
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
