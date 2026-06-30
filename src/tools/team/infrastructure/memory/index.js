/**
 * Composición in-memory del puerto de persistencia (PersistencePort). Agrega un
 * repositorio por agregado y una instancia de ReadingRepository por cada una de
 * las cuatro dimensiones independientes (R1). Mismas interfaces que el adapter
 * Firestore: cambiar de uno a otro no toca dominio ni casos de uso.
 *
 * @typedef {import('../../domain/types.js').Person} Person
 * @typedef {import('../../domain/types.js').Area} Area
 * @typedef {import('../../domain/types.js').TeamRole} TeamRole
 * @typedef {import('../../domain/types.js').OrgSettings} OrgSettings
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 */
import { DIMENSIONS } from '../../domain/types.js';
import { createMemoryPeopleRepository } from './peopleRepository.js';
import { createMemoryReadingRepository } from './readingRepository.js';
import { createMemoryAreaRepository } from './areaRepository.js';
import { createMemoryTeamRoleRepository } from './teamRoleRepository.js';
import { createMemoryLabelRepository } from './labelRepository.js';
import { createMemoryConversationRepository } from './conversationRepository.js';
import { createMemorySupportNoteRepository } from './supportNoteRepository.js';
import { createMemoryConfigRepository } from './configRepository.js';

export { createMemoryPeopleRepository } from './peopleRepository.js';
export { createMemoryReadingRepository } from './readingRepository.js';
export { createMemoryAreaRepository } from './areaRepository.js';
export { createMemoryTeamRoleRepository } from './teamRoleRepository.js';
export { createMemoryLabelRepository } from './labelRepository.js';
export { createMemoryConversationRepository } from './conversationRepository.js';
export { createMemorySupportNoteRepository } from './supportNoteRepository.js';
export { createMemoryConfigRepository } from './configRepository.js';

/**
 * @param {{ people?: Person[], areas?: Area[], teamRoles?: TeamRole[], settings?: Partial<OrgSettings> }} [seed]
 * @returns {PersistencePort}
 */
export function createMemoryPersistence(seed = {}) {
  const readings = /** @type {PersistencePort['readings']} */ (
    Object.fromEntries(DIMENSIONS.map((dim) => [dim, createMemoryReadingRepository()]))
  );

  return {
    people: createMemoryPeopleRepository(seed.people),
    readings,
    areas: createMemoryAreaRepository(seed.areas),
    teamRoles: createMemoryTeamRoleRepository(seed.teamRoles),
    labels: createMemoryLabelRepository(seed.labels),
    conversations: createMemoryConversationRepository(),
    supportNotes: createMemorySupportNoteRepository(),
    config: createMemoryConfigRepository(seed.settings),
  };
}
