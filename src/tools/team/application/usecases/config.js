/**
 * Casos de uso de la configuración de la organización (cadencia, umbral de bus
 * factor, flags de features). Sobre el ConfigRepository del puerto.
 *
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 * @typedef {import('../../domain/types.js').OrgSettings} OrgSettings
 */
import { MIN_LEVEL, MAX_LEVEL } from '../../domain/levels.js';

/**
 * @param {PersistencePort} persistence
 * @returns {Promise<OrgSettings>}
 */
export function getSettings(persistence) {
  return persistence.config.getSettings();
}

/**
 * Actualiza la configuración con validación explícita (sin fallbacks silenciosos).
 * @param {PersistencePort} persistence
 * @param {Partial<OrgSettings>} patch
 * @returns {Promise<void>}
 */
export function updateSettings(persistence, patch) {
  if (patch.cadenceDays !== undefined) {
    const n = Number(patch.cadenceDays);
    if (!Number.isInteger(n) || n <= 0) throw new Error('La cadencia debe ser un número de días positivo');
  }
  if (patch.busFactorMinLevel !== undefined) {
    const n = Number(patch.busFactorMinLevel);
    if (!Number.isInteger(n) || n < MIN_LEVEL || n > MAX_LEVEL) {
      throw new Error(`El umbral de bus factor debe estar entre ${MIN_LEVEL} y ${MAX_LEVEL}`);
    }
  }
  return persistence.config.updateSettings(patch);
}
