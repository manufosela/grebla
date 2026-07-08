/**
 * Casos de uso de los PERIODOS de O2O (campañas, p. ej. «Periodo Julio 2026»).
 * Cada periodo vive bajo el líder con su guía/formulario EMBEBIDOS y editables.
 * Crear un periodo lo genera EN BLANCO (el O2O debe ser distinto cada vez): se
 * rellena a mano, importando un .md o, en el futuro, con IA.
 *
 * @typedef {import('../../domain/ports.js').O2OPersistence} O2OPersistence
 * @typedef {import('../../domain/types.js').O2OPeriod} O2OPeriod
 * @typedef {import('../../domain/types.js').O2OGuide} O2OGuide
 * @typedef {import('../../domain/types.js').PreO2OForm} PreO2OForm
 */

/** Guía/formulario en blanco para un periodo nuevo (versión 1, sin bloques). */
export function blankGuide() {
  return { version: 1, blocks: [] };
}
export function blankForm() {
  return { version: 1, intro: '', sections: [] };
}

/** Nombre propuesto «Periodo <mes> <año>» a partir de una fecha. */
export function defaultPeriodName(date = new Date()) {
  const month = new Intl.DateTimeFormat('es', { month: 'long' }).format(date);
  const capital = month.charAt(0).toUpperCase() + month.slice(1);
  return `Periodo ${capital} ${date.getFullYear()}`;
}

/**
 * Lista los periodos del líder (más recientes primero).
 * @param {O2OPersistence} persistence @returns {Promise<O2OPeriod[]>}
 */
export function listPeriods(persistence) {
  return persistence.periods.list();
}

/**
 * Lee un periodo (con su guía/formulario) o null.
 * @param {O2OPersistence} persistence @param {string} id @returns {Promise<O2OPeriod|null>}
 */
export function getPeriod(persistence, id) {
  return persistence.periods.get(id);
}

/**
 * Crea un periodo EN BLANCO (o con guía/form dados, p. ej. importados de .md).
 * @param {O2OPersistence} persistence @param {{ name?: string, guide?: O2OGuide, form?: PreO2OForm }} [input]
 * @returns {Promise<string>}
 */
export function createPeriod(persistence, input = {}) {
  const name = (input.name || defaultPeriodName()).trim();
  if (!name) throw new Error('El periodo necesita un nombre.');
  /** @type {O2OPeriod} */
  const period = {
    name,
    status: 'open',
    guide: input.guide ?? blankGuide(),
    form: input.form ?? blankForm(),
    createdAt: new Date().toISOString(),
  };
  return persistence.periods.create(period);
}

/**
 * Renombra un periodo.
 * @param {O2OPersistence} persistence @param {string} id @param {string} name @returns {Promise<void>}
 */
export async function renamePeriod(persistence, id, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('El periodo necesita un nombre.');
  return persistence.periods.update(id, { name: trimmed, updatedAt: new Date().toISOString() });
}

/**
 * Borra un periodo.
 * @param {O2OPersistence} persistence @param {string} id @returns {Promise<void>}
 */
export function removePeriod(persistence, id) {
  if (!id) throw new Error('Falta el id del periodo a borrar.');
  return persistence.periods.remove(id);
}

/**
 * Guarda la guía de un periodo (bump de versión). @returns {Promise<O2OGuide>} la guía guardada.
 * @param {O2OPersistence} persistence @param {string} periodId @param {O2OGuide} guide
 */
export async function savePeriodGuide(persistence, periodId, guide) {
  const next = { ...guide, version: (guide.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  await persistence.periods.update(periodId, { guide: next });
  return next;
}

/**
 * Guarda el formulario previo de un periodo (bump de versión). @returns {Promise<PreO2OForm>}
 * @param {O2OPersistence} persistence @param {string} periodId @param {PreO2OForm} form
 */
export async function savePeriodForm(persistence, periodId, form) {
  const next = { ...form, version: (form.version ?? 0) + 1, updatedAt: new Date().toISOString() };
  await persistence.periods.update(periodId, { form: next });
  return next;
}
