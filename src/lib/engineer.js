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
import { collection, query, where, limit, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { getPersonProfile, getSession, getOrgConfig } from './firestore.js';
import { getCareerMap, getArchipelago } from './careerMap.js';
import { computeProfile } from './scoring.js';
import { ITEMS } from '../data/items.js';
import { ROLES } from '../data/roles.js';
import { createCareerContainer } from '../tools/career/composition/container.js';
import { getJourney, getAchievements, getEndorsements, listQuestions, getLogbook } from '../tools/career/application/usecases.js';

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
 * Crea la ficha PROPIA de un manager/superadmin (self-ficha, RMR-TSK-0251): una
 * /people con `uid` y `ownerLeaderUid` = su propio uid, marcada `self: true`. Al
 * ser su dueño puede editarla (regla isOwner) y, al ser el titular (`uid` propio),
 * hereda Role Mirror y el mapa self-editables. El marcador `self` la excluye del
 * roster del equipo. Las reglas permiten el create a un líder (ownerLeaderUid ==
 * su uid) y a un superadmin (para cualquiera).
 * @param {{ uid: string, displayName?: string|null, email?: string|null }} user
 * @returns {Promise<string>}  id de la persona creada
 */
export async function createMyPerson(user) {
  if (!user?.uid) throw new Error('createMyPerson requiere el uid de la cuenta');
  const name = user.displayName ?? user.email ?? 'Mi ficha';
  const ref = await addDoc(collection(db, 'people'), {
    name,
    uid: user.uid,
    ownerLeaderUid: user.uid,
    self: true,
    active: true,
    startDate: new Date().toISOString().slice(0, 10),
    levelId: null,
    guilds: [],
    disciplines: [],
    labels: [],
    githubLogin: null,
  });
  return ref.id;
}

/**
 * Actualiza los datos básicos de la propia self-ficha (RMR-TSK-0251): nombre,
 * nivel y disciplinas. Solo el dueño puede escribir estos campos (regla isOwner);
 * el `hasOnly` del cliente no relaja las reglas, solo evita mandar campos de más.
 * @param {string} personId
 * @param {{ name?: string, levelId?: string|null, disciplines?: string[], startDate?: string }} basics
 * @returns {Promise<void>}
 */
export async function updateMyPersonBasics(personId, basics = {}) {
  if (!personId) throw new Error('updateMyPersonBasics requiere personId');
  const patch = {};
  if (typeof basics.name === 'string') patch.name = basics.name.trim() || 'Mi ficha';
  if ('levelId' in basics) patch.levelId = basics.levelId || null;
  if (Array.isArray(basics.disciplines)) patch.disciplines = basics.disciplines;
  // Fecha de alta (YYYY-MM-DD); solo se escribe si viene con valor.
  if (typeof basics.startDate === 'string' && basics.startDate) patch.startDate = basics.startDate;
  await updateDoc(doc(db, 'people', personId), patch);
}

/**
 * Borra la propia self-ficha (RMR-TSK-0253): la marca de baja (active:false, que
 * el dueño puede escribir) y llama a la Cloud Function deletePerson, que exige
 * que sea el dueño y que esté dada de baja, y borra en cascada su subárbol. Como
 * el manager es dueño de su self-ficha (ownerLeaderUid = su uid), puede borrarla.
 * @param {string} personId
 * @returns {Promise<void>}
 */
export async function deleteMyPerson(personId) {
  if (!personId) throw new Error('deleteMyPerson requiere personId');
  await updateDoc(doc(db, 'people', personId), { active: false });
  const { deletePerson } = await import('./people.js');
  await deletePerson(personId);
}

/**
 * Sella la invitación por email de la persona pre-invitada (RMR-TSK-0167): si el
 * usuario recién logado tiene una persona con `pendingEmail == su-email`, la
 * Cloud Function le escribe el uid (Admin SDK, las reglas no dejan al cliente
 * escribirse su propio uid). Devuelve true si selló una persona. Nunca lanza al
 * caller — un fallo del sellado no debe tumbar la resolución de acceso.
 * @returns {Promise<boolean>}
 */
export async function sealInvite() {
  try {
    const { app } = await import('./firebase.js');
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const fns = getFunctions(app, 'europe-west1');
    const res = await httpsCallable(fns, 'sealInvite')();
    return Boolean(/** @type {any} */ (res.data)?.sealed);
  } catch {
    return false;
  }
}

/**
 * Bitácora (JG-23) de una persona, en SOLO LECTURA — para que su líder vea el
 * historial de rutas de carrera completadas (F3, RMR-TSK-0171). Las reglas de
 * Firestore permiten al líder dueño (o admin/viewer) leer
 * /people/{personId}/career/logbook. Reutiliza el loader del tool career en
 * modo firestore; no escribe nada.
 * @param {string} personId
 * @returns {Promise<{ entries: import('../tools/career/domain/logbook.js').LogEntry[] }>}
 */
export async function getPersonLogbook(personId) {
  const { store } = await createCareerContainer({ mode: 'firestore' });
  return getLogbook(store, personId);
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
 * registrados (`/people/{personId}/career/achievements`), los avales del
 * manager (JG-6, `/people/{personId}/career/endorsements`: el contador
 * «N avalados ✓» de la ficha), y las consultas al brujo (MC-22,
 * `/people/{personId}/career/wizard/questions`) que la ficha lista como Q&A.
 * Reutiliza los loaders del tool career en modo firestore; no realiza NINGUNA
 * escritura (la migración de logros pre-MC-21 la hace la vista de juego del
 * líder, nunca mi-espacio — y el aval solo lo firma el manager).
 * @param {string} personId
 * @returns {Promise<{
 *   island: import('../tools/career/domain/types.js').CareerMap,
 *   journey: import('../tools/career/domain/types.js').Journey,
 *   archipelago: import('../tools/career/domain/types.js').Archipelago,
 *   achievements: import('../tools/career/domain/achievements.js').Achievements,
 *   endorsements: import('../tools/career/domain/endorsements.js').Endorsements,
 *   questions: import('../tools/career/domain/wizard.js').WizardQuestion[],
 * }>}
 */
export async function getMyCareerMap(personId) {
  const [{ store }, island, archipelago] = await Promise.all([
    createCareerContainer({ mode: 'firestore' }),
    getCareerMap(),
    getArchipelago(),
  ]);
  const [journey, achievements, endorsements, questions] = await Promise.all([
    getJourney(store, personId),
    getAchievements(store, personId),
    getEndorsements(store, personId),
    listQuestions(store, personId),
  ]);
  return { island, journey, archipelago, achievements, endorsements, questions };
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
