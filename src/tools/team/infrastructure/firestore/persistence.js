/**
 * Implementación Firestore del puerto de persistencia (PersistencePort).
 * Namespace por owner (monousuario hoy, multi-tenant sin remodelar):
 *
 *   /owners/{ownerId}/people/{personId}
 *           .../people/{personId}/{seniority|emotional|knowledge|contribution}/{readingId}
 *           .../people/{personId}/conversations/{convId}
 *           .../people/{personId}/supportNotes/{noteId}
 *   /owners/{ownerId}/areas/{areaId}
 *   /owners/{ownerId}/config/settings
 *
 * `db` se inyecta (no se importa firebase.js aquí) para mantener el adapter
 * testeable y libre de efectos de inicialización. Mismas interfaces que el
 * adapter in-memory: intercambiables sin tocar dominio ni casos de uso.
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').PersistencePort} PersistencePort
 */
import {
  doc,
  collection,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { DIMENSIONS, DEFAULT_SETTINGS } from '../../domain/types.js';

const peopleCol = (db, owner) => collection(db, 'owners', owner, 'people');
const personDoc = (db, owner, id) => doc(db, 'owners', owner, 'people', id);
const readingCol = (db, owner, personId, dim) =>
  collection(db, 'owners', owner, 'people', personId, dim);
const areaCol = (db, owner) => collection(db, 'owners', owner, 'areas');
const areaDoc = (db, owner, id) => doc(db, 'owners', owner, 'areas', id);
// El catálogo de roles de equipo es GLOBAL (no por owner): colección /teamRoles.
// Lectura para autenticados, escritura solo admin (ver firestore.rules).
const teamRoleCol = (db) => collection(db, 'teamRoles');
const teamRoleDoc = (db, id) => doc(db, 'teamRoles', id);
const convCol = (db, owner, personId) =>
  collection(db, 'owners', owner, 'people', personId, 'conversations');
const convDoc = (db, owner, personId, id) =>
  doc(db, 'owners', owner, 'people', personId, 'conversations', id);
const noteCol = (db, owner, personId) =>
  collection(db, 'owners', owner, 'people', personId, 'supportNotes');
const noteDoc = (db, owner, personId, id) =>
  doc(db, 'owners', owner, 'people', personId, 'supportNotes', id);
const settingsDoc = (db, owner) => doc(db, 'owners', owner, 'config', 'settings');

/** @param {import('firebase/firestore').QuerySnapshot} snap */
const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

function peopleRepo(db, owner) {
  return {
    async list() {
      return mapDocs(await getDocs(peopleCol(db, owner)));
    },
    async getById(id) {
      const d = await getDoc(personDoc(db, owner, id));
      return d.exists() ? { id: d.id, ...d.data() } : null;
    },
    async create(input) {
      const ref = await addDoc(peopleCol(db, owner), { ...input });
      return ref.id;
    },
    async update(id, patch) {
      await updateDoc(personDoc(db, owner, id), { ...patch });
    },
    async deactivate(id) {
      await updateDoc(personDoc(db, owner, id), { active: false, deactivatedAt: new Date().toISOString() });
    },
  };
}

function readingRepo(db, owner, dim) {
  return {
    async add(personId, payload) {
      const ref = await addDoc(readingCol(db, owner, personId, dim), { ...payload });
      return ref.id;
    },
    async listByPerson(personId) {
      return mapDocs(await getDocs(query(readingCol(db, owner, personId, dim), orderBy('date', 'asc'))));
    },
    async latest(personId) {
      const snap = await getDocs(query(readingCol(db, owner, personId, dim), orderBy('date', 'desc'), limit(1)));
      const d = snap.docs[0];
      return d ? { id: d.id, ...d.data() } : null;
    },
  };
}

function areaRepo(db, owner) {
  return {
    async list() {
      return mapDocs(await getDocs(areaCol(db, owner)));
    },
    async create(name) {
      const ref = await addDoc(areaCol(db, owner), { name });
      return ref.id;
    },
    async remove(id) {
      await deleteDoc(areaDoc(db, owner, id));
    },
  };
}

function teamRoleRepo(db) {
  return {
    async list() {
      return mapDocs(await getDocs(teamRoleCol(db)));
    },
    async create(name) {
      const ref = await addDoc(teamRoleCol(db), { name });
      return ref.id;
    },
    async remove(id) {
      await deleteDoc(teamRoleDoc(db, id));
    },
  };
}

function conversationRepo(db, owner) {
  return {
    async listByPerson(personId) {
      return mapDocs(await getDocs(query(convCol(db, owner, personId), orderBy('date', 'asc'))));
    },
    async create(personId, input) {
      const ref = await addDoc(convCol(db, owner, personId), { ...input });
      return ref.id;
    },
    async update(personId, id, patch) {
      await setDoc(convDoc(db, owner, personId, id), { ...patch }, { merge: true });
    },
  };
}

function supportNoteRepo(db, owner, now = () => new Date().toISOString()) {
  return {
    async listByPerson(personId) {
      return mapDocs(await getDocs(query(noteCol(db, owner, personId), orderBy('date', 'asc'))));
    },
    async create(personId, text) {
      const ref = await addDoc(noteCol(db, owner, personId), { text, date: now() });
      return ref.id;
    },
    async remove(personId, id) {
      await deleteDoc(noteDoc(db, owner, personId, id));
    },
  };
}

function configRepo(db, owner) {
  return {
    async getSettings() {
      const d = await getDoc(settingsDoc(db, owner));
      const data = d.exists() ? d.data() : {};
      return {
        ...DEFAULT_SETTINGS,
        ...data,
        features: { ...DEFAULT_SETTINGS.features, ...(data.features ?? {}) },
      };
    },
    async updateSettings(patch) {
      await setDoc(settingsDoc(db, owner), { ...patch }, { merge: true });
    },
  };
}

/**
 * @param {Firestore} db
 * @param {string} ownerId
 * @returns {PersistencePort}
 */
export function createFirestorePersistence(db, ownerId) {
  if (!db) throw new Error('createFirestorePersistence requiere una instancia de Firestore (db)');
  if (!ownerId) throw new Error('createFirestorePersistence requiere ownerId');
  const readings = /** @type {PersistencePort['readings']} */ (
    Object.fromEntries(DIMENSIONS.map((dim) => [dim, readingRepo(db, ownerId, dim)]))
  );
  return {
    people: peopleRepo(db, ownerId),
    readings,
    areas: areaRepo(db, ownerId),
    teamRoles: teamRoleRepo(db), // catálogo global, no namespaced por owner
    conversations: conversationRepo(db, ownerId),
    supportNotes: supportNoteRepo(db, ownerId),
    config: configRepo(db, ownerId),
  };
}
