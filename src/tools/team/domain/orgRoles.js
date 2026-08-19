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
 * @property {number|null} [layer]   capa canónica de la pirámide (RMR-TSK-0434); null = auto
 */

/** @param {OrgRole[]} roles @returns {Map<string, OrgRole>} */
const indexById = (roles) => new Map((roles ?? []).map((r) => [r.id, r]));

/** Colores de marca de las ramas canónicas. El resto (ramas creadas por el
 *  superadmin) obtiene un color determinista por hash del id. */
const CANONICAL_BRANCH_COLORS = {
  engineering: '#2a9d8f',
  product: '#e76f51',
  people: '#9d4edd',
  data: '#457b9d',
  generico: '#6b7280',
};

/**
 * Fallback de color de una rama: el de marca si es canónica; si no, un HSL
 * DETERMINISTA derivado del id (misma rama → mismo color, siempre).
 * @param {string} key @returns {string} color CSS sólido
 */
function branchColorFallback(key) {
  if (CANONICAL_BRANCH_COLORS[key]) return CANONICAL_BRANCH_COLORS[key];
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 58%)`;
}

/** Paleta de las CAPAS de la pirámide invertida (RMR-BUG-0072): la base (depth 0)
 *  en el acento; hacia arriba, tonos distintos que separan cada estrato. */
const LAYER_COLORS = ['#2a9d8f', '#e9c46a', '#457b9d', '#9d4edd', '#e76f51', '#5fa8d3'];

/**
 * Color propio de una CAPA de la pirámide por su profundidad (0 = base). Cíclico
 * si hay más estratos que colores. Función PURA.
 * @param {number} depth @returns {string} color CSS
 */
export function layerColor(depth) {
  const d = Number.isInteger(depth) && depth >= 0 ? depth : 0;
  return LAYER_COLORS[d % LAYER_COLORS.length];
}

/**
 * Color de una rama por su id, como expresión CSS. Preserva el contrato de override
 * por variable (`var(--rm-branch-<id>, …)`) para que un tema pueda re-teñir una rama,
 * PERO con un fallback DETERMINISTA por id (no el acento): así cualquier rama —canónica
 * o creada por el superadmin— tiene un color propio y estable aunque no exista la
 * variable, y funciona fuera de `.pyramid`. Función PURA.
 * @param {string} id @returns {string} color CSS
 */
export function branchColor(id) {
  const key = id || 'generico';
  return `var(--rm-branch-${key}, ${branchColorFallback(key)})`;
}

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
 * Filas del editor de roles ORDENADAS POR DEPENDENCIAS (la rama es un dato de la
 * fila, NO el criterio de agrupación — agrupar por rama rompía la cadena cuando
 * una dependencia cruza de rama, p.ej. Head of Engineering → CPO). Cada árbol de
 * dependencias sale CONTIGUO en post-orden: hojas arriba, cada rol encima de su
 * «depende de», y el rol base «sin inferior» al final del bloque (coherente con la
 * pirámide invertida). Cada fila marca `firstOfTree` (primera de su árbol) para la
 * línea separadora SOLO entre árboles. Función PURA.
 * @param {OrgRole[]} roles
 * @returns {{ role: OrgRole, depth: number, firstOfTree: boolean }[]}
 */
export function orgRoleRows(roles) {
  const list = roles ?? [];
  const rows = [];
  const visit = (role, depth, acc) => {
    for (const child of childrenOf(list, role.id)) visit(child, depth + 1, acc);
    acc.push({ role, depth });
  };
  for (const root of rootRoles(list)) {
    const tree = [];
    visit(root, 0, tree);
    tree.forEach((r, i) => rows.push({ role: r.role, depth: r.depth, firstOfTree: i === 0 }));
  }
  // Roles en un ciclo preexistente (no alcanzables desde una cima) igualmente listados.
  const shown = new Set(rows.map((r) => r.role.id));
  const orphans = list.filter((r) => !shown.has(r.id));
  orphans.forEach((r, i) => rows.push({ role: r, depth: 0, firstOfTree: i === 0 }));
  return rows;
}

/**
 * Candidatos a «superior» de una persona, derivados del organigrama de ROLES
 * (RMR-TSK-0361): el superior de alguien con rol X son las personas cuyo rol es
 * el `reportsToRoleId` de X — un manager reporta a heads, no a otros managers;
 * un head al CTO; y varios heads/CTO caben sin cablear nada. Casos límite
 * honestos: rol cima → sin candidatos (solo «no reporta a nadie»); persona sin
 * rol (o rol fuera del catálogo) → todas las demás (no derivable: no se bloquea
 * la gestión); rol superior sin personas → lista vacía CON el rol, para que la
 * UI avise («aún no hay nadie con rol Head»). Nunca se ofrece a sí misma.
 * @param {{ id: string, orgRole?: string|null }} person
 * @param {ReadonlyArray<{ id: string, orgRole?: string|null }>} people
 * @param {OrgRole[]} roles
 * @returns {{ candidates: Array<{ id: string, orgRole?: string|null }>, superiorRole: OrgRole|null }}
 */
export function superiorCandidatesFor(person, people, roles) {
  const others = (people ?? []).filter((p) => p.id !== person?.id);
  const role = (roles ?? []).find((r) => r.id === person?.orgRole) ?? null;
  if (!role) return { candidates: others, superiorRole: null };
  const superiorRole = (roles ?? []).find((r) => r.id === role.reportsToRoleId) ?? null;
  if (!superiorRole) return { candidates: [], superiorRole: null };
  return { candidates: others.filter((p) => p.orgRole === superiorRole.id), superiorRole };
}

/**
 * Capa CANÓNICA de un rol (RMR-TSK-0434): dónde vive en la pirámide — 0 la
 * cima de responsabilidad (dirección), y hacia arriba heads, EMs, ICs. La capa
 * declarada (`role.layer`, editable en el panel) MANDA; sin declarar (o
 * inválida) cae a la profundidad de su cadena, que era el comportamiento de
 * siempre. Así una rama joven (Data: Head con ICs directos) coloca a sus
 * ingenieros en la capa de ICs aunque su cadena sea corta.
 * @param {OrgRole[]} roles
 * @param {OrgRole} role
 * @returns {number}
 */
export function layerOf(roles, role) {
  const declared = role?.layer;
  if (Number.isInteger(declared) && declared >= 0) return declared;
  return roleDepth(roles, role?.id);
}

/**
 * Filas de la pirámide agrupadas por CAPA (de la cima 0 hacia arriba), no por
 * profundidad de cadena. Capas sin roles no generan fila (el hueco lo cuentan
 * las flechas y el badge de «ejerce también de»).
 * @param {OrgRole[]} roles
 * @returns {{ layer: number, roles: OrgRole[] }[]}
 */
export function pyramidLayers(roles) {
  const list = roles ?? [];
  const byLayer = new Map();
  for (const role of list) {
    const layer = layerOf(list, role);
    byLayer.set(layer, [...(byLayer.get(layer) ?? []), role]);
  }
  return [...byLayer.entries()]
    .toSorted((a, b) => a[0] - b[0])
    .map(([layer, layerRoles]) => ({ layer, roles: layerRoles }));
}

/**
 * Labels de los roles de las capas que un mando SALTA hacia sus hijos (RMR-TSK-0434):
 * un Head con ICs directos (hijo dos capas más arriba) «ejerce también de EM».
 * Solo nombran la capa los roles DE MANDO (con hijos en el catálogo): un IC que
 * viva en esa capa (p. ej. un PM colgado del CPO) no es un rol que nadie
 * «ejerza» — listarlo confunde. Labels únicos, de cualquier rama; vacío si no
 * salta ninguna capa o si las saltadas no tienen mandos que les den nombre.
 * @param {OrgRole[]} roles
 * @param {OrgRole} role
 * @returns {string[]}
 */
export function coveredRoleLabels(roles, role) {
  const list = roles ?? [];
  const own = layerOf(list, role);
  const skipped = new Set();
  for (const child of childrenOf(list, role?.id)) {
    const childLayer = layerOf(list, child);
    for (let layer = own + 1; layer < childLayer; layer += 1) skipped.add(layer);
  }
  const labels = list
    .filter((r) => skipped.has(layerOf(list, r)))
    .filter((r) => childrenOf(list, r.id).length > 0)
    .map((r) => r.label)
    .filter(Boolean);
  return [...new Set(labels)];
}
