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
 * El parche sin los campos de Notion si la instancia está conectada; tal cual si no.
 * @template {Record<string, unknown>} T
 * @param {T} patch @param {boolean} notionSync
 * @returns {Partial<T>}
 */
export function withoutNotionFields(patch, notionSync) {
  if (!notionSync) return patch;
  return Object.fromEntries(Object.entries(patch).filter(([field]) => !isNotionField(field)));
}
