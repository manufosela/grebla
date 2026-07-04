/**
 * Persistencia Firestore del Mapa de Carrera (modelo persona unificada): el
 * journey vive en /people/{personId}/career/journey y los LOGROS con fecha
 * (MC-21) en /people/{personId}/career/achievements, dentro del subárbol de la
 * persona. Ambos heredan las reglas de /people/{personId}/{document=**} (un
 * líder dueño / compartido-edit / superadmin escriben; la cuenta vinculada del
 * ingeniero LEE). `db` se inyecta.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').CareerStore} CareerStore
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';

const journeyDoc = (db, personId) => doc(db, 'people', personId, 'career', 'journey');
const achievementsDoc = (db, personId) => doc(db, 'people', personId, 'career', 'achievements');

/**
 * @param {Firestore} db
 * @returns {CareerStore}
 */
export function createFirestoreCareerStore(db) {
  if (!db) throw new Error('createFirestoreCareerStore requiere una instancia de Firestore (db)');
  return {
    journeys: {
      async get(personId) {
        const d = await getDoc(journeyDoc(db, personId));
        return d.exists() ? d.data() : null;
      },
      async save(personId, journey) {
        await setDoc(journeyDoc(db, personId), { ...journey }, { merge: true });
      },
    },
    achievements: {
      async get(personId) {
        const d = await getDoc(achievementsDoc(db, personId));
        return d.exists() ? d.data() : null;
      },
      // Solo-añadir (MC-21): merge de mapas anidados — los registros existentes
      // (sus fechas) nunca se pisan porque el parche solo trae claves nuevas
      // (lo garantiza newAchievements en el dominio). OJO Firestore: con
      // merge:true un mapa VACÍO ({}) sí entra en la máscara y REEMPLAZA al
      // existente (lo vaciaría) — las secciones sin claves se omiten del
      // escrito, y un parche sin nada que añadir no escribe.
      async save(personId, patch) {
        /** @type {Record<string, unknown>} */
        const data = {};
        if (Object.keys(patch.citizenships ?? {}).length > 0) data.citizenships = patch.citizenships;
        if (Object.keys(patch.badges ?? {}).length > 0) data.badges = patch.badges;
        if (Object.keys(data).length === 0) return;
        await setDoc(achievementsDoc(db, personId), data, { merge: true });
      },
    },
  };
}
