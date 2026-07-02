/**
 * Lectura de la persona vinculada a la cuenta autenticada (modelo engineer, G2).
 *
 * Una persona (/people/{id}) puede llevar `uid` = la cuenta vinculada; su titular
 * puede leerla en solo lectura mediante la query `where('uid','==', miUid)`, que
 * respaldan las reglas de Firestore (la condición de lectura usa el mismo campo
 * `uid` del filtro). Toda la IO de Firebase de este flujo vive SOLO en este módulo.
 *
 * @typedef {import('../tools/team/domain/types.js').Person} Person
 */
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';
import { getPersonProfile, getSession, getOrgConfig } from './firestore.js';
import { getCareerMap } from './careerMap.js';
import { computeProfile } from './scoring.js';
import { ITEMS } from '../data/items.js';
import { ROLES } from '../data/roles.js';
import { createCareerContainer } from '../tools/career/composition/container.js';
import { getJourney } from '../tools/career/application/usecases.js';

/**
 * Devuelve la persona vinculada a un `uid` (la cuenta del propio ingeniero), o
 * `null` si no hay ninguna. Consulta por el campo `uid`, único identificador de
 * la vinculación, respaldado por las reglas de Firestore para leer la propia
 * persona.
 * @param {string|null|undefined} uid  uid de la cuenta autenticada
 * @returns {Promise<(Person & { id: string })|null>}
 */
export async function getMyPerson(uid) {
  if (!uid) return null;
  const snap = await getDocs(
    query(collection(db, 'people'), where('uid', '==', uid), limit(1)),
  );
  const personDoc = snap.docs.at(0);
  return personDoc ? { id: personDoc.id, ...personDoc.data() } : null;
}

/**
 * Perfil COMPLETO de Role Mirror de la persona vinculada, en solo lectura.
 *
 * El resumen persistido (`/people/{id}/rolemirror/summary`, vía `getPersonProfile`)
 * solo guarda el rol dominante, el % de completitud y las afinidades AGREGADAS
 * (map rol→%); NO incluye `byDimension`, imprescindible para el radar y las barras
 * por dimensión de <role-result>. Por eso se RECALCULA el perfil íntegro con
 * `computeProfile` a partir de las respuestas de la última sesión (`lastSessionId`),
 * usando el catálogo de ítems/roles y la config de organización vigentes. Todas las
 * lecturas viven bajo el subárbol de la persona (o son globales), legibles por su
 * cuenta según las reglas de Firestore.
 * @param {string} personId
 * @returns {Promise<import('./scoring.js').Profile|null>}  Profile completo, o null si la persona no tiene sesiones de Role Mirror.
 */
export async function getMyRoleMirrorProfile(personId) {
  const summary = await getPersonProfile(personId);
  const sessionId = summary?.lastSessionId ?? null;
  if (!sessionId) return null;
  const [session, orgConfig] = await Promise.all([
    getSession(personId, sessionId),
    getOrgConfig(),
  ]);
  const answers = session?.answers ?? null;
  if (!answers) return null;
  return computeProfile({ items: ITEMS, roles: ROLES, answers, orgConfig: orgConfig ?? undefined });
}

/**
 * Isla del Mapa de Carrera (documento global `/careerMap/island`) y el journey de
 * la persona (`/people/{personId}/career/journey`), ambos en solo lectura. Reutiliza
 * los loaders del tool career en modo firestore; no realiza ninguna escritura.
 * @param {string} personId
 * @returns {Promise<{ island: import('../tools/career/domain/types.js').CareerMap, journey: import('../tools/career/domain/types.js').Journey }>}
 */
export async function getMyCareerMap(personId) {
  const [{ store }, island] = await Promise.all([
    createCareerContainer({ mode: 'firestore' }),
    getCareerMap(),
  ]);
  const journey = await getJourney(store, personId);
  return { island, journey };
}
