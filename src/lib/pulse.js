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
