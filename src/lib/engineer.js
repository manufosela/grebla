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
import { collection, query, where, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { getPersonProfile, getSession, getOrgConfig } from './firestore.js';
import { getCareerMap, getArchipelago } from './careerMap.js';
import { computeProfile } from './scoring.js';
import { ITEMS } from '../data/items.js';
import { ROLES } from '../data/roles.js';
import { createCareerContainer } from '../tools/career/composition/container.js';
import { getJourney, getAchievements, listQuestions } from '../tools/career/application/usecases.js';

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
 * Datos del Mapa de Carrera de la persona vinculada, TODO en solo lectura:
 * la isla de inicio (`/careerMap/island`), su journey
 * (`/people/{personId}/career/journey`), para la ficha de ciudadanía (MC-21)
 * el índice del archipiélago (`/careerMap/_archipelago`) y los logros
 * registrados (`/people/{personId}/career/achievements`), y las consultas al
 * brujo (MC-22, `/people/{personId}/career/wizard/questions`) que la ficha
 * lista como Q&A. Reutiliza los loaders del tool career en modo firestore; no
 * realiza NINGUNA escritura (la migración de logros pre-MC-21 la hace la
 * vista de juego del líder, nunca mi-espacio).
 * @param {string} personId
 * @returns {Promise<{
 *   island: import('../tools/career/domain/types.js').CareerMap,
 *   journey: import('../tools/career/domain/types.js').Journey,
 *   archipelago: import('../tools/career/domain/types.js').Archipelago,
 *   achievements: import('../tools/career/domain/achievements.js').Achievements,
 *   questions: import('../tools/career/domain/wizard.js').WizardQuestion[],
 * }>}
 */
export async function getMyCareerMap(personId) {
  const [{ store }, island, archipelago] = await Promise.all([
    createCareerContainer({ mode: 'firestore' }),
    getCareerMap(),
    getArchipelago(),
  ]);
  const [journey, achievements, questions] = await Promise.all([
    getJourney(store, personId),
    getAchievements(store, personId),
    listQuestions(store, personId),
  ]);
  return { island, journey, archipelago, achievements, questions };
}

/**
 * Declara (o retira) el nivel objetivo de carrera de la persona vinculada. Es la
 * ÚNICA escritura permitida al propio ingeniero sobre su ficha: las reglas de
 * Firestore solo le dejan modificar el campo `careerTargetLevelId` de su propia
 * persona (rama `hasOnly(['careerTargetLevelId'])`), nada más. Pasar `null`
 * retira el objetivo declarado.
 * @param {string} personId  id de la persona (/people/{personId})
 * @param {string|null} levelId  id del nivel objetivo, o null para quitarlo
 * @returns {Promise<void>}
 */
export async function setCareerTarget(personId, levelId) {
  if (typeof personId !== 'string' || personId.trim() === '') {
    throw new TypeError('setCareerTarget: personId es obligatorio (string no vacío).');
  }
  if (levelId !== null && (typeof levelId !== 'string' || levelId.trim() === '')) {
    throw new TypeError('setCareerTarget: levelId debe ser un string no vacío o null.');
  }
  await updateDoc(doc(db, 'people', personId), { careerTargetLevelId: levelId });
}
