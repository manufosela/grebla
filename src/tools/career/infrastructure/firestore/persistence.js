/**
 * Persistencia Firestore del Mapa de Carrera, por tenant y por usuario:
 * /tenants/{tenantId}/journeys/{uid}. `db` y `tenantId` se inyectan.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').CareerStore} CareerStore
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';

const journeyDoc = (db, tenantId, uid) => doc(db, 'tenants', tenantId, 'journeys', uid);

/**
 * @param {Firestore} db
 * @param {string} tenantId
 * @returns {CareerStore}
 */
export function createFirestoreCareerStore(db, tenantId) {
  if (!db) throw new Error('createFirestoreCareerStore requiere una instancia de Firestore (db)');
  if (!tenantId) throw new Error('createFirestoreCareerStore requiere tenantId');
  return {
    journeys: {
      async get(uid) {
        const d = await getDoc(journeyDoc(db, tenantId, uid));
        return d.exists() ? d.data() : null;
      },
      async save(uid, journey) {
        await setDoc(journeyDoc(db, tenantId, uid), { ...journey }, { merge: true });
      },
    },
  };
}
