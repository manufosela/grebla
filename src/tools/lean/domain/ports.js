/**
 * Puertos (interfaces) de la persistencia LEAN. Espeja el patrón de DORA: los
 * equipos de Linear monitorizados viven a nivel de instancia con `ownerLeaderUid`.
 *
 * @typedef {import('./types.js').LeanTeam} LeanTeam
 *
 * @typedef {Object} LeanTeamRepository
 * @property {() => Promise<LeanTeam[]>} list   Del líder (o TODOS si superadmin/viewAll).
 * @property {(input: Omit<LeanTeam, 'id'>) => Promise<string>} add
 * @property {(id: string, patch: Partial<LeanTeam>) => Promise<void>} update
 * @property {(id: string) => Promise<void>} remove
 *
 * @typedef {Object} LeanPersistence
 * @property {LeanTeamRepository} teams
 */
