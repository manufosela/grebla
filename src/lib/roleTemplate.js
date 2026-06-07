/**
 * Modo inverso de Role Mirror: dado un rol, genera las respuestas "tipo" de ese
 * rol a partir de los pesos de cada ítem. Sirve como punto de partida editable
 * (el usuario lo ajusta a su caso). Está calibrado para reproducir el "patrón
 * ideal" del rol (ver scoring.js): así el rol elegido sale claramente dominante
 * y con afinidad alta (~90-98%).
 *
 * Mapeo peso → respuesta (espeja el patrón ideal peso/2 del scoring):
 *  - escala 1-5: peso 2 → 5, peso 1 → 3, peso 0 → 1.
 *  - checkbox (gates): peso ≥ 1 → Sí (true), peso 0 → No (false). Esto activa la
 *    ramificación coherente con el rol.
 *  - selección múltiple: si el rol tiene peso en el ítem, se marca la opción
 *    típica del rol; si no, se marca "No procede" (MULTI_NA). Así la completitud
 *    llega al 100% sin inventar alcance que el rol no tiene.
 *
 * @typedef {import('../data/items.js').Item} Item
 * @typedef {import('../data/items.js').Answers} Answers
 * @typedef {import('../data/roles.js').RoleKey} RoleKey
 */
import { MULTI_NA } from '../data/items.js';

/**
 * Opción típica de cada ítem de selección múltiple por rol. Solo afecta a la
 * presentación y al nivel por dimensión: para la afinidad el multi es binario.
 * @type {Record<string, Partial<Record<RoleKey, string>>>}
 */
const MULTI_ROLE_OPTION = {
  architecture_scope: {
    engineer: 'component',
    techLead: 'service',
    staff: 'cross',
    em: 'service',
    hoe: 'cross',
    vp: 'platform',
    cto: 'platform',
  },
  growth_aspiration: {
    engineer: 'depth',
    techLead: 'breadth',
    staff: 'breadth',
    em: 'people',
    hoe: 'strategy',
    vp: 'strategy',
    cto: 'strategy',
  },
};

/** @param {number} weight */
function scaleFromWeight(weight) {
  if (weight >= 2) return 5;
  if (weight === 1) return 3;
  return 1;
}

/**
 * Selección típica de un ítem multi para un rol. Si el rol no tiene peso en el
 * ítem, devuelve "No procede". Si lo tiene, la opción mapeada o la primera real.
 * @param {Item} item
 * @param {string} roleKey
 * @param {number} weight
 * @returns {string[]}
 */
function multiFromRole(item, roleKey, weight) {
  if (weight <= 0) return [MULTI_NA];
  const mapped = MULTI_ROLE_OPTION[item.id]?.[roleKey];
  const firstReal = item.options?.find((opt) => opt.value !== MULTI_NA)?.value;
  const choice = mapped ?? firstReal;
  return choice ? [choice] : [MULTI_NA];
}

/**
 * @param {string} roleKey
 * @param {ReadonlyArray<Item>} items
 * @returns {Answers}
 */
export function fillAnswersFromRole(roleKey, items) {
  /** @type {Answers} */
  const answers = {};
  if (!roleKey || !Array.isArray(items)) return answers;
  for (const item of items) {
    const weight = item.weights?.[roleKey] ?? 0;
    if (item.type === 'checkbox') {
      answers[item.id] = weight >= 1;
    } else if (item.type === 'scale') {
      answers[item.id] = scaleFromWeight(weight);
    } else if (item.type === 'multi') {
      answers[item.id] = multiFromRole(item, roleKey, weight);
    }
  }
  return answers;
}
