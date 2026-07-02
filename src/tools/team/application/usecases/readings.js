/**
 * Casos de uso de lecturas por dimensión (R1: las cuatro son independientes).
 * addReading valida la dimensión; getPersonTimeline devuelve el histórico de las
 * cuatro, añadiendo el valor numérico para series temporales en Seniority y
 * Emocional (R2: nivel = estado con fecha, tránsito = N+0.5).
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').DIMENSIONS} DIMENSIONS
 */
import { DIMENSIONS } from '../../domain/types.js';
import { levelToNumber } from '../../domain/levels.js';

/**
 * @param {PersistencePort} persistence
 * @param {'seniority'|'emotional'|'knowledge'|'contribution'} dimension
 * @param {string} personId
 * @param {object} payload
 * @returns {Promise<string>}
 */
export function addReading(persistence, dimension, personId, payload) {
  if (!DIMENSIONS.includes(dimension)) {
    throw new Error(`Dimensión desconocida: ${dimension}`);
  }
  // Firestore rechaza `undefined`: omite las claves sin valor (p. ej. una nota
  // vacía llega como undefined) para no romper la escritura de la lectura.
  const clean = Object.fromEntries(
    Object.entries(payload ?? {}).filter(([, value]) => value !== undefined),
  );
  return persistence.readings[dimension].add(personId, clean);
}

/**
 * Estado actual del usuario en una dimensión (última lectura).
 * @param {PersistencePort} persistence
 * @param {'seniority'|'emotional'|'knowledge'|'contribution'} dimension
 * @param {string} personId
 * @returns {Promise<object|null>}
 */
export function getCurrentReading(persistence, dimension, personId) {
  if (!DIMENSIONS.includes(dimension)) {
    throw new Error(`Dimensión desconocida: ${dimension}`);
  }
  return persistence.readings[dimension].latest(personId);
}

/** @param {{level?: number, toNext?: boolean}} r */
const withValue = (r) => ({ ...r, value: levelToNumber(r.level, r.toNext) });

/**
 * Histórico completo de una persona en las cuatro dimensiones.
 * @param {PersistencePort} persistence
 * @param {string} personId
 * @returns {Promise<{ seniority: object[], emotional: object[], knowledge: object[], contribution: object[] }>}
 */
export async function getPersonTimeline(persistence, personId) {
  const [seniority, emotional, knowledge, contribution] = await Promise.all([
    persistence.readings.seniority.listByPerson(personId),
    persistence.readings.emotional.listByPerson(personId),
    persistence.readings.knowledge.listByPerson(personId),
    persistence.readings.contribution.listByPerson(personId),
  ]);
  return {
    seniority: seniority.map(withValue),
    emotional: emotional.map(withValue),
    // Conocimiento va por área: el valor numérico se deriva en la vista por área.
    knowledge,
    contribution,
  };
}
