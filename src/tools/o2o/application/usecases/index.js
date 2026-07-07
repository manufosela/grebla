/**
 * API de la capa de aplicación de la herramienta O2O. La UI importa desde aquí.
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 * @typedef {import('../../domain/types.js').O2OGuide} O2OGuide
 * @typedef {import('../../domain/types.js').PreO2OForm} PreO2OForm
 */

/**
 * Lee la guía por id (o null si no existe aún).
 * @param {O2OPersistence} persistence @param {string} id @returns {Promise<O2OGuide|null>}
 */
export function getGuide(persistence, id) {
  return persistence.guides.get(id);
}

/**
 * Guarda la guía (incrementando su versión). Editable por el líder.
 * @param {O2OPersistence} persistence @param {string} id @param {O2OGuide} guide @returns {Promise<void>}
 */
export function saveGuide(persistence, id, guide) {
  const next = { ...guide, id, version: (guide.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  return persistence.guides.save(id, next);
}

/**
 * Lee el formulario previo por id (o null).
 * @param {O2OPersistence} persistence @param {string} id @returns {Promise<PreO2OForm|null>}
 */
export function getForm(persistence, id) {
  return persistence.forms.get(id);
}

/**
 * Guarda el formulario previo (incrementando su versión).
 * @param {O2OPersistence} persistence @param {string} id @param {PreO2OForm} form @returns {Promise<void>}
 */
export function saveForm(persistence, id, form) {
  const next = { ...form, id, version: (form.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  return persistence.forms.save(id, next);
}
