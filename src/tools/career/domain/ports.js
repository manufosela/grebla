/**
 * Puerto de persistencia del Mapa de Carrera. El journey es de la PERSONA del
 * equipo (no del uid del líder): vive en /people/{personId}/career/journey.
 *
 * @typedef {import('./types.js').Journey} Journey
 *
 * @typedef {Object} JourneyRepository
 * @property {(personId: string) => Promise<Journey|null>} get
 * @property {(personId: string, journey: Journey) => Promise<void>} save
 *
 * @typedef {Object} CareerStore
 * @property {JourneyRepository} journeys
 */

export {};
