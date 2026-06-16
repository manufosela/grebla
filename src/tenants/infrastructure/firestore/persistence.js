/**
 * Implementación Firestore del store de tenants. `db` se inyecta.
 *
 *   /tenants/{id}                      perfil del tenant (slug, name, domains)
 *   /tenants/{id}/members/{uid}        miembro y su rol
 *   /tenantDomains/{host}              mapa host → tenantId (legible antes del login)
 *
 * @typedef {import('firebase/firestore').Firestore} Firestore
 * @typedef {import('../../domain/ports.js').TenantStore} TenantStore
 */
import {
  doc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';

const tenantsCol = (db) => collection(db, 'tenants');
const tenantDoc = (db, id) => doc(db, 'tenants', id);
const membersCol = (db, tid) => collection(db, 'tenants', tid, 'members');
const memberDoc = (db, tid, uid) => doc(db, 'tenants', tid, 'members', uid);
const domainDoc = (db, host) => doc(db, 'tenantDomains', host);

/**
 * @param {Firestore} db
 * @returns {TenantStore}
 */
export function createFirestoreTenantStore(db) {
  if (!db) throw new Error('createFirestoreTenantStore requiere una instancia de Firestore (db)');

  const tenants = {
    async get(id) {
      const d = await getDoc(tenantDoc(db, id));
      return d.exists() ? { id: d.id, ...d.data() } : null;
    },
    async getBySlug(slug) {
      const snap = await getDocs(query(tenantsCol(db), where('slug', '==', slug), limit(1)));
      const d = snap.docs[0];
      return d ? { id: d.id, ...d.data() } : null;
    },
    async getByDomain(host) {
      const mapping = await getDoc(domainDoc(db, host));
      if (!mapping.exists()) return null;
      const tenantId = mapping.data().tenantId;
      return tenantId ? this.get(tenantId) : null;
    },
    async create(input) {
      const ref = await addDoc(tenantsCol(db), { ...input });
      return ref.id;
    },
    async list() {
      const snap = await getDocs(tenantsCol(db));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  };

  return {
    tenants,
    members: {
      async list(tid) {
        const snap = await getDocs(membersCol(db, tid));
        return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      },
      async get(tid, uid) {
        const d = await getDoc(memberDoc(db, tid, uid));
        return d.exists() ? { uid: d.id, ...d.data() } : null;
      },
      async set(tid, uid, role) {
        await setDoc(memberDoc(db, tid, uid), { role }, { merge: true });
      },
      async remove(tid, uid) {
        await deleteDoc(memberDoc(db, tid, uid));
      },
    },
  };
}
