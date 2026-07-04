/**
 * Persistencia de los CARPOOLS de formación (CP-1): colección raíz de la
 * instancia `/carpools/{id}`. La lógica (normalización, aforo, unión,
 * progreso) es PURA y vive en src/tools/career/domain/carpool.js; aquí solo
 * la IO contra Firestore y las validaciones de escritura (que lanzan Error
 * con mensaje legible — nada de fallbacks silenciosos).
 *
 * Reglas (firestore.rules): lectura para autenticados; crear solo
 * líder/superadmin con createdBy.uid == auth.uid; editar/borrar el creador o
 * el superadmin, MÁS la rama de UNIRSE/SALIR de cualquier líder (update
 * restringido con hasOnly a members/memberIds/status — la validación fina de
 * la unión es de cliente en esta v1 pragmática; ver el comentario del bloque
 * en firestore.rules).
 *
 * El campo `memberIds` es el ESPEJO de members[].personId para la consulta
 * array-contains de «mis carpools» (mismo patrón que sharedWithUids en
 * /people: rules are not filters).
 *
 * @typedef {import('../tools/career/domain/carpool.js').Carpool} Carpool
 * @typedef {import('../tools/career/domain/carpool.js').CarpoolStop} CarpoolStop
 */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase.js';
import {
  DEFAULT_CARPOOL_SEATS,
  MIN_CARPOOL_SEATS,
  MAX_CARPOOL_SEATS,
  normalizeCarpool,
  normalizeCarpoolStop,
  canJoin,
  isMember,
} from '../tools/career/domain/carpool.js';

const CARPOOLS_COLLECTION = 'carpools';

/** Referencia a la colección de carpools. */
const carpoolsCol = () => collection(db, CARPOOLS_COLLECTION);

/** Referencia al documento de un carpool. @param {string} id */
const carpoolDoc = (id) => doc(db, CARPOOLS_COLLECTION, id);

/**
 * createdAt llega como Timestamp de Firestore (serverTimestamp): se pasa a
 * ISO para el modelo puro. Un doc recién creado en local puede traerlo null.
 * @param {unknown} value
 * @returns {string|null}
 */
function timestampToIso(value) {
  if (value && typeof (/** @type {any} */ (value).toDate) === 'function') {
    return /** @type {any} */ (value).toDate().toISOString();
  }
  return typeof value === 'string' && value ? value : null;
}

/**
 * Snapshot → Carpool normalizado (o null si el doc no es salvable).
 * @param {import('firebase/firestore').QueryDocumentSnapshot} snap
 * @returns {Carpool|null}
 */
function snapToCarpool(snap) {
  const data = snap.data();
  return normalizeCarpool({ ...data, createdAt: timestampToIso(data.createdAt) }, snap.id);
}

