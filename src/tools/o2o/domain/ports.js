/**
 * Puertos (interfaces) de persistencia de la herramienta O2O. La UI importa los
 * casos de uso; nunca toca puertos ni adapters directamente.
 *
 * @typedef {import('./types.js').O2OGuide} O2OGuide
 * @typedef {import('./types.js').PreO2OForm} PreO2OForm
 *
 * @typedef {Object} GuideRepository
 * @property {(id: string) => Promise<O2OGuide|null>} get
 * @property {(id: string, guide: O2OGuide) => Promise<void>} save
 *
 * @typedef {Object} FormRepository
 * @property {(id: string) => Promise<PreO2OForm|null>} get
 * @property {(id: string, form: PreO2OForm) => Promise<void>} save
 *
 * @typedef {Object} O2OPersistence
 * @property {GuideRepository} guides
 * @property {FormRepository} forms
 */
