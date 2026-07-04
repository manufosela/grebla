/**
 * Persistencia del Mapa de Carrera a nivel de instancia (MC-3, archipiélago en
 * MC-14).
 *
 * Cada ISLA (comarcas, ciudades y puerto de inicio) vive en un documento de la
 * colección `/careerMap/{islandId}`; el ÍNDICE del archipiélago (islas con id,
 * nombre, disciplina y posición en el mapa del mar) es un documento más de la
 * misma colección: `/careerMap/_archipelago`. Todo lo leen los autenticados
 * (el tool Mapa de Carrera) y solo lo escribe el superadmin (editor /admin):
 * el match `/careerMap/{doc}` de las reglas cubre ambos casos sin cambios.
 *
 * Mientras no exista un documento se devuelve su fallback en código: la isla
 * semilla para la de inicio (`seedCareerMap`), la isla-placeholder vacía («En
 * construcción») para el resto, y el índice semilla (`seedArchipelago`) para
 * el archipiélago — el tool funciona desde el primer arranque.
 *
 * @typedef {import('../tools/career/domain/types.js').CareerMap} CareerMap
 * @typedef {import('../tools/career/domain/types.js').Archipelago} Archipelago
 */
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizeCareerMap, serializeCareerMap } from '../tools/career/data/maps.js';
import { normalizeArchipelago, serializeArchipelago, START_ISLAND_ID } from '../tools/career/data/archipelago.js';

const CAREER_MAP_COLLECTION = 'careerMap';
/** Documento del índice del archipiélago (un doc más de la colección). */
const ARCHIPELAGO_DOC = '_archipelago';

/** Referencia al documento de una isla (o del índice). @param {string} docId */
const mapDoc = (docId) => doc(db, CAREER_MAP_COLLECTION, docId);

/**
 * Lee el mapa de una isla. Si el documento no existe todavía: la isla de
 * inicio cae a la semilla en código y cualquier otra a su placeholder vacío
 * («En construcción», con el nombre del índice si se aporta).
 * @param {string} [islandId] Isla a cargar (por defecto la de inicio).
 * @param {string} [fallbackName] Nombre del índice para el placeholder.
 * @returns {Promise<CareerMap>}
 */
export async function getCareerMap(islandId = START_ISLAND_ID, fallbackName = '') {
  const snap = await getDoc(mapDoc(islandId));
  const map = normalizeCareerMap(snap.exists() ? snap.data() : null, islandId);
  // Placeholder sin nombre propio: hereda el nombre del índice del archipiélago.
  if (!snap.exists() && fallbackName) map.name = fallbackName;
  return map;
}

/**
 * Persiste el mapa completo de una isla (solo superadmin por reglas).
 * Sobrescribe el documento con la versión normalizada (sin `undefined`).
 * @param {string} islandId
 * @param {CareerMap} map
 * @returns {Promise<void>}
 */
export async function saveCareerMap(islandId, map) {
  const id = String(islandId ?? '').trim();
  if (!id || id === ARCHIPELAGO_DOC) {
    throw new Error(`Id de isla inválido para guardar el mapa: "${islandId}".`);
  }
  await setDoc(
    mapDoc(id),
    { ...serializeCareerMap(map), updatedAt: serverTimestamp() },
    { merge: false },
  );
}

/**
 * Lee el índice del archipiélago. Si el documento no existe todavía devuelve
 * la semilla en código (las 13 islas del ADR).
 * @returns {Promise<Archipelago>}
 */
export async function getArchipelago() {
  const snap = await getDoc(mapDoc(ARCHIPELAGO_DOC));
  return normalizeArchipelago(snap.exists() ? snap.data() : null);
}

/**
 * Persiste el índice del archipiélago completo (solo superadmin por reglas).
 * @param {Archipelago} arch
 * @returns {Promise<void>}
 */
export async function saveArchipelago(arch) {
  await setDoc(
    mapDoc(ARCHIPELAGO_DOC),
    { ...serializeArchipelago(arch), updatedAt: serverTimestamp() },
    { merge: false },
  );
}

/**
 * Ids de las islas que YA tienen documento en Firestore (las demás son «En
 * construcción» en el mapa del mar). Una consulta de la colección completa:
 * cachear el resultado por sesión en el caller (career-app lo hace).
 * @returns {Promise<Set<string>>}
 */
export async function getExistingIslandIds() {
  const snap = await getDocs(collection(db, CAREER_MAP_COLLECTION));
  return new Set(snap.docs.map((d) => d.id).filter((id) => id !== ARCHIPELAGO_DOC));
}