/** Más reciente primero (los createdAt null, al final). @param {Carpool} a @param {Carpool} b */
function byCreatedAtDesc(a, b) {
  if (a.createdAt === b.createdAt) return 0;
  if (a.createdAt === null) return 1;
  if (b.createdAt === null) return -1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

/**
 * Carpools ABIERTOS (el tablón). Consulta de un solo campo (sin índice
 * compuesto); la ordenación por fecha es de cliente. Los docs corruptos se
 * descartan (normalizeCarpool devuelve null).
 * @returns {Promise<Carpool[]>}
 */
export async function listOpenCarpools() {
  const snap = await getDocs(query(carpoolsCol(), where('status', '==', 'open')));
  return snap.docs
    .map(snapToCarpool)
    .filter((c) => c !== null)
    .toSorted(byCreatedAtDesc);
}

/**
 * Carpools en los que participa una persona (cualquier estado): la pestaña
 * «Los míos». Usa el espejo memberIds (array-contains).
 * @param {string} personId
 * @returns {Promise<Carpool[]>}
 */
export async function listMyCarpools(personId) {
  const id = String(personId ?? '').trim();
  if (!id) throw new Error('Hace falta una persona para listar sus carpools.');
  const snap = await getDocs(query(carpoolsCol(), where('memberIds', 'array-contains', id)));
  return snap.docs
    .map(snapToCarpool)
    .filter((c) => c !== null)
    .toSorted(byCreatedAtDesc);
}

/**
 * Sanea y valida las paradas de una ruta nueva. Lanza si alguna parada no es
 * salvable o si la ruta queda vacía: un carpool sin ruta no lleva a ninguna
 * parte.
 * @param {ReadonlyArray<CarpoolStop>} route
 * @returns {CarpoolStop[]}
 */
function validRoute(route) {
  const stops = (Array.isArray(route) ? route : []).map((raw) => {
    const stop = normalizeCarpoolStop(raw);
    if (stop === null) {
      throw new Error('La ruta tiene una parada inválida (sin ciudad o sin isla).');
    }
    return stop;
  });
  if (stops.length === 0) throw new Error('La ruta necesita al menos una parada.');
  return stops;
}

/**
 * Crea un carpool: quien lo crea queda como CONDUCTOR y primer miembro, y el
 * doc nace 'open'. Valida nombre, aforo, ruta, conductor y autoría.
 * @param {{ name: string, seats?: number, route: ReadonlyArray<CarpoolStop>, conductor: { personId: string, name: string } }} input
 * @param {{ uid: string, name: string }} user  Login (createdBy: lo exigen las reglas).
 * @returns {Promise<Carpool>} El carpool recién creado, normalizado.
 */
export async function createCarpool(input, user) {
  const name = String(input?.name ?? '').trim();
  if (!name) throw new Error('Ponle nombre al carpool.');
  const conductorId = String(input?.conductor?.personId ?? '').trim();
  if (!conductorId) throw new Error('Hace falta la persona que conduce el carpool.');
  if (!user?.uid) throw new Error('Hace falta la sesión iniciada para crear un carpool.');
  const seats = Math.trunc(Number(input?.seats ?? DEFAULT_CARPOOL_SEATS));
  if (!Number.isFinite(seats) || seats < MIN_CARPOOL_SEATS || seats > MAX_CARPOOL_SEATS) {
    throw new Error(`Las plazas deben estar entre ${MIN_CARPOOL_SEATS} y ${MAX_CARPOOL_SEATS}.`);
  }
  const route = validRoute(input.route);
  const conductor = {
    personId: conductorId,
    name: String(input.conductor.name ?? '').trim() || conductorId,
  };
  const payload = {
    name,
    status: 'open',
    seats,
    conductor,
    // El conductor es el primer miembro. joinedAt en ISO de cliente:
    // serverTimestamp() no puede viajar dentro de un array.
    members: [{ ...conductor, joinedAt: new Date().toISOString() }],
    memberIds: [conductor.personId],
    route,
    createdAt: serverTimestamp(),
    createdBy: { uid: user.uid, name: String(user.name ?? '').trim() },
  };
  const ref = await addDoc(carpoolsCol(), payload);
  const created = normalizeCarpool({ ...payload, createdAt: new Date().toISOString() }, ref.id);
  if (created === null) throw new Error('No se pudo crear el carpool.'); // no debería: el payload ya está validado
  return created;
}

/**
 * Une a una persona a un carpool ABIERTO con plaza. Escribe SOLO
 * members/memberIds/status (la máscara hasOnly de la rama de unión de las
 * reglas); si se ocupa la última plaza el carpool pasa a 'full'.
 * @param {Carpool} carpool
 * @param {{ personId: string, name: string }} person
 * @returns {Promise<Carpool>} El carpool actualizado.
 */
export async function joinCarpool(carpool, person) {
  const personId = String(person?.personId ?? '').trim();
  if (!personId) throw new Error('Elige la persona que se une al carpool.');
  if (isMember(carpool, personId)) throw new Error(`Ya estás dentro de «${carpool.name}».`);
  if (!canJoin(carpool, personId)) {
    throw new Error(`No hay plaza en «${carpool.name}» (o ya no está abierto).`);
  }
  const members = [
    ...carpool.members,
    { personId, name: String(person.name ?? '').trim() || personId, joinedAt: new Date().toISOString() },
  ];
  const status = carpool.seats - members.length === 0 ? 'full' : 'open';
  const patch = { members, memberIds: members.map((m) => m.personId), status };
  await updateDoc(carpoolDoc(carpool.id), patch);
  return { ...carpool, ...patch };
}

/**
 * Saca a una persona de un carpool abierto o lleno. El CONDUCTOR no sale: si
 * quiere terminar, lo cierra (closeCarpool). Si el carpool estaba 'full',
 * vuelve a 'open' (queda plaza).
 * @param {Carpool} carpool
 * @param {string} personId
 * @returns {Promise<Carpool>} El carpool actualizado.
 */
export async function leaveCarpool(carpool, personId) {
  const id = String(personId ?? '').trim();
  if (!isMember(carpool, id)) throw new Error(`No estás en «${carpool.name}».`);
  if (carpool.conductor.personId === id) {
    throw new Error('Quien conduce no abandona el carpool: puede cerrarlo.');
  }
  if (carpool.status !== 'open' && carpool.status !== 'full') {
    throw new Error(`«${carpool.name}» ya no está en marcha.`);
  }
  const members = carpool.members.filter((m) => m.personId !== id);
  const patch = { members, memberIds: members.map((m) => m.personId), status: 'open' };
  await updateDoc(carpoolDoc(carpool.id), patch);
  return { ...carpool, ...patch };
}

/**
 * Cierra un carpool (lo retira del tablón y de la señalización del mapa).
 * Por reglas solo puede el creador (createdBy.uid) o el superadmin; la UI
 * ofrece el botón solo al creador.
 * @param {Carpool} carpool
 * @returns {Promise<Carpool>} El carpool actualizado.
 */
export async function closeCarpool(carpool) {
  if (carpool.status === 'closed') return carpool;
  await updateDoc(carpoolDoc(carpool.id), { status: 'closed' });
  return { ...carpool, status: 'closed' };
}
