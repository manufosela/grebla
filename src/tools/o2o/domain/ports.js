/**
 * Puertos (interfaces) de persistencia de la herramienta O2O. La UI importa los
 * casos de uso; nunca toca puertos ni adapters directamente.
 *
 * @typedef {import('./types.js').O2OGuide} O2OGuide
 * @typedef {import('./types.js').PreO2OForm} PreO2OForm
 * @typedef {import('./types.js').O2OSession} O2OSession
 * @typedef {import('./types.js').O2OAction} O2OAction
 *
 * @typedef {Object} GuideRepository
 * @property {(id: string) => Promise<O2OGuide|null>} get
 * @property {(id: string, guide: O2OGuide) => Promise<void>} save
 *
 * @typedef {Object} FormRepository
 * @property {(id: string) => Promise<PreO2OForm|null>} get
 * @property {(id: string, form: PreO2OForm) => Promise<void>} save
 *
 * Sesiones de O2O del líder actual (el path ya está acotado a su uid en el
 * adapter Firestore; en memoria es un almacén plano filtrable por persona).
 * @typedef {Object} SessionRepository
 * @property {(personId: string) => Promise<O2OSession[]>} listByPerson
 * @property {() => Promise<O2OSession[]>} list
 * @property {(id: string) => Promise<O2OSession|null>} get
 * @property {(input: O2OSession) => Promise<string>} create
 * @property {(id: string, patch: Partial<O2OSession>) => Promise<void>} update
 * @property {(id: string) => Promise<void>} remove
 *
 * Acciones colgadas de la persona (heredan sus reglas; el ingeniero las ve).
 * @typedef {Object} ActionRepository
 * @property {(personId: string) => Promise<O2OAction[]>} listByPerson
 * @property {(personId: string, input: O2OAction) => Promise<string>} create
 * @property {(personId: string, id: string, patch: Partial<O2OAction>) => Promise<void>} update
 * @property {(personId: string, id: string) => Promise<void>} remove
 *
 * @typedef {Object} O2OPersistence
 * @property {GuideRepository} guides
 * @property {FormRepository} forms
 * @property {SessionRepository} sessions
 * @property {ActionRepository} actions
 */
