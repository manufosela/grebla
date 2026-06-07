/**
 * Implementación in-memory de ConfigRepository (ver domain/ports.js).
 * Parte de DEFAULT_SETTINGS y aplica patches superficiales (con merge de
 * `features`). Devuelve copias para no exponer el estado interno.
 *
 * @typedef {import('../../domain/types.js').OrgSettings} OrgSettings
 * @typedef {import('../../domain/ports.js').ConfigRepository} ConfigRepository
 */
import { DEFAULT_SETTINGS } from '../../domain/types.js';

/**
 * @param {Partial<OrgSettings>} [initial]
 * @returns {ConfigRepository}
 */
export function createMemoryConfigRepository(initial = {}) {
  /** @type {OrgSettings} */
  let settings = {
    ...DEFAULT_SETTINGS,
    ...initial,
    features: { ...DEFAULT_SETTINGS.features, ...(initial.features ?? {}) },
  };

  return {
    async getSettings() {
      return structuredClone(settings);
    },
    async updateSettings(patch) {
      settings = {
        ...settings,
        ...patch,
        features: { ...settings.features, ...(patch.features ?? {}) },
      };
    },
  };
}
