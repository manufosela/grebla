/**
 * Puerto de persistencia del Mapa de Carrera. El journey es de la PERSONA del
 * equipo (no del uid del líder): vive en /people/{personId}/career/journey.
 * Los LOGROS con fecha (MC-21) viven al lado, en
 * /people/{personId}/career/achievements, y son de SOLO-AÑADIR: `save` fusiona
 * el parche sin pisar los registros existentes (semántica merge).
 * Las CONSULTAS AL BRUJO (MC-22) también viven en el subárbol career:
 * /people/{personId}/career/wizard/questions/{questionId}, un doc por consulta.
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
 * Consultas al brujo (MC-22). Los repos son «tontos» (persisten lo que llega);
 * la composición de campos (status, fechas ISO, validación) vive en los casos
 * de uso. `markSeen` escribe SOLO { status, seenAt }: es la excepción de
 * escritura acotada del jugador vinculado en las reglas de Firestore.
 * @typedef {Object} QuestionsRepository
 * @property {(personId: string) => Promise<(Record<string, unknown> & { id: string })[]>} listByPerson
 * @property {(personId: string, question: Record<string, unknown>) => Promise<{ id: string }>} ask Crea la consulta y devuelve su id.
 * @property {(personId: string, questionId: string, patch: Record<string, unknown>) => Promise<void>} answer
 * @property {(personId: string, questionId: string, patch: { status: 'seen', seenAt: string }) => Promise<void>} markSeen
 *
 * Tiempo de juego (MC-23): /people/{personId}/career/playtime, un doc por
 * persona { totalMinutes, byDay: { 'YYYY-MM-DD': minutos } }. `increment`
 * suma minutos al total Y al día con semántica de incremento atómico
 * (increment() en Firestore: sin transacciones); `prune` borra días antiguos
 * (deleteField) — la política de poda vive en el dominio (staleDayKeys).
 * @typedef {Object} PlaytimeRepository
 * @property {(personId: string) => Promise<Record<string, unknown>|null>} get
 * @property {(personId: string, entry: { day: string, minutes: number }) => Promise<void>} increment
 * @property {(personId: string, days: string[]) => Promise<void>} prune
 *
 * @typedef {Object} CareerStore
 * @property {JourneyRepository} journeys
 * @property {AchievementsRepository} achievements
 * @property {QuestionsRepository} questions
 * @property {PlaytimeRepository} playtime
 */

export {};
