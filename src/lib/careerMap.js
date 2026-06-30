/**
 * Persistencia del Mapa de Carrera a nivel de instancia (MC-3).
 *
 * El mapa (la isla: comarcas, ciudades y puerto de inicio) vive en un único
 * documento Firestore `/careerMap/island`. Lo leen todos los autenticados (el
 * tool Mapa de Carrera) y solo lo escribe el superadmin (editor del panel /admin).
 *
 * Mientras no exista el documento se devuelve la isla en código (`seedCareerMap`)
 * como semilla/fallback, de modo que el tool funciona desde el primer arranque.
 *
 * @typedef {import('../tools/career/domain/types.js').CareerMap} CareerMap
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizeCareerMap, serializeCareerMap } from '../tools/career/data/maps.js';

const CAREER_MAP_COLLECTION = 'careerMap';
const CAREER_MAP_DOC = 'island';

/** Referencia al documento único del mapa. */
const mapDoc = () => doc(db, CAREER_MAP_COLLECTION, CAREER_MAP_DOC);

/**
 * Lee el mapa de carrera de la instancia. Si el documento no existe todavía,
 * devuelve la isla en código como semilla.
 * @returns {Promise<CareerMap>}
 */
export async function getCareerMap() {
  const snap = await getDoc(mapDoc());
  return normalizeCareerMap(snap.exists() ? snap.data() : null);
}

/**
 * Persiste el mapa de carrera completo (solo superadmin por reglas). Sobrescribe
 * el documento con la versión normalizada (sin `undefined`).
 * @param {CareerMap} map
 * @returns {Promise<void>}
 */
export async function saveCareerMap(map) {
  await setDoc(
    mapDoc(),
    { ...serializeCareerMap(map), updatedAt: serverTimestamp() },
    { merge: false },
  );
}
