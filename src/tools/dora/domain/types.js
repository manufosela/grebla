/**
 * Tipos del dominio DORA. La unidad de configuración es el repositorio a medir.
 * Las métricas (fases siguientes) son siempre de EQUIPO/agregadas, nunca por
 * persona. Equipos y gremios son catálogos "vivos": se escriben libres al asignar
 * un repo y se derivan como opciones de los repos ya configurados.
 *
 * @typedef {Object} DoraRepo
 * @property {string} id
 * @property {string} fullName   Identificador GitHub "owner/repo".
 * @property {string|null} [team] Equipo al que pertenece el repo.
 * @property {string[]} guilds    Gremios (cross-team) del repo.
 * @property {string} startDate   ISO date desde la que medir.
 * @property {string} [createdAt]
 */

/** Formato "owner/repo" (caracteres válidos de GitHub). */
const FULL_NAME_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/** @param {unknown} fullName */
export function isValidFullName(fullName) {
  return typeof fullName === 'string' && FULL_NAME_RE.test(fullName.trim());
}

export {};
