/**
 * Puertos (interfaces) de la persistencia LEAN. Las unidades de flujo (equipos =
 * label del grupo Squad, gremios = grupo Chapter) viven a nivel de instancia con
 * `ownerLeaderUid`.
 *
 * @typedef {import('./types.js').LeanUnit} LeanUnit
 *
 * @typedef {Object} LeanUnitRepository
 * @property {() => Promise<LeanUnit[]>} list   Del líder (o TODAS si superadmin/viewAll).
 * @property {(input: Omit<LeanUnit, 'id'>) => Promise<string>} add
 * @property {(id: string, patch: Partial<LeanUnit>) => Promise<void>} update
 * @property {(id: string) => Promise<void>} remove
 *
 * @typedef {Object} LeanPersistence
 * @property {LeanUnitRepository} units
 */
