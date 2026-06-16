/**
 * Implementación in-memory del store de tenants (tests/prototipos).
 *
 * @typedef {import('../../domain/ports.js').TenantStore} TenantStore
 */

/**
 * @param {{ tenants?: import('../../domain/types.js').Tenant[], members?: Record<string, import('../../domain/types.js').Member[]> }} [seed]
 * @returns {TenantStore}
 */
export function createMemoryTenantStore(seed = {}) {
  /** @type {Map<string, import('../../domain/types.js').Tenant>} */
  const tenants = new Map((seed.tenants ?? []).map((t) => [t.id, { ...t }]));
  /** @type {Map<string, Map<string, import('../../domain/types.js').Member>>} */
  const members = new Map();
  for (const [tid, list] of Object.entries(seed.members ?? {})) {
    members.set(tid, new Map(list.map((m) => [m.uid, { ...m }])));
  }
  const memberMap = (tid) => {
    if (!members.has(tid)) members.set(tid, new Map());
    return members.get(tid);
  };

  const tenantRepo = {
    async get(id) {
      const t = tenants.get(id);
      return t ? { ...t } : null;
    },
    async getBySlug(slug) {
      for (const t of tenants.values()) if (t.slug === slug) return { ...t };
      return null;
    },
    async getByDomain(host) {
      for (const t of tenants.values()) if ((t.domains ?? []).includes(host)) return { ...t };
      return null;
    },
    async create(input) {
      const id = crypto.randomUUID();
      tenants.set(id, { ...input, id });
      return id;
    },
    async list() {
      return [...tenants.values()].map((t) => ({ ...t }));
    },
  };

  return {
    tenants: tenantRepo,
    members: {
      async list(tid) {
        return [...memberMap(tid).values()].map((m) => ({ ...m }));
      },
      async get(tid, uid) {
        const m = memberMap(tid).get(uid);
        return m ? { ...m } : null;
      },
      async set(tid, uid, role) {
        memberMap(tid).set(uid, { uid, role });
      },
      async remove(tid, uid) {
        memberMap(tid).delete(uid);
      },
    },
  };
}
