/**
 * Implementación Firestore del puerto de persistencia (PersistencePort).
 * Multi-leader: personas, áreas y catálogos viven a NIVEL DE INSTANCIA (raíz, no
 * bajo el líder), para poder compartir/transferir personas entre líderes. Cada
 * persona lleva ownerLeaderUid; el líder ve por defecto las suyas (filtro por owner).
 *
 *   /people/{personId}              (con ownerLeaderUid, sharedWith)
 *       .../people/{personId}/{seniority|emotional|knowledge|contribution}/{readingId}
 *       .../people/{personId}/conversations/{convId}
 *       .../people/{personId}/supportNotes/{noteId}
 *   /areas/{areaId}
 *   /config/settings
 *   /guilds/{guildId}             (catálogo de la instancia)
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

// `base` = raíz de la instancia: []. Las personas viven aquí (no bajo el líder)
// y se distinguen por ownerLeaderUid.
const peopleCol = (db, base) => collection(db, ...base, 'people');
const personDoc = (db, base, id) => doc(db, ...base, 'people', id);
const readingCol = (db, base, personId, dim) =>
  collection(db, ...base, 'people', personId, dim);
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

function peopleRepo(db, base, leaderUid, viewAll = false) {
  return {
    async list() {
      // La self-ficha de un manager (RMR-TSK-0251) es un miembro MÁS de su equipo
      // (RMR-BUG-0041): pertenece al equipo para que el manager pueda comprobar la
      // experiencia real del resto como uno más. No se excluye del roster.
      // El superadmin (viewAll) ve TODAS las personas de la organización (las
      // reglas ya se lo permiten), para poder gestionarlas y hacerles notas/O2O.
      if (viewAll) {
        const all = await getDocs(peopleCol(db, base));
        return all.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
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
    async reactivate(id) {
      // Restaurar una baja errónea: vuelve activa y borra la fecha de baja
      // (conserva su histórico completo; solo cambia el estado).
      await updateDoc(personDoc(db, base, id), { active: true, deactivatedAt: deleteField() });
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
      // Sin nuevo líder → soltar: se quita el dueño (queda en el pool del superadmin).
      if (!newLeaderUid) {
        await updateDoc(personDoc(db, base, id), { ownerLeaderUid: deleteField() });
        return;
      }
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

/**
 * Repo genérico de un catálogo con ámbito (areas|guilds|labels). El catálogo es
 * pequeño: se lee entero y se filtra en cliente (no hay OR en Firestore).
 *  - list(): superadmin (viewAll) ve TODOS (incl. personales de otros líderes);
 *    el líder ve globales + los suyos.
 *  - create(): superadmin crea GLOBAL (sin ownerLeaderUid); el líder, PERSONAL.
 *  - promote(): personal → global (quita ownerLeaderUid).
 */
function catalogRepo(db, base, kind, leaderUid, viewAll = false) {
  const col = () => collection(db, ...base, kind);
  const ref = (id) => doc(db, ...base, kind, id);
  return {
    async list() {
      const all = mapDocs(await getDocs(col()));
      return viewAll ? all : all.filter((i) => !i.ownerLeaderUid || i.ownerLeaderUid === leaderUid);
    },
    async create(name, extra = {}) {
      // `extra` (solo labels) fija subLabel/color; se filtran los vacíos porque
      // Firestore rechaza `undefined` y no queremos claves en blanco.
      const meta = {};
      const subLabel = String(extra.subLabel ?? '').trim();
      const color = String(extra.color ?? '').trim();
      if (subLabel) meta.subLabel = subLabel;
      if (color) meta.color = color;
      const data = viewAll ? { name, ...meta } : { name, ...meta, ownerLeaderUid: leaderUid };
      const created = await addDoc(col(), data);
      return created.id;
    },
    async update(id, patch) {
      await updateDoc(ref(id), { ...patch });
    },
    async remove(id) {
      await deleteDoc(ref(id));
    },
    async promote(id) {
      await updateDoc(ref(id), { ownerLeaderUid: deleteField() });
    },
  };
}

function conversationRepo(db, base) {
  return {
    async listByPerson(personId) {
      return mapDocs(await getDocs(query(convCol(db, base, personId), orderBy('date', 'asc'))));
    },
    async create(personId, input) {
      // Firestore rechaza `undefined`: no propagamos createdBy si no viene definido.
      const data = { ...input };
      if (data.createdBy === undefined) delete data.createdBy;
      const ref = await addDoc(convCol(db, base, personId), data);
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
    async create(personId, text, author) {
      // Firestore rechaza `undefined`: solo incluimos createdBy si hay autor.
      const data = { text, date: now() };
      if (author) data.createdBy = author;
      const ref = await addDoc(noteCol(db, base, personId), data);
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
 * @param {string} leaderUid
 * @param {{ viewAll?: boolean }} [options]  viewAll=true (superadmin): lista TODAS las personas.
 * @returns {PersistencePort}
 */
export function createFirestorePersistence(db, leaderUid, options = {}) {
  if (!db) throw new Error('createFirestorePersistence requiere una instancia de Firestore (db)');
  if (!leaderUid) throw new Error('createFirestorePersistence requiere leaderUid');
  const { viewAll = false } = options;
  const base = [];
  const readings = /** @type {PersistencePort['readings']} */ (
    Object.fromEntries(DIMENSIONS.map((dim) => [dim, readingRepo(db, base, dim)]))
  );
  return {
    people: peopleRepo(db, base, leaderUid, viewAll),
    readings,
    areas: catalogRepo(db, base, 'areas', leaderUid, viewAll), // catálogo con ámbito
    guilds: catalogRepo(db, base, 'guilds', leaderUid, viewAll),
    labels: catalogRepo(db, base, 'labels', leaderUid, viewAll),
    // Squads: catálogo de la organización (RMR-TSK-0275). Reusa el repo
    // genérico; en la práctica se crean globales desde el panel.
    squads: catalogRepo(db, base, 'squads', leaderUid, viewAll),
    conversations: conversationRepo(db, base),
    supportNotes: supportNoteRepo(db, base),
    config: configRepo(db, base),
  };
}
