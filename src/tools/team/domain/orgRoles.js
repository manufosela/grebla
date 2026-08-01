/**
 * Catálogo de ROLES/NIVELES del organigrama (RMR-PCS-0027 · F2). Lógica pura, sin
 * Firestore ni Lit.
 *
 * Cada rol (`/orgRoles/{id}`) tiene un `label`, una `branch` y un `reportsToRoleId`
 * que apunta a su rol SUPERIOR en el organigrama (null = cima). El superadmin crea,
 * edita y REORDENA estos roles libremente: invertir la jerarquía (p.ej. que Head
 * pase por encima de CTO) es solo cambiar punteros `reportsToRoleId`. La ÚNICA
 * regla es que no se formen ciclos.
 *
 * @typedef {'engineering'|'product'|'people'|'data'|'generico'|string} OrgBranch
 * @typedef {Object} OrgRole
 * @property {string} id
 * @property {string} label
 * @property {OrgBranch} branch
 * @property {string|null} reportsToRoleId   rol superior, o null si es cima
 */

/** @param {OrgRole[]} roles @returns {Map<string, OrgRole>} */
const indexById = (roles) => new Map((roles ?? []).map((r) => [r.id, r]));

/**
 * Roles cima (sin superior). Un organigrama puede tener varias cimas (una por
 * rama: CTO en engineering, CPO en product, etc.).
 * @param {OrgRole[]} roles @returns {OrgRole[]}
 */
export function rootRoles(roles) {
  return (roles ?? []).filter((r) => !r.reportsToRoleId);
}

/**
 * Hijos directos de un rol (los que le reportan).
 * @param {OrgRole[]} roles @param {string} roleId @returns {OrgRole[]}
 */
export function childrenOf(roles, roleId) {
  return (roles ?? []).filter((r) => r.reportsToRoleId === roleId);
}

/**
 * Cadena ascendente de un rol hasta su cima: [rol, superior, ..., cima]. Corta con
 * seguridad si detecta un ciclo preexistente (no repite un id ya visto).
 * @param {OrgRole[]} roles @param {string} roleId @returns {OrgRole[]}
 */
export function roleChain(roles, roleId) {
  const byId = indexById(roles);
  const chain = [];
  const seen = new Set();
  let cur = byId.get(roleId) ?? null;
  while (cur && !seen.has(cur.id)) {
    chain.push(cur);
    seen.add(cur.id);
    cur = cur.reportsToRoleId ? (byId.get(cur.reportsToRoleId) ?? null) : null;
  }
  return chain;
}

/**
 * ¿Asignar `parentId` como superior de `roleId` crearía un ciclo? Cierto si
 * parentId === roleId o si roleId es (transitivamente) ancestro de parentId.
 * @param {OrgRole[]} roles @param {string} roleId @param {string|null} parentId
 * @returns {boolean}
 */
export function wouldCycle(roles, roleId, parentId) {
  if (!parentId) return false;
  if (parentId === roleId) return true;
  // Subiendo desde parentId no debemos encontrar roleId.
  const byId = indexById(roles);
  const seen = new Set();
  let cur = byId.get(parentId) ?? null;
  while (cur && !seen.has(cur.id)) {
    if (cur.id === roleId) return true;
    seen.add(cur.id);
    cur = cur.reportsToRoleId ? (byId.get(cur.reportsToRoleId) ?? null) : null;
  }
  return false;
}

/**
 * Valida una reasignación de superior; lanza con mensaje claro si es inválida.
 * @param {OrgRole[]} roles @param {string} roleId @param {string|null} parentId
 * @returns {void}
 */
export function assertValidReportsTo(roles, roleId, parentId) {
  if (parentId === roleId) throw new Error('Un rol no puede depender de sí mismo.');
  if (parentId && !indexById(roles).has(parentId)) {
    throw new Error(`El rol superior «${parentId}» no existe.`);
  }
  if (wouldCycle(roles, roleId, parentId)) {
    throw new Error('Esa dependencia crearía un ciclo en el organigrama.');
  }
}

/**
 * Profundidad de un rol (0 = cima). Útil para ordenar/indentar el organigrama.
 * @param {OrgRole[]} roles @param {string} roleId @returns {number}
 */
export function roleDepth(roles, roleId) {
  return Math.max(0, roleChain(roles, roleId).length - 1);
}

/**
 * Filas del editor de roles AGRUPADAS por rama (RMR-TSK-0375): dentro de cada
 * rama, orden jerárquico post-orden (hijos antes que el padre → hojas arriba, el
 * rol base «sin inferior» abajo, coherente con la pirámide invertida). Las ramas
 * van en el orden de `branches` (catálogo) y luego las presentes en algún rol sin
 * metadato. Cada fila marca `firstOfBranch` (primera de su bloque) para dibujar la
 * línea separadora SOLO entre ramas. Función PURA.
 * @param {OrgRole[]} roles
 * @param {{id:string}[]} [branches] catálogo de ramas, para el orden de los bloques
 * @returns {{ role: OrgRole, depth: number, firstOfBranch: boolean }[]}
 */
export function orgRoleRows(roles, branches = []) {
  const list = roles ?? [];
  const hier = [];
  const visit = (role, depth) => {
    for (const child of childrenOf(list, role.id)) visit(child, depth + 1);
    hier.push({ role, depth });
  };
  for (const root of rootRoles(list)) visit(root, 0);
  // Roles en un ciclo preexistente (no alcanzables desde una cima) igualmente listados.
  const shown = new Set(hier.map((r) => r.role.id));
  for (const r of list) if (!shown.has(r.id)) hier.push({ role: r, depth: 0 });
  // Orden de ramas: catálogo primero, luego ramas presentes sin metadato; dedup.
  const seen = new Set();
  const order = [...(branches ?? []).map((b) => b.id), ...hier.map((r) => r.role.branch)]
    .filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  const rows = [];
  for (const branchId of order) {
    const inBranch = hier.filter((r) => r.role.branch === branchId);
    inBranch.forEach((r, i) => rows.push({ role: r.role, depth: r.depth, firstOfBranch: i === 0 }));
  }
  return rows;
}
