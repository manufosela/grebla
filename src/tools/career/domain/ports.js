/**
 * Puerto de persistencia del Mapa de Carrera. El journey es de la PERSONA del
 * equipo (no del uid del líder): vive en /people/{personId}/career/journey.
 * Los LOGROS con fecha (MC-21) viven al lado, en
 * /people/{personId}/career/achievements, y son de SOLO-AÑADIR: `save` fusiona
 * el parche sin pisar los registros existentes (semántica merge).
 *
 * @typedef {import('./types.js').Journey} Journey
 * @typedef {import('./achievements.js').Achievements} Achievements
 *
 * @typedef {Object} JourneyRepository
 * @property {(personId: string) => Promise<Journey|null>} get
 * @property {(personId: string, journey: Journey) => Promise<void>} save
 *
 * @typedef {Object} AchievementsRepository
 * @property {(personId: string) => Promise<Record<string, unknown>|null>} get
 * @property {(personId: string, patch: Achievements) => Promise<void>} save Fusiona (merge), nunca sobrescribe.
 *
 * @typedef {Object} CareerStore
 * @property {JourneyRepository} journeys
 * @property {AchievementsRepository} achievements
 */

export {};
