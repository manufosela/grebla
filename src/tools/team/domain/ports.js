/**
 * Puertos del dominio (hexagonal). El dominio define estas interfaces; la
 * infraestructura (Firestore, in-memory, file storage) las implementa y un
 * composition root inyecta la implementación. El dominio NUNCA importa Firebase.
 *
 * @typedef {import('./types.js').Person} Person
 * @typedef {import('./types.js').Area} Area
 * @typedef {import('./types.js').TeamRole} TeamRole
 * @typedef {import('./types.js').Conversation} Conversation
 * @typedef {import('./types.js').SupportNote} SupportNote
 * @typedef {import('./types.js').OrgSettings} OrgSettings
 *
 * @typedef {import('./types.js').SharePermission} SharePermission
 *
 * @typedef {Object} PeopleRepository
 * @property {() => Promise<Person[]>} list   Personas visibles para el líder: las suyas + las compartidas con él.
 * @property {(id: string) => Promise<Person|null>} getById
 * @property {(input: Omit<Person,'id'>) => Promise<string>} create
 * @property {(id: string, patch: Partial<Person>) => Promise<void>} update
 * @property {(id: string) => Promise<void>} deactivate
 * @property {(id: string, leaderUid: string, permission: SharePermission) => Promise<void>} share   Comparte la persona con otro líder.
 * @property {(id: string, leaderUid: string) => Promise<void>} unshare   Deja de compartir la persona con un líder.
 *
 * @typedef {Object} ReadingRepository   // genérico por dimensión (R1: una instancia por dimensión)
 * @property {(personId: string, payload: object) => Promise<string>} add
 * @property {(personId: string) => Promise<object[]>} listByPerson   // histórico asc por fecha (R2)
 * @property {(personId: string) => Promise<object|null>} latest      // estado actual = última lectura
 *
 * @typedef {Object} AreaRepository
 * @property {() => Promise<Area[]>} list
 * @property {(name: string) => Promise<string>} create
 * @property {(id: string) => Promise<void>} remove
 *
 * @typedef {Object} TeamRoleRepository   Catálogo de roles funcionales del equipo (mismo patrón que Area).
 * @property {() => Promise<TeamRole[]>} list
 * @property {(name: string) => Promise<string>} create
 * @property {(id: string) => Promise<void>} remove
 *
 * @typedef {Object} ConversationRepository
 * @property {(personId: string) => Promise<Conversation[]>} listByPerson
 * @property {(personId: string, input: Omit<Conversation,'id'>) => Promise<string>} create
 * @property {(personId: string, id: string, patch: Partial<Conversation>) => Promise<void>} update
 *
 * @typedef {Object} SupportNoteRepository   // R5: espacio separado, sin nivel
 * @property {(personId: string) => Promise<SupportNote[]>} listByPerson
 * @property {(personId: string, text: string) => Promise<string>} create
 * @property {(personId: string, id: string) => Promise<void>} remove
 *
 * @typedef {Object} ConfigRepository
 * @property {() => Promise<OrgSettings>} getSettings
 * @property {(patch: Partial<OrgSettings>) => Promise<void>} updateSettings
 *
 * @typedef {Object} FileStoragePort   // ficheros/audio — desactivable (H8)
 * @property {boolean} enabled
 * @property {(blob: Blob, meta: object) => Promise<import('./types.js').FileRef>} put
 * @property {(ref: string) => Promise<string>} getUrl
 * @property {(ref: string) => Promise<void>} remove
 *
 * @typedef {Object} PersistencePort   // agregado de repositorios inyectados
 * @property {PeopleRepository} people
 * @property {Record<'seniority'|'emotional'|'knowledge'|'contribution', ReadingRepository>} readings
 * @property {AreaRepository} areas
 * @property {TeamRoleRepository} teamRoles
 * @property {ConversationRepository} conversations
 * @property {SupportNoteRepository} supportNotes
 * @property {ConfigRepository} config
 */

export {};
