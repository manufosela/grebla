/**
 * Modo inverso de Role Mirror: dado un rol, genera las respuestas "tipo" de ese
 * rol a partir de los pesos de cada ítem. Sirve como punto de partida editable
 * (el usuario lo ajusta a su caso).
 *
 * Mapeo peso → respuesta:
 *  - escala 1-5: peso 2 → 5, peso 1 → 3, peso 0 → 1.
 *  - checkbox (gates): peso ≥ 1 → Sí (true), peso 0 → No (false). Esto activa la
 *    ramificación coherente con el rol.
 *  - selección múltiple: sin mapeo directo por peso → se deja sin marcar.
 *
 * @typedef {import('../data/items.js').Item} Item
 * @typedef {import('../data/items.js').Answers} Answers
 */

/** @param {0|1|2} weight */
function scaleFromWeight(weight) {
  if (weight >= 2) return 5;
  if (weight === 1) return 3;
  return 1;
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
    }
    // 'multi': sin mapeo por peso; se deja sin marcar para que el usuario elija.
  }
  return answers;
}
