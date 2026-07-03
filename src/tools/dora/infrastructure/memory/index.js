/**
 * Implementación in-memory de la persistencia DORA (para tests y prototipos).
 *
 * @typedef {import('../../domain/types.js').DoraRepo} DoraRepo
 * @typedef {import('../../domain/ports.js').DoraPersistence} DoraPersistence
 */

/**
 * @param {DoraRepo[]} [seed]
 * @param {{ leaderUid?: string, viewAll?: boolean }} [options]  Espeja el adapter
 *   Firestore: `leaderUid` se estampa como ownerLeaderUid al crear y filtra la
 *   lista salvo `viewAll`. Si no se pasa `leaderUid`, no hay estampado ni filtro
 *   (comportamiento plano de los tests existentes).
 * @returns {DoraPersistence}
 */
export function createMemoryDoraPersistence(seed = [], options = {}) {
  const { leaderUid = null, viewAll = false } = options;
  /** @type {Map<string, DoraRepo>} */
  const store = new Map(seed.map((r) => [r.id, { ...r }]));
  /** @type {Map<string, import('../../domain/types.js').Deployment[]>} eventos por repoId */
  const deploymentsStore = new Map();
  /** @type {Map<string, import('../../domain/types.js').Incident[]>} incidentes por repoId */
  const incidentsStore = new Map();

  return {
    repos: {
      async list() {
        const all = [...store.values()].map((r) => ({ ...r }));
        if (viewAll || !leaderUid) return all;
        return all.filter((r) => r.ownerLeaderUid === leaderUid);
      },
      async add(input) {
        const id = crypto.randomUUID();
        store.set(id, { ...input, ...(leaderUid ? { ownerLeaderUid: leaderUid } : {}), id });
        return id;
      },
      async update(id, patch) {
        const repo = store.get(id);
        if (!repo) throw new Error(`Repo ${id} no existe`);
        store.set(id, { ...repo, ...patch, id });
      },
      async remove(id) {
        if (!store.delete(id)) throw new Error(`Repo ${id} no existe`);
      },
    },
    deployments: {
      async add(repoId, event) {
        const id = crypto.randomUUID();
        const list = deploymentsStore.get(repoId) ?? [];
        list.push({ ...event, id });
        deploymentsStore.set(repoId, list);
        return id;
      },
      async listByRepo(repoId) {
        const list = deploymentsStore.get(repoId) ?? [];
        return list
          .map((e) => ({ ...e }))
          .sort((a, b) => String(b.at).localeCompare(String(a.at)));
      },
      async remove(repoId, id) {
        const list = deploymentsStore.get(repoId) ?? [];
        const next = list.filter((e) => e.id !== id);
        if (next.length === list.length) throw new Error(`Despliegue ${id} no existe en ${repoId}`);
        deploymentsStore.set(repoId, next);
      },
    },
    incidents: {
      async add(repoId, incident) {
        const id = crypto.randomUUID();
        const list = incidentsStore.get(repoId) ?? [];
        list.push({ ...incident, id });
        incidentsStore.set(repoId, list);
        return id;
      },
      async listByRepo(repoId) {
        const list = incidentsStore.get(repoId) ?? [];
        return list
          .map((i) => ({ ...i }))
          .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
      },
      async update(repoId, id, patch) {
        const list = incidentsStore.get(repoId) ?? [];
        const idx = list.findIndex((i) => i.id === id);
        if (idx === -1) throw new Error(`Incidente ${id} no existe en ${repoId}`);
        list[idx] = { ...list[idx], ...patch, id };
        incidentsStore.set(repoId, list);
      },
      async remove(repoId, id) {
        const list = incidentsStore.get(repoId) ?? [];
        const next = list.filter((i) => i.id !== id);
        if (next.length === list.length) throw new Error(`Incidente ${id} no existe en ${repoId}`);
        incidentsStore.set(repoId, next);
      },
    },
  };
}
