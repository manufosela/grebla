/**
 * Puerto de persistencia del Mapa de Carrera. El journey es por usuario dentro de
 * su tenant.
 *
 * @typedef {import('./types.js').Journey} Journey
 *
 * @typedef {Object} JourneyRepository
 * @property {(uid: string) => Promise<Journey|null>} get
 * @property {(uid: string, journey: Journey) => Promise<void>} save
 *
 * @typedef {Object} CareerStore
 * @property {JourneyRepository} journeys
 */

export {};
