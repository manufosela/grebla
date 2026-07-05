/**
 * Casos de uso del Mapa de Carrera. El mapa es una isla de muestra (en código);
 * el journey es de la PERSONA del equipo y se persiste en su subárbol
 * (/people/{personId}/career/journey).
 *
 * @typedef {import('../domain/ports.js').CareerStore} CareerStore
 * @typedef {import('../domain/types.js').CareerMap} CareerMap
 * @typedef {import('../domain/types.js').Journey} Journey
 * @typedef {import('../domain/types.js').CityEvidence} CityEvidence
 * @typedef {import('../domain/achievements.js').Achievements} Achievements
 */
import { SAMPLE_MAPS, ISLAND } from '../data/maps.js';
import { EMPTY_JOURNEY, DEFAULT_ISLAND_ID } from '../domain/types.js';
import { mapPoints, totalPoints, progressPct, isReachable, reachableCityIds, levelFor } from '../domain/progress.js';
import { normalizeAchievements, mergeAchievements } from '../domain/achievements.js';
import { normalizeQuestion, sortQuestionsByDateDesc } from '../domain/wizard.js';
import { dayKey, normalizePlaytime, staleDayKeys } from '../domain/playtime.js';
import { normalizeChallenge } from '../domain/challenge.js';

/** @returns {ReadonlyArray<CareerMap>} */
export function getMaps() {
  return SAMPLE_MAPS;
}

/** @param {string} id @returns {CareerMap|null} */
export function getMap(id) {
  return SAMPLE_MAPS.find((m) => m.id === id) ?? null;
}

/**
 * Isla SEMILLA en código (fallback). En runtime el mapa se carga desde Firestore
 * con `getCareerMap()` (src/lib/careerMap.js); esta función expone la semilla para
 * los tests de dominio y como respaldo si no hay documento persistido.
 * @returns {CareerMap}
 */
export function getIslandMap() {
  return ISLAND;
}

/** Normaliza un journey persistido (o crea uno vacío) al modelo actual. @returns {Journey} */
function normalizeJourney(j) {
  if (!j) {
    return {
      ...EMPTY_JOURNEY,
      visitedCities: [],
      plannedRoute: [],
      visitedIslands: [DEFAULT_ISLAND_ID],
      evidences: {},
      challenge: null,
    };
  }
  const island = typeof j.currentIsland === 'string' ? j.currentIsland.trim() : '';
  const currentIsland = island || DEFAULT_ISLAND_ID;
  // Islas pisadas (MC-20): saneadas y sin duplicados. Migración suave de
  // journeys previos a MC-20: la isla actual siempre figura como pisada.
  const visitedIslands = [
    ...new Set(
      (Array.isArray(j.visitedIslands) ? j.visitedIslands : [])
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean),
    ),
  ];
  if (!visitedIslands.includes(currentIsland)) visitedIslands.push(currentIsland);
  return {
    visitedCities: [...(j.visitedCities ?? [])],
    currentCity: j.currentCity ?? null,
    plannedRoute: [...(j.plannedRoute ?? [])],
    // Journeys previos al archipiélago (MC-14) no traen isla: la de inicio.
    currentIsland,
    visitedIslands,
    evidences: { ...(j.evidences ?? {}) },
    // Reto activo del modo Reto (JG-5): saneado; corrupto o ausente → null
    // (modo Libre). Journeys previos a JG-5 no traen el campo.
    challenge: normalizeChallenge(j.challenge),
  };
}

/**
 * @param {CareerStore} store @param {string} personId
 * @returns {Promise<Journey>}
 */
export async function getJourney(store, personId) {
  return normalizeJourney(await store.journeys.get(personId));
}

/**
 * Marca/desmarca una ciudad como visitada. Para visitar exige que sea alcanzable
 * (y no esté deprecada).
 * @param {CareerStore} store @param {string} personId @param {CareerMap} map @param {Journey} journey @param {string} cityId
 */
