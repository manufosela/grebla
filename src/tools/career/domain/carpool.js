/**
 * Carpool de formación (CP-1): un grupo con NOMBRE recorre junto una RUTA de
 * paradas (ciudades del archipiélago, en orden, con tiempo objetivo opcional
 * por parada). Alguien lo crea (queda como CONDUCTOR y primer miembro), otros
 * se UNEN mientras haya plaza, y el grupo ve el avance de cada miembro por
 * parada — derivado del journey de cada uno (una parada está completada por un
 * miembro si su journey tiene esa ciudad en visitedCities). Nada se castiga:
 * una parada con tiempo objetivo pasado y sin completar solo se marca
 * 'delayed' (visual).
 *
 * Módulo PURO (sin Firebase): normalización del documento, aforo, unión y
 * progreso son testeables sin IO. La persistencia vive en src/lib/carpools.js.
 *
 * @typedef {import('./types.js').Journey} Journey
 * @typedef {import('./types.js').CareerMap} CareerMap
 *
 * @typedef {'open'|'full'|'completed'|'closed'} CarpoolStatus
 *
 * @typedef {Object} CarpoolStop   Parada de la ruta del grupo
 * @property {string} cityId
 * @property {string} islandId
 * @property {string} islandName
 * @property {string} cityName
 * @property {string|null} targetDate  Tiempo objetivo 'YYYY-MM-DD' (o null)
 *
 * @typedef {Object} CarpoolMember
 * @property {string} personId
 * @property {string} name
 * @property {string|null} joinedAt   ISO de la unión (null en docs legados)
 *
 * @typedef {Object} Carpool
 * @property {string} id
 * @property {string} name
 * @property {CarpoolStatus} status
 * @property {number} seats                          Plazas totales (incluye al conductor)
 * @property {{ personId: string, name: string }} conductor
 * @property {CarpoolMember[]} members               Incluye al conductor
 * @property {string[]} memberIds                    Espejo de members[].personId (consultas array-contains)
 * @property {CarpoolStop[]} route                   Paradas en orden (pueden cruzar islas)
 * @property {string|null} createdAt                 ISO de creación (o null)
 * @property {{ uid: string, name: string }|null} createdBy
 *
 * Estado de una parada para UN miembro:
 * @typedef {'done'|'pending'|'delayed'} CarpoolStopState
 *
 * @typedef {Object} CarpoolMemberProgress
 * @property {string} personId
 * @property {string} name
 * @property {number} completed   Paradas completadas por este miembro
 * @property {number} total       Paradas de la ruta
 * @property {number} pct         % redondeado (0 con ruta vacía)
 * @property {boolean} done       true si completó TODAS las paradas
 *
 * @typedef {Object} CarpoolStopProgress
 * @property {CarpoolStop} stop
 * @property {string[]} completedBy                       personIds que ya la tienen
 * @property {boolean} allDone                            Todos los miembros la completaron
 * @property {boolean} delayed                            targetDate pasada y NO completada por todos
 * @property {Record<string, CarpoolStopState>} states    Estado por personId
 *
 * @typedef {Object} CarpoolProgress
 * @property {CarpoolMemberProgress[]} members
 * @property {CarpoolStopProgress[]} stops
 * @property {boolean} completed   Todos los miembros completaron todas las paradas
 */

/** Estados válidos de un carpool. @type {ReadonlyArray<CarpoolStatus>} */
export const CARPOOL_STATUSES = Object.freeze(['open', 'full', 'completed', 'closed']);

/** Plazas por defecto de un carpool (incluye al conductor). */
export const DEFAULT_CARPOOL_SEATS = 5;

/** Aforo mínimo y máximo de un carpool (el conductor cuenta como plaza). */
export const MIN_CARPOOL_SEATS = 2;
export const MAX_CARPOOL_SEATS = 12;

/**
 * Día local en formato 'YYYY-MM-DD' (para comparar con targetDate). El locale
 * sueco produce exactamente ISO-8601 con la fecha LOCAL (no UTC).
 * @param {Date} [date]
 * @returns {string}
 */
