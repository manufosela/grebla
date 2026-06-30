/**
 * Implementación Firestore del puerto de persistencia (PersistencePort).
 * Multi-tenant: personas, áreas y catálogos viven a NIVEL DE TENANT (no bajo el
 * líder), para poder compartir/transferir personas entre líderes. Cada persona
 * lleva ownerLeaderUid; el líder ve por defecto las suyas (filtro por owner).
 *
 *   /tenants/{tenantId}/people/{personId}              (con ownerLeaderUid, sharedWith)
 *       .../people/{personId}/{seniority|emotional|knowledge|contribution}/{readingId}
 *       .../people/{personId}/conversations/{convId}
 *       .../people/{personId}/supportNotes/{noteId}
 *   /tenants/{tenantId}/areas/{areaId}
 *   /tenants/{tenantId}/config/settings
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
  where,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { DIMENSIONS, DEFAULT_SETTINGS } from '../../domain/types.js';

// `base` = árbol del tenant: ['tenants', tenantId]. Las personas viven aquí
// (no bajo el líder) y se distinguen por ownerLeaderUid.
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

function peopleRepo(db, base, leaderUid) {
  return {
    async list() {
      // Las personas visibles para este líder: las suyas (ownerLeaderUid) + las
      // compartidas con él (sharedWithUids array-contains). Firestore no hace OR
      // sobre campos distintos, así que son dos consultas + merge con dedup por id.
      const [owned, shared] = await Promise.all([
        getDocs(query(peopleCol(db, base), where('ownerLeaderUid', '==', leaderUid))),
        getDocs(query(peopleCol(db, base), where('sharedWithUids', 'array-contains', leaderUid))),
      ]);
      const byId = new Map();
      for (const d of [...owned.docs, ...shared.docs]) byId.set(d.id, { id: d.id, ...d.data() });
      return [...byId.values()];
    },
    async getById(id) {
      const d = await getDoc(personDoc(db, base, id));
      return d.exists() ? { id: d.id, ...d.data() } : null;
    },
    async create(input) {
      const ref = await addDoc(peopleCol(db, base), { ...input, ownerLeaderUid: leaderUid });
      return ref.id;
    },
    async update(id, patch) {
      await updateDoc(personDoc(db, base, id), { ...patch });
    },
    async deactivate(id) {
      await updateDoc(personDoc(db, base, id), { active: false, deactivatedAt: new Date().toISOString() });
    },
    async share(id, sharedLeaderUid, permission) {
      // sharedWith (mapa) lleva el permiso; sharedWithUids (array) es su espejo
      // para poder consultar con array-contains en list().
      await updateDoc(personDoc(db, base, id), {
        [`sharedWith.${sharedLeaderUid}`]: permission,
        sharedWithUids: arrayUnion(sharedLeaderUid),
      });
    },
    async unshare(id, sharedLeaderUid) {
      await updateDoc(personDoc(db, base, id), {
        [`sharedWith.${sharedLeaderUid}`]: deleteField(),
        sharedWithUids: arrayRemove(sharedLeaderUid),
      });
    },
    async transfer(id, newLeaderUid) {
      // Transferencia total: nuevo dueño y se le retira de sharedWith (ya es owner).
      await updateDoc(personDoc(db, base, id), {
        ownerLeaderUid: newLeaderUid,
        [`sharedWith.${newLeaderUid}`]: deleteField(),
        sharedWithUids: arrayRemove(newLeaderUid),
      });
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
  const base = ['tenants', tenantId];
  const readings = /** @type {PersistencePort['readings']} */ (
    Object.fromEntries(DIMENSIONS.map((dim) => [dim, readingRepo(db, base, dim)]))
  );
  return {
    people: peopleRepo(db, base, leaderUid),
    readings,
    areas: areaRepo(db, base),
    teamRoles: teamRoleRepo(db, base), // catálogo a nivel de tenant
    conversations: conversationRepo(db, base),
    supportNotes: supportNoteRepo(db, base),
    config: configRepo(db, base),
  };
}
