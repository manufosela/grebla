/**
 * Campos de la ficha que manda Notion en una instancia conectada (RMR-TSK-0588,
 * ADR -P1XxVvQPrufU13Bd4RF). Los escribe el importador y las reglas impiden que
 * el cliente los toque (firestore.rules · updatesNotionFields: misma lista; si
 * cambia allí, cambiar aquí). La interfaz los enseña en solo lectura. Puro.
 */
export const NOTION_FIELDS = Object.freeze([
  'name', 'email', 'pendingEmail', 'orgBranch', 'reportsToPersonId', 'startDate', 'external', 'notion',
]);

/** @param {string} field */
export const isNotionField = (field) => NOTION_FIELDS.includes(field);

/**
 * Apodo y Experience que trae Notion (RMR-TSK-0785), en una línea para la ficha.
 * Experience es la escala general de TRIBBU: complementa al nivel de carrera, no lo sustituye.
 * @param {{ nickname?: string|null, experience?: string|null }|undefined} notion
 */
export function tribbuProfile(notion) {
  const nickname = notion?.nickname?.trim();
  const experience = notion?.experience?.trim();
  return [nickname && `Apodo: ${nickname}`, experience && `Experience en TRIBBU: ${experience}`].filter(Boolean).join(' · ');
}

/**
 * El parche sin los campos de Notion si la instancia está conectada; tal cual si no.
 * @template {Record<string, unknown>} T
 * @param {T} patch @param {boolean} notionSync
 * @returns {Partial<T>}
 */
export function withoutNotionFields(patch, notionSync) {
  if (!notionSync) return patch;
  return Object.fromEntries(Object.entries(patch).filter(([field]) => !isNotionField(field)));
}