export function localIsoDay(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short' }).format(date);
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function toFiniteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normaliza una parada cruda del documento. Devuelve null si no es salvable
 * (sin cityId o sin islandId): una parada mal grabada se descarta entera, sin
 * fallbacks silenciosos a otra ciudad.
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {CarpoolStop|null}
 */
export function normalizeCarpoolStop(raw) {
  const cityId = String(raw?.cityId ?? '').trim();
  const islandId = String(raw?.islandId ?? '').trim();
  if (!cityId || !islandId) return null;
  const targetDate = String(raw?.targetDate ?? '').trim();
  return {
    cityId,
    islandId,
    islandName: String(raw?.islandName ?? '').trim() || islandId,
    cityName: String(raw?.cityName ?? '').trim() || cityId,
    // Solo se conserva un tiempo objetivo bien formado; otra cosa NO es fecha.
    targetDate: /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : null,
  };
}

/**
 * Reconstruye un Carpool a partir del documento de Firestore. Devuelve null si
 * el documento no es salvable: sin id, sin nombre, sin conductor o con un
 * status fuera del catálogo (un doc corrupto se descarta entero — mismo
 * criterio que normalizeResource en maps.js, nada de estados inventados).
 * @param {Record<string, unknown>|null|undefined} data  data() del documento
 * @param {string} id  Id del documento /carpools/{id}
 * @returns {Carpool|null}
 */
export function normalizeCarpool(data, id) {
  const docId = String(id ?? '').trim();
  const name = String(data?.name ?? '').trim();
  const status = String(data?.status ?? '').trim();
  const conductorId = String(/** @type {any} */ (data?.conductor)?.personId ?? '').trim();
  if (!docId || !name || !conductorId) return null;
  if (!CARPOOL_STATUSES.includes(/** @type {any} */ (status))) return null;
  const members = (Array.isArray(data?.members) ? data.members : [])
    .map((m) => {
      const personId = String(/** @type {any} */ (m)?.personId ?? '').trim();
      if (!personId) return null;
      const joinedAt = String(/** @type {any} */ (m)?.joinedAt ?? '').trim();
      return {
        personId,
        name: String(/** @type {any} */ (m)?.name ?? '').trim() || personId,
        joinedAt: joinedAt || null,
      };
    })
    .filter((m) => m !== null);
  const seats = Math.trunc(toFiniteNumber(data?.seats, DEFAULT_CARPOOL_SEATS));
  const createdAt = String(data?.createdAt ?? '').trim();
  const createdByUid = String(/** @type {any} */ (data?.createdBy)?.uid ?? '').trim();
  return {
    id: docId,
    name,
    status: /** @type {CarpoolStatus} */ (status),
    // El aforo del doc se acota al rango válido; nunca por debajo de los
    // miembros ya dentro (un doc legado con exceso no "expulsa" a nadie).
    seats: Math.max(Math.min(Math.max(seats, MIN_CARPOOL_SEATS), MAX_CARPOOL_SEATS), members.length),
    conductor: {
      personId: conductorId,
      name: String(/** @type {any} */ (data?.conductor)?.name ?? '').trim() || conductorId,
    },
    members,
    memberIds: members.map((m) => m.personId),
    route: (Array.isArray(data?.route) ? data.route : [])
      .map(normalizeCarpoolStop)
      .filter((s) => s !== null),
    createdAt: createdAt || null,
    createdBy: createdByUid
      ? { uid: createdByUid, name: String(/** @type {any} */ (data?.createdBy)?.name ?? '').trim() }
      : null,
  };
}

/** Plazas libres del carpool (nunca negativas). @param {Carpool} carpool */
export function seatsLeft(carpool) {
  return Math.max(0, carpool.seats - carpool.members.length);
}

/** true si la persona ya es miembro. @param {Carpool} carpool @param {string} personId */
export function isMember(carpool, personId) {
  return carpool.memberIds.includes(personId);
}

/**
 * true si la persona puede unirse: el carpool está abierto, queda plaza y no
 * está ya dentro.
 * @param {Carpool} carpool
 * @param {string|null|undefined} personId
 * @returns {boolean}
 */
export function canJoin(carpool, personId) {
  if (!personId) return false;
  return carpool.status === 'open' && seatsLeft(carpool) > 0 && !isMember(carpool, personId);
}

/**
 * Resumen de la ruta para el tablón: islas que toca (en orden de aparición,
 * sin repetir) y nº de paradas.
 * @param {Carpool} carpool
 * @returns {{ islandNames: string[], stops: number }}
 */
export function routeSummary(carpool) {
  const islandNames = [];
  for (const stop of carpool.route) {
    if (!islandNames.includes(stop.islandName)) islandNames.push(stop.islandName);
  }
  return { islandNames, stops: carpool.route.length };
}

/**
 * Estado de UNA parada para UN miembro: 'done' si su journey ya tiene la
 * ciudad en visitedCities; si no, 'delayed' cuando el tiempo objetivo quedó
 * atrás (comparación lexicográfica de 'YYYY-MM-DD') y 'pending' en el resto.
 * Sin journey (ilegible o inexistente) la parada cuenta como pendiente.
 * @param {CarpoolStop} stop
 * @param {Journey|null|undefined} journey
 * @param {string} todayIso  Día actual 'YYYY-MM-DD' (localIsoDay).
 * @returns {CarpoolStopState}
 */
export function memberStopState(stop, journey, todayIso) {
  if ((journey?.visitedCities ?? []).includes(stop.cityId)) return 'done';
  if (stop.targetDate !== null && stop.targetDate < todayIso) return 'delayed';
  return 'pending';
}

/**
 * Progreso del carpool: por MIEMBRO (paradas completadas X/Y, % y si terminó)
 * y por PARADA (quiénes la tienen, si la completaron todos y si va con
 * retraso — targetDate pasada sin completar por todos; visual, sin castigo).
 * @param {Carpool} carpool
 * @param {Map<string, Journey>} journeysByPerson  Journeys cargados por personId.
 * @param {string} [todayIso]  Día actual 'YYYY-MM-DD' (por defecto, hoy local).
 * @returns {CarpoolProgress}
 */
export function carpoolProgress(carpool, journeysByPerson, todayIso = localIsoDay()) {
  const total = carpool.route.length;
  const stops = carpool.route.map((stop) => {
    /** @type {Record<string, CarpoolStopState>} */
    const states = {};
    const completedBy = [];
    for (const member of carpool.members) {
      const state = memberStopState(stop, journeysByPerson.get(member.personId), todayIso);
      states[member.personId] = state;
      if (state === 'done') completedBy.push(member.personId);
    }
    const allDone = carpool.members.length > 0 && completedBy.length === carpool.members.length;
    return {
      stop,
      completedBy,
      allDone,
      delayed: stop.targetDate !== null && stop.targetDate < todayIso && !allDone,
      states,
    };
  });
  const members = carpool.members.map((member) => {
    const completed = stops.filter((s) => s.states[member.personId] === 'done').length;
    return {
      personId: member.personId,
      name: member.name,
      completed,
      total,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      done: total > 0 && completed === total,
    };
  });
  return {
    members,
    stops,
    completed: members.length > 0 && total > 0 && members.every((m) => m.done),
  };
}

/**
 * Convierte la ruta planificada PERSONAL de un journey (ids de ciudad, en
 * orden) en paradas de carpool, resolviendo isla y nombres contra los mapas
 * cargados. Una ciudad que no aparezca en ningún mapa aportado NO se inventa:
 * va a `missing` para que la UI lo cuente (nada de fallbacks silenciosos).
 * @param {Journey} journey
 * @param {ReadonlyArray<CareerMap>} maps  Mapas de isla ya cargados.
 * @returns {{ stops: CarpoolStop[], missing: string[] }}
 */
export function carpoolFromPlannedRoute(journey, maps) {
  const stops = [];
  const missing = [];
  for (const cityId of journey.plannedRoute ?? []) {
    const map = maps.find((m) => (m.cities ?? []).some((c) => c.id === cityId));
    if (!map) {
      missing.push(cityId);
      continue;
    }
    const city = map.cities.find((c) => c.id === cityId);
    stops.push({
      cityId,
      islandId: map.id,
      islandName: map.name,
      cityName: city?.name ?? cityId,
      targetDate: null,
    });
  }
  return { stops, missing };
}
