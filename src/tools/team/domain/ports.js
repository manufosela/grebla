/**
 * Puertos del dominio (hexagonal). El dominio define estas interfaces; la
 * infraestructura (Firestore, in-memory, file storage) las implementa y un
 * composition root inyecta la implementación. El dominio NUNCA importa Firebase.
 *
 * @typedef {import('./types.js').Person} Person
 * @typedef {import('./types.js').Area} Area
 * @typedef {import('./types.js').Guild} Guild
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
 * @property {(id: string) => Promise<void>} reactivate   Restaura una baja (active:true, sin deactivatedAt).
 * @property {(id: string, leaderUid: string, permission: SharePermission) => Promise<void>} share   Comparte la persona con otro líder.
 * @property {(id: string, leaderUid: string) => Promise<void>} unshare   Deja de compartir la persona con un líder.
 * @property {(id: string, newLeaderUid: string) => Promise<void>} transfer   Transfiere la propiedad a otro líder (total).
 *
 * @typedef {Object} ReadingRepository   // genérico por dimensión (R1: una instancia por dimensión)
 * @property {(personId: string, payload: object) => Promise<string>} add
 * @property {(personId: string) => Promise<object[]>} listByPerson   // histórico asc por fecha (R2)
 * @property {(personId: string) => Promise<object|null>} latest      // estado actual = última lectura
 *
 * @typedef {Object} AreaRepository   Catálogo de áreas de conocimiento con ámbito (personal/global).
 * @property {() => Promise<Area[]>} list   Globales + las del líder (o TODAS si superadmin/viewAll).
 * @property {(name: string) => Promise<string>} create   Personal del líder, o GLOBAL si superadmin.
 * @property {(id: string, patch: Partial<Area>) => Promise<void>} update   Renombra un área.
 * @property {(id: string) => Promise<void>} remove
 * @property {(id: string) => Promise<void>} promote   Personal → global (quita ownerLeaderUid).
 *
 * @typedef {Object} GuildRepository   Catálogo de gremios con ámbito (personal/global).
 * @property {() => Promise<Guild[]>} list   Globales + los del líder (o TODAS si superadmin/viewAll).
 * @property {(name: string) => Promise<string>} create   Personal del líder, o GLOBAL si superadmin.
 * @property {(id: string, patch: Partial<Guild>) => Promise<void>} update   Renombra un gremio.
 * @property {(id: string) => Promise<void>} remove
 * @property {(id: string) => Promise<void>} promote   Personal → global (quita ownerLeaderUid).
 *
 * @typedef {import('./types.js').Label} Label
 * @typedef {Object} LabelRepository   Catálogo de labels con ámbito (mismo modelo que Guild).
 * @property {() => Promise<Label[]>} list   Globales + los del líder (o TODAS si superadmin/viewAll).
 * @property {(name: string, extra?: { subLabel?: string, color?: string }) => Promise<string>} create   Personal del líder, o GLOBAL si superadmin. `extra` (solo labels) fija subLabel/color al crear.
 * @property {(id: string, patch: Partial<Label>) => Promise<void>} update   Renombra un label o actualiza subLabel/color.
 * @property {(id: string) => Promise<void>} remove
 * @property {(id: string) => Promise<void>} promote   Personal → global (quita ownerLeaderUid).
 *
 * @typedef {Object} ConversationRepository
 * @property {(personId: string) => Promise<Conversation[]>} listByPerson
 * @property {(personId: string, input: Omit<Conversation,'id'>) => Promise<string>} create
 * @property {(personId: string, id: string, patch: Partial<Conversation>) => Promise<void>} update
 *
 * @typedef {Object} SupportNoteRepository   // R5: espacio separado, sin nivel
 * @property {(personId: string) => Promise<SupportNote[]>} listByPerson
 * @property {(personId: string, text: string, author?: { uid: string, name: string }) => Promise<string>} create
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
 * @property {GuildRepository} guilds
 * @property {LabelRepository} labels
 * @property {ConversationRepository} conversations
 * @property {SupportNoteRepository} supportNotes
 * @property {ConfigRepository} config
 */

export {};
