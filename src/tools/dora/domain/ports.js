/**
 * Puertos del dominio DORA. El dominio define la interfaz; la infraestructura
 * (in-memory, Firestore) la implementa y el composition root la inyecta.
 *
 * @typedef {import('./types.js').DoraRepo} DoraRepo
 *
 * @typedef {Object} DoraRepoRepository
 * @property {() => Promise<DoraRepo[]>} list
 * @property {(input: Omit<DoraRepo,'id'>) => Promise<string>} add
 * @property {(id: string, patch: Partial<DoraRepo>) => Promise<void>} update
 * @property {(id: string) => Promise<void>} remove
 *
 * @typedef {Object} DoraPersistence
 * @property {DoraRepoRepository} repos
 */

export {};
