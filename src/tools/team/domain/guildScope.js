/**
 * Qué departamentos tienen gremios (RMR-TSK-0593). Los gremios son de GREBLA y
 * hoy solo los tiene Tech; el resto de departamentos son un gremio único que
 * no hace falta nombrar. Lo dice el catálogo (`/orgBranches/{id}.hasGuilds`),
 * no el código: GREBLA es genérica. Puro.
 * @param {string|null|undefined} branchId @param {Array<{ id: string, hasGuilds?: boolean }>} branches
 * @returns {boolean}
 */
export function departmentHasGuilds(branchId, branches) {
  return branches.some((b) => b.id === branchId && b.hasGuilds === true);
}
