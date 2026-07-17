/**
 * Acceso a los registros de Marea (RMR-TSK-0234). Cada persona guarda UN registro
 * por día en /pulse/{uid}/entries/{YYYY-MM-DD}: el id = fecha garantiza la norma
 * de «1 vez al día». Las reglas de Firestore restringen el acceso a lo propio;
 * el agregado del equipo lo calcula una Cloud Function aparte (RMR-TSK-0236).
 *
 * La lógica pura (claves de día/semana, saneado) vive en tools/pulse/domain.
 */
import { doc, collection, getDoc, getDocs, setDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { dayKey, isoWeekKey, sanitizePulse } from '../tools/pulse/domain/pulse.js';

/** Clave de la semana actual (para leer su agregado). @param {Date} [date] */
export function currentWeekKey(date = new Date()) {
  return isoWeekKey(date);
}

/**
 * Agregado anónimo de una semana (/pulseAggregates/{weekIso}), o null si aún no
 * se ha calculado. Lo escribe la Cloud Function; el cliente solo lee.
 * @param {string} weekIso
 * @returns {Promise<import('firebase/firestore').DocumentData|null>}
 */
export async function getPulseAggregate(weekIso) {
  const snap = await getDoc(doc(db, 'pulseAggregates', weekIso));
  return snap.exists() ? snap.data() : null;
}

/** @param {string} uid @param {string} day @returns {import('firebase/firestore').DocumentReference} */
const entryRef = (uid, day) => doc(db, 'pulse', uid, 'entries', day);

/**
 * Guarda (o actualiza, editable hasta medianoche) la marea del día del usuario.
 * @param {string} uid
 * @param {Record<string, unknown>} input  valores del formulario (se sanean)
 * @param {Date} [date]  por defecto, hoy
 * @returns {Promise<string>}  la clave del día guardada (YYYY-MM-DD)
 */
export async function saveMyPulse(uid, input, date = new Date()) {
  if (!uid) throw new Error('saveMyPulse requiere el uid del usuario');
  const day = dayKey(date);
  await setDoc(
    entryRef(uid, day),
    { ...sanitizePulse(input), uid, day, weekIso: isoWeekKey(date), updatedAt: serverTimestamp() },
    { merge: true },
  );
  return day;
}

/**
 * Marea del día del usuario (para precargar/editar), o null si aún no la registró.
 * @param {string} uid @param {Date} [date]
 * @returns {Promise<import('firebase/firestore').DocumentData|null>}
 */
export async function getMyPulse(uid, date = new Date()) {
  if (!uid) throw new Error('getMyPulse requiere el uid del usuario');
  const snap = await getDoc(entryRef(uid, dayKey(date)));
  return snap.exists() ? snap.data() : null;
}

/**
 * Última marea de la SEMANA en curso del usuario (RMR-BUG-0038): la de hoy si
 * existe, o si no la más reciente de la misma semana ISO. Así «Mi marea» muestra
 * el pulso de la semana y no aparece en blanco al día siguiente. null si esta
 * semana aún no ha registrado ninguna.
 * @param {string} uid @param {Date} [date]
 * @returns {Promise<import('firebase/firestore').DocumentData|null>}
 */
export async function getMyCurrentWeekPulse(uid, date = new Date()) {
  if (!uid) throw new Error('getMyCurrentWeekPulse requiere el uid del usuario');
  const week = isoWeekKey(date);
  // getMyPulseHistory viene ordenada por día DESC: el primer match de la semana
  // es el más reciente. 10 cubre de sobra los ≤7 días de una semana.
  const recent = await getMyPulseHistory(uid, 10);
  return recent.find((entry) => entry.weekIso === week) ?? null;
}

/**
 * Histórico reciente de mareas del usuario (para su evolución personal), más
 * nuevas primero.
 * @param {string} uid @param {number} [max]
 * @returns {Promise<import('firebase/firestore').DocumentData[]>}
 */
export async function getMyPulseHistory(uid, max = 12) {
  if (!uid) throw new Error('getMyPulseHistory requiere el uid del usuario');
  const q = query(collection(db, 'pulse', uid, 'entries'), orderBy('day', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
