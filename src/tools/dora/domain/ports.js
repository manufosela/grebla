/**
 * Puertos del dominio DORA. El dominio define la interfaz; la infraestructura
 * (in-memory, Firestore) la implementa y el composition root la inyecta.
 *
 * @typedef {import('./types.js').DoraRepo} DoraRepo
 * @typedef {import('./types.js').Deployment} Deployment
 * @typedef {import('./types.js').Incident} Incident
 *
 * @typedef {Object} DoraRepoRepository
 * @property {() => Promise<DoraRepo[]>} list
 * @property {(input: Omit<DoraRepo,'id'>) => Promise<string>} add
 * @property {(id: string, patch: Partial<DoraRepo>) => Promise<void>} update
 * @property {(id: string) => Promise<void>} remove
 *
 * @typedef {Object} DoraDeploymentRepository
 * @property {(repoId: string, event: Omit<Deployment,'id'>) => Promise<string>} add
 * @property {(repoId: string) => Promise<Deployment[]>} listByRepo   Ordenados por `at` desc.
 * @property {(repoId: string, id: string) => Promise<void>} remove
 *
 * @typedef {Object} DoraIncidentRepository
 * @property {(repoId: string, incident: Omit<Incident,'id'>) => Promise<string>} add
 * @property {(repoId: string) => Promise<Incident[]>} listByRepo   Ordenados por `startedAt` desc.
 * @property {(repoId: string, id: string, patch: Partial<Incident>) => Promise<void>} update
 * @property {(repoId: string, id: string) => Promise<void>} remove
 *
 * @typedef {Object} DoraPersistence
 * @property {DoraRepoRepository} repos
 * @property {DoraDeploymentRepository} deployments
 * @property {DoraIncidentRepository} incidents
 */

export {};