export async function toggleVisited(store, personId, map, journey, cityId) {
  const visited = new Set(journey.visitedCities ?? []);
  if (visited.has(cityId)) {
    visited.delete(cityId);
  } else {
    if (!isReachable(map, cityId, journey.visitedCities)) {
      throw new Error('Casa bloqueada: visita antes sus prerequisitos.');
    }
    visited.add(cityId);
  }
  const next = { ...journey, visitedCities: [...visited] };
  await store.journeys.save(personId, next);
  return next;
}

/** @param {CareerStore} store @param {string} personId @param {Journey} journey @param {string|null} cityId */
export async function setCurrent(store, personId, journey, cityId) {
  const next = { ...journey, currentCity: cityId };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Viaja en barco a otra isla del archipiélago (MC-14): persiste la isla actual
 * en el journey GLOBAL de la persona y la registra como PISADA en
 * `visitedIslands` (MC-20, para el marcador 🏝️ del HUD). El viaje es libre
 * (sin gating); los prerequisitos siguen siendo por ciudad dentro de cada isla.
 * @param {CareerStore} store @param {string} personId @param {Journey} journey @param {string} islandId
 * @returns {Promise<Journey>}
 */
export async function setCurrentIsland(store, personId, journey, islandId) {
  const id = typeof islandId === 'string' ? islandId.trim() : '';
  if (!id) throw new Error('setCurrentIsland requiere el id de la isla de destino.');
  const visited = journey.visitedIslands ?? [];
  const next = {
    ...journey,
    currentIsland: id,
    visitedIslands: visited.includes(id) ? [...visited] : [...visited, id],
  };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Añade/quita una ciudad de la ruta planificada.
 * @param {CareerStore} store @param {string} personId @param {Journey} journey @param {string} cityId
 */
export async function toggleRoute(store, personId, journey, cityId) {
  const route = journey.plannedRoute ?? [];
  const next = {
    ...journey,
    plannedRoute: route.includes(cityId) ? route.filter((id) => id !== cityId) : [...route, cityId],
  };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Arranca un RETO (JG-5): persiste la ruta como reto activo del journey con la
 * fecha ISO del momento. La ruta llega generada del contenido
 * (challengeRouteForIsland); una ruta inválida falla en alto — un reto sin
 * paradas no es un reto. El reto anterior, si lo había, se sustituye.
 * @param {CareerStore} store @param {string} personId @param {Journey} journey
 * @param {import('../domain/types.js').Challenge} route Ruta del catálogo (startedAt se ignora).
 * @param {Date} [now] Reloj de referencia del arranque (por defecto, ahora).
 * @returns {Promise<Journey>}
 */
export async function startChallenge(store, personId, journey, route, now = new Date()) {
  const challenge = normalizeChallenge({ ...route, startedAt: now.toISOString() });
  if (!challenge) throw new Error('El reto requiere una ruta con isla y paradas.');
  const next = { ...journey, challenge };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Retira el reto activo (JG-5): abandono o completado, el journey vuelve al
 * modo Libre. Los certificados conseguidos se quedan (viven en
 * visitedCities): abandonar el camino no borra lo andado. Decisión JG-5: al
 * COMPLETAR también se limpia (challenge → null) en vez de guardar un
 * completedAt — el histórico de retos completados es YAGNI mientras no haya
 * UI que lo muestre, y los certificados ya son el registro real del logro.
 * @param {CareerStore} store @param {string} personId @param {Journey} journey
 * @returns {Promise<Journey>}
 */
export async function clearChallenge(store, personId, journey) {
  const next = { ...journey, challenge: null };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Guarda/actualiza las evidencias de una ciudad (experiencia previa, formaciones…).
 * @param {CareerStore} store @param {string} personId @param {Journey} journey @param {string} cityId @param {CityEvidence} evidence
 */
export async function setEvidence(store, personId, journey, cityId, evidence) {
  const next = {
    ...journey,
    evidences: { ...(journey.evidences ?? {}), [cityId]: { ...evidence } },
  };
  await store.journeys.save(personId, next);
  return next;
}

/**
 * Logros persistentes de la persona (MC-21), normalizados. Sin documento
 * todavía devuelve logros vacíos (jugador sin nada registrado).
 * @param {CareerStore} store @param {string} personId
 * @returns {Promise<Achievements>}
 */
export async function getAchievements(store, personId) {
  return normalizeAchievements(await store.achievements.get(personId));
}

/**
 * Registra un parche de logros (MC-21, solo-añadir): lo persiste con semántica
 * merge (los registros existentes no se pisan) y devuelve los achievements
 * fusionados para el estado local. Con parche null no escribe nada.
 * @param {CareerStore} store @param {string} personId
 * @param {Achievements} achievements Logros actuales en memoria.
 * @param {Achievements|null} patch Parche de newAchievements (o null).
 * @returns {Promise<Achievements>}
 */
export async function recordAchievements(store, personId, achievements, patch) {
  if (!patch) return achievements;
  await store.achievements.save(personId, patch);
  return mergeAchievements(achievements, patch);
}

// ---- Consultas al brujo (MC-22) ---------------------------------------------

/** @typedef {import('../domain/wizard.js').WizardQuestion} WizardQuestion */
/** @typedef {import('../domain/wizard.js').QuestionAuthor} QuestionAuthor */

/** @param {unknown} value @param {string} field @returns {string} */
function requireText(value, field) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`La consulta al brujo requiere ${field}.`);
  return text;
}

/**
 * Consultas al brujo de la persona, normalizadas y ordenadas por fecha
 * descendente (todas las islas: la ficha del jugador las lista completas; el
 * panel de cada brujo filtra por su isla).
 * @param {CareerStore} store @param {string} personId
 * @returns {Promise<WizardQuestion[]>}
 */
export async function listQuestions(store, personId) {
  const raw = await store.questions.listByPerson(personId);
  return sortQuestionsByDateDesc(raw.map((q) => normalizeQuestion(q)));
}

/**
 * Deja una consulta en la cabaña del brujo de una isla: nace 'pending' con la
 * fecha ISO del momento y, si hay login con uid, la autoría (como las notas
 * del tool Equipo: sin uid no se registra autoría — degradación con gracia).
 * @param {CareerStore} store @param {string} personId
 * @param {{ islandId: string, islandName?: string, text: string, createdBy?: QuestionAuthor }} input
 * @returns {Promise<WizardQuestion>} La consulta creada, normalizada.
 */
export async function askQuestion(store, personId, { islandId, islandName, text, createdBy }) {
  requireText(personId, 'la persona (personId)');
  /** @type {Record<string, unknown>} */
  const question = {
    islandId: requireText(islandId, 'la isla (islandId)'),
    islandName: typeof islandName === 'string' ? islandName.trim() : '',
    text: requireText(text, 'el texto de la pregunta'),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  if (createdBy?.uid && createdBy?.name) {
    question.createdBy = { uid: createdBy.uid, name: createdBy.name };
  }
  const { id } = await store.questions.ask(personId, question);
  return normalizeQuestion({ id, ...question });
}

/**
 * Responde una consulta (el líder, desde su cola): pasa a 'answered' con la
 * respuesta, la fecha ISO y la autoría del que responde. `creditedTo` registra
 * al developer que ayudó cuando el líder derivó la duda fuera (la derivación
 * v1 es informativa: el líder recoge la respuesta del compañero).
 * @param {CareerStore} store @param {string} personId @param {string} questionId
 * @param {{ answer: string, answeredBy?: QuestionAuthor, creditedTo?: string }} input
 * @returns {Promise<{ status: 'answered', answer: string, answeredAt: string }>} El parche aplicado.
 */
export async function answerQuestion(store, personId, questionId, { answer, answeredBy, creditedTo }) {
  requireText(personId, 'la persona (personId)');
  requireText(questionId, 'el id de la consulta');
  /** @type {Record<string, unknown>} */
  const patch = {
    status: 'answered',
    answer: requireText(answer, 'el texto de la respuesta'),
    answeredAt: new Date().toISOString(),
  };
  if (answeredBy?.uid && answeredBy?.name) {
    patch.answeredBy = { uid: answeredBy.uid, name: answeredBy.name };
  }
  const credited = typeof creditedTo === 'string' ? creditedTo.trim() : '';
  if (credited) patch.creditedTo = credited;
  await store.questions.answer(personId, questionId, patch);
  return /** @type {{ status: 'answered', answer: string, answeredAt: string }} */ (patch);
}

/**
 * Marca una respuesta como VISTA (el jugador leyó al brujo): escribe SOLO
 * { status: 'seen', seenAt } — la máscara exacta que la excepción de reglas
 * permite al jugador vinculado. La cabaña vuelve a su estado de reposo.
 * @param {CareerStore} store @param {string} personId @param {string} questionId
 * @returns {Promise<{ status: 'seen', seenAt: string }>} El parche aplicado.
 */
export async function markQuestionSeen(store, personId, questionId) {
  requireText(personId, 'la persona (personId)');
  requireText(questionId, 'el id de la consulta');
  const patch = /** @type {{ status: 'seen', seenAt: string }} */ ({
    status: 'seen',
    seenAt: new Date().toISOString(),
  });
  await store.questions.markSeen(personId, questionId, patch);
  return patch;
}

// ---- Tiempo de juego (MC-23) --------------------------------------------------

/** @typedef {import('../domain/playtime.js').Playtime} Playtime */

/** @param {unknown} personId @returns {string} */
function requirePerson(personId) {
  const id = typeof personId === 'string' ? personId.trim() : '';
  if (!id) throw new Error('El tiempo de juego requiere la persona (personId).');
  return id;
}

/**
 * Tiempo de juego registrado de la persona, normalizado. Sin documento todavía
 * devuelve el playtime vacío (persona que aún no jugó).
 * @param {CareerStore} store @param {string} personId
 * @returns {Promise<Playtime>}
 */
export async function getPlaytime(store, personId) {
  requirePerson(personId);
  return normalizePlaytime(await store.playtime.get(personId));
}

/**
 * Vuelca minutos de juego al registro de la persona (MC-23): incremento
 * atómico del total Y del día LOCAL de `now` (increment() en la persistencia:
 * sin leer-modificar-escribir). Falla en alto con minutos no positivos — el
 * tracker no debe volcar ruido.
 * @param {CareerStore} store @param {string} personId
 * @param {number} minutes Minutos a sumar (> 0).
 * @param {Date} [now] Reloj de referencia del día (por defecto, ahora).
 * @returns {Promise<{ day: string, minutes: number }>} El incremento aplicado.
 */
export async function recordPlaytime(store, personId, minutes, now = new Date()) {
  requirePerson(personId);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error(`Minutos de juego inválidos para recordPlaytime: "${minutes}"`);
  }
  const day = dayKey(now);
  await store.playtime.increment(personId, { day, minutes });
  return { day, minutes };
}

/**
 * Poda del histórico por día (MC-23): si byDay supera el umbral
 * (PLAYTIME.pruneThreshold) borra los días más antiguos dejando los últimos
 * PLAYTIME.maxDays, y devuelve el playtime ya podado para el estado local.
 * Sin nada que podar no escribe (y devuelve el mismo objeto).
 * @param {CareerStore} store @param {string} personId @param {Playtime} playtime
 * @returns {Promise<Playtime>}
 */
export async function prunePlaytime(store, personId, playtime) {
  requirePerson(personId);
  const stale = staleDayKeys(playtime.byDay);
  if (stale.length === 0) return playtime;
  await store.playtime.prune(personId, stale);
  const gone = new Set(stale);
  return {
    ...playtime,
    byDay: Object.fromEntries(Object.entries(playtime.byDay).filter(([day]) => !gone.has(day))),
  };
}

/**
 * Estadísticas de gamificación del journey en su mapa.
 * @param {CareerMap} map @param {Journey} journey
 */
export function stats(map, journey) {
  const visited = journey?.visitedCities ?? [];
  const pct = progressPct(map, visited);
  return {
    points: mapPoints(map, visited),
    total: totalPoints(map),
    pct,
    level: levelFor(pct),
    reachable: reachableCityIds(map, visited),
  };
}
