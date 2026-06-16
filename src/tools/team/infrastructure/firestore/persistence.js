/**
 * Implementación Firestore del puerto de persistencia (PersistencePort).
 * Multi-tenant: cada líder tiene su subárbol dentro de su tenant. El catálogo de
 * roles es del tenant (compartido por sus líderes).
 *
 *   /tenants/{tenantId}/leaders/{leaderUid}/people/{personId}
 *       .../people/{personId}/{seniority|emotional|knowledge|contribution}/{readingId}
 *       .../people/{personId}/conversations/{convId}
 *       .../people/{personId}/supportNotes/{noteId}
 *   /tenants/{tenantId}/leaders/{leaderUid}/areas/{areaId}
 *   /tenants/{tenantId}/leaders/{leaderUid}/config/settings
 *   /tenants/{tenantId}/teamRoles/{roleId}            (catálogo del tenant)
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

// `base` = subárbol del líder dentro del tenant: ['tenants', tenantId, 'leaders', leaderUid].
// `tbase` = árbol del tenant: ['tenants', tenantId].
const peopleCol = (db, base) => collection(db, ...base, 'people');
const personDoc = (db, base, id) => doc(db, ...base, 'people', id);
const readingCol = (db, base, personId, dim) =>
  collection(db, ...base, 'people', personId, dim);
const areaCol = (db, base) => collection(db, ...base, 'areas');
const areaDoc = (db, base, id) => doc(db, ...base, 'areas', id);
// Catálogo de roles a nivel de tenant (compartido por sus líderes).
const teamRoleCol = (db, tbase) => collection(db, ...tbase, 'teamRoles');
const teamRoleDoc = (db, tbase, id) => doc(db, ...tbase, 'teamRoles', id);
const convCol = (db, base, personId) =>
  collection(db, ...base, 'people', personId, 'conversations');
const convDoc = (db, base, personId, id) =>
  doc(db, ...base, 'people', personId, 'conversations', id);
const noteCol = (db, base, personId) =>
  collection(db, ...base, 'people', personId, 'supportNotes');
const noteDoc = (db, base, personId, id) =>
  doc(db, ...base, 'people', personId, 'supportNotes', id);
const settingsDoc = (db, base) => doc(db, ...base, 'config', 'settings');

/** @param {import('firebase/firestore').QuerySnapshot} snap */
const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

function peopleRepo(db, base) {
  return {
    async list() {
      return mapDocs(await getDocs(peopleCol(db, base)));
    },
    async getById(id) {
      const d = await getDoc(personDoc(db, base, id));
      return d.exists() ? { id: d.id, ...d.data() } : null;
    },
    async create(input) {
      const ref = await addDoc(peopleCol(db, base), { ...input });
      return ref.id;
    },
    async update(id, patch) {
      await updateDoc(personDoc(db, base, id), { ...patch });
    },
    async deactivate(id) {
      await updateDoc(personDoc(db, base, id), { active: false, deactivatedAt: new Date().toISOString() });
    },
  };
}

function readingRepo(db, base, dim) {
  return {
    async add(personId, payload) {
      const ref = await addDoc(readingCol(db, base, personId, dim), { ...payload });
      return ref.id;
    },
    async listByPerson(personId) {
      return mapDocs(await getDocs(query(readingCol(db, base, personId, dim), orderBy('date', 'asc'))));
    },
    async latest(personId) {
      const snap = await getDocs(query(readingCol(db, base, personId, dim), orderBy('date', 'desc'), limit(1)));
      const d = snap.docs[0];
      return d ? { id: d.id, ...d.data() } : null;
    },
  };
}

function areaRepo(db, base) {
  return {
    async list() {
      return mapDocs(await getDocs(areaCol(db, base)));
    },
    async create(name) {
      const ref = await addDoc(areaCol(db, base), { name });
      return ref.id;
    },
    async remove(id) {
      await deleteDoc(areaDoc(db, base, id));
    },
  };
}

function teamRoleRepo(db, tbase) {
  return {
    async list() {
      return mapDocs(await getDocs(teamRoleCol(db, tbase)));
    },
    async create(name) {
      const ref = await addDoc(teamRoleCol(db, tbase), { name });
      return ref.id;
    },
    async remove(id) {
      await deleteDoc(teamRoleDoc(db, tbase, id));
    },
  };
}

function conversationRepo(db, base) {
  return {
    async listByPerson(personId) {
      return mapDocs(await getDocs(query(convCol(db, base, personId), orderBy('date', 'asc'))));
    },
    async create(personId, input) {
      const ref = await addDoc(convCol(db, base, personId), { ...input });
      return ref.id;
    },
    async update(personId, id, patch) {
      await setDoc(convDoc(db, base, personId, id), { ...patch }, { merge: true });
    },
  };
}

function supportNoteRepo(db, base, now = () => new Date().toISOString()) {
  return {
    async listByPerson(personId) {
      return mapDocs(await getDocs(query(noteCol(db, base, personId), orderBy('date', 'asc'))));
    },
    async create(personId, text) {
      const ref = await addDoc(noteCol(db, base, personId), { text, date: now() });
      return ref.id;
    },
    async remove(personId, id) {
      await deleteDoc(noteDoc(db, base, personId, id));
    },
  };
}

function configRepo(db, base) {
  return {
    async getSettings() {
      const d = await getDoc(settingsDoc(db, base));
      const data = d.exists() ? d.data() : {};
      return {
        ...DEFAULT_SETTINGS,
        ...data,
        features: { ...DEFAULT_SETTINGS.features, ...(data.features ?? {}) },
      };
    },
    async updateSettings(patch) {
      await setDoc(settingsDoc(db, base), { ...patch }, { merge: true });
    },
  };
}

/**
 * @param {Firestore} db
 * @param {string} tenantId
 * @param {string} leaderUid
 * @returns {PersistencePort}
 */
export function createFirestorePersistence(db, tenantId, leaderUid) {
  if (!db) throw new Error('createFirestorePersistence requiere una instancia de Firestore (db)');
  if (!tenantId || !leaderUid) throw new Error('createFirestorePersistence requiere tenantId y leaderUid');
  const base = ['tenants', tenantId, 'leaders', leaderUid];
  const tbase = ['tenants', tenantId];
  const readings = /** @type {PersistencePort['readings']} */ (
    Object.fromEntries(DIMENSIONS.map((dim) => [dim, readingRepo(db, base, dim)]))
  );
  return {
    people: peopleRepo(db, base),
    readings,
    areas: areaRepo(db, base),
    teamRoles: teamRoleRepo(db, tbase), // catálogo a nivel de tenant
    conversations: conversationRepo(db, base),
    supportNotes: supportNoteRepo(db, base),
    config: configRepo(db, base),
  };
}
