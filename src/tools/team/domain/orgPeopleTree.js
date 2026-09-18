/**
 * Árbol de PERSONAS del organigrama estándar (RMR-PCS-0042 · F1): quién reporta
 * a quién, y nada más. Lógica pura: ni Firestore ni Lit.
 *
 * La jerarquía es `reportsToPersonId` (la relación Manager de Notion cuando el
 * censo viene de allí). Se dibuja hacia ABAJO, como el organigrama clásico que
 * pide el plan de igualdad: la pirámide invertida de GREBLA es la otra vista y
 * vive en orgTreeLayout.js sobre ROLES, no sobre personas.
 *
 * Reglas que defiende:
 *  - quien no reporta a nadie es raíz; quien reporta a alguien que no está (baja,
 *    inactivo, dato roto) también, marcado como huérfano: nadie desaparece;
 *  - un ciclo en los datos no cuelga nada: lo inalcanzable se saca como raíz;
 *  - los hijos van primero los que tienen equipo, luego por nombre, como en el
 *    portal, para que ramas y hojas no se mezclen.
 */
/**
 * @typedef {Object} DirectoryPerson
 * @property {string} personId
 * @property {string} name
 * @property {string|null} [reportsToPersonId]
 * @property {string|null} [orgRole]
 * @property {string|null} [orgBranch]
 * @property {{ role?: string|null, level?: string|null, department?: string|null, team?: string|null, type?: string|null }|null} [notion]
 *
 * @typedef {Object} PeopleNode
 * @property {DirectoryPerson} person
 * @property {PeopleNode[]} children
 * @property {number} depth
 * @property {boolean} orphan   reporta a alguien que no está en el censo
 * @property {number} reports  descendientes en total
 */

const byName = (a, b) => a.person.name.localeCompare(b.person.name, 'es');
const branchesFirst = (a, b) => (b.children.length > 0) - (a.children.length > 0) || byName(a, b);

/**
 * @param {DirectoryPerson[]} people
 * @returns {{ roots: PeopleNode[], byId: Map<string, PeopleNode>, total: number }}
 */
export function buildPeopleTree(people) {
  const list = (people ?? []).filter((p) => p?.personId && p.name);
  const byId = new Map(list.map((p) => [p.personId, { person: p, children: [], depth: 0, orphan: false, reports: 0 }]));
  const roots = [];
  for (const node of byId.values()) {
    const managerId = node.person.reportsToPersonId ?? null;
    const manager = managerId ? byId.get(managerId) : null;
    if (manager && manager !== node) manager.children.push(node);
    else {
      node.orphan = Boolean(managerId);
      roots.push(node);
    }
  }
  // Lo inalcanzable desde una raíz es un ciclo: se corta por su primer miembro
  // en orden de nombre y pasa a ser raíz huérfana.
  const seen = new Set();
  const visit = (node, depth) => {
    if (seen.has(node.person.personId)) return;
    seen.add(node.person.personId);
    node.depth = depth;
    node.children.sort(branchesFirst);
    for (const c of node.children) visit(c, depth + 1);
  };
  roots.sort(branchesFirst);
  for (const r of roots) visit(r, 0);
  const pending = [...byId.values()].filter((n) => !seen.has(n.person.personId)).sort(byName);
  for (const node of pending) {
    if (seen.has(node.person.personId)) continue;
    const manager = byId.get(node.person.reportsToPersonId);
    if (manager) manager.children = manager.children.filter((c) => c !== node);
    node.orphan = true;
    roots.push(node);
    visit(node, 0);
  }
  for (const r of roots) countReports(r);
  return { roots, byId, total: list.length };
}

/** @param {PeopleNode} node @returns {number} */
function countReports(node) {
  node.reports = node.children.reduce((n, c) => n + 1 + countReports(c), 0);
  return node.reports;
}

/**
 * Puesto que se muestra: el de Notion si el censo viene de allí; si no, el
 * rótulo del rol GREBLA. Sin ninguno, cadena vacía (no se inventa).
 * @param {DirectoryPerson} person
 * @param {Map<string, string>|Record<string, string>} roleLabels  orgRole id → rótulo
 * @returns {string}
 */
export function personTitle(person, roleLabels = {}) {
  const notionRole = person?.notion?.role;
  if (notionRole) return String(notionRole);
  const id = person?.orgRole ?? '';
  const label = roleLabels instanceof Map ? roleLabels.get(id) : roleLabels[id];
  return label ? String(label) : '';
}

/**
 * Separa las raíces que forman árbol (tienen a alguien a su cargo) de las
 * PERSONAS SUELTAS: sin manager y sin reportes. Pintarlas como raíces en la
 * misma fila que el árbol real multiplicaba el ancho (RMR-BUG-0126); van en un
 * bloque aparte, con su aviso si reportaban a alguien que no está.
 * @param {PeopleNode[]} roots
 * @returns {{ tree: PeopleNode[], loose: PeopleNode[] }}
 */
export function splitLoose(roots) {
  const all = roots ?? [];
  return { tree: all.filter((r) => r.children.length > 0), loose: all.filter((r) => r.children.length === 0) };
}

/** Columnas de la rejilla de hojas: hasta 3 en línea; más, en rejilla de 3 o 4. */
export function leafColumns(n) {
  if (n <= 3) return n;
  return n <= 8 ? 3 : 4;
}

/**
 * Coordenadas para pintar el árbol hacia abajo (raíces arriba). Solo geometría.
 *
 * Los hijos CON equipo van uno al lado de otro con su subárbol; los hijos
 * hoja se apilan en REJILLA bajo el manager (`leafColumns`), como el portal:
 * un equipo de nueve no ocupa nueve columnas sino tres. Las aristas salen ya
 * trazadas (`d`): codo para los subárboles y espina por columna para la
 * rejilla, así ninguna línea cruza una tarjeta.
 * @param {PeopleNode[]} roots
 * @param {{ nodeWidth?: number, nodeHeight?: number, gapX?: number, rowHeight?: number }} [opts]
 * @returns {{
 *   nodes: Array<{ node: PeopleNode, x: number, y: number }>,
 *   links: Array<{ from: string, to: string, d: string }>,
 *   width: number, height: number,
 * }}
 */
export function peopleTreeLayout(roots, opts = {}) {
  const { nodeWidth = 200, nodeHeight = 74, gapX = 24, rowHeight = 120 } = opts;
  const list = roots ?? [];
  if (list.length === 0) return { nodes: [], links: [], width: 0, height: 0 };
  const nodes = [];
  const links = [];
  const spine = 12; // separación de la espina respecto a la tarjeta
  const midOf = (top) => top - (rowHeight - nodeHeight) / 2; // mitad del hueco entre filas

  /** Ancho y filas que ocupa un subárbol (memoizado en el nodo). */
  const measure = (node) => {
    if (node._m) return node._m;
    const branches = node.children.filter((c) => c.children.length > 0);
    const leaves = node.children.filter((c) => c.children.length === 0);
    const cols = leafColumns(leaves.length);
    // La rejilla reserva a su izquierda el hueco de la espina por la que entran las filas segunda y siguientes.
    const leafRows = cols > 0 ? Math.ceil(leaves.length / cols) : 0;
    const leafSpine = leafRows > 1 ? spine : 0; // una sola fila entra por arriba: sin espina
    const leafW = cols > 0 ? leafSpine + cols * nodeWidth + (cols - 1) * gapX : 0;
    const blocks = [...branches.map((b) => measure(b).width), ...(leafW ? [leafW] : [])];
    const inner = blocks.reduce((a, b) => a + b, 0) + Math.max(0, blocks.length - 1) * gapX;
    const rows = 1 + Math.max(leafRows, ...branches.map((b) => measure(b).rows), 0);
    node._m = { width: Math.max(nodeWidth, inner), rows, branches, leaves, cols, leafSpine, inner };
    return node._m;
  };

  /** Coloca el subárbol con su esquina izquierda en `left` y su fila en `row`. */
  const place = (node, left, row) => {
    const m = measure(node);
    const x = left + m.width / 2;
    const y = row * rowHeight + nodeHeight / 2;
    nodes.push({ node, x, y });
    let cursor = left + (m.width - m.inner) / 2;
    const childTop = (row + 1) * rowHeight;
    const midY = midOf(childTop);
    for (const b of m.branches) {
      const bm = measure(b);
      const bx = cursor + bm.width / 2;
      links.push({ from: node.person.personId, to: b.person.personId, d: `M${x},${y + nodeHeight / 2} V${midY} H${bx} V${childTop}` });
      place(b, cursor, row + 1);
      cursor += bm.width + gapX;
    }
    if (m.cols > 0) {
      const gridLeft = cursor + m.leafSpine;
      m.leaves.forEach((leaf, i) => {
        const col = i % m.cols;
        const r = Math.floor(i / m.cols);
        const lx = gridLeft + col * (nodeWidth + gapX) + nodeWidth / 2;
        const ly = (row + 1 + r) * rowHeight + nodeHeight / 2;
        nodes.push({ node: leaf, x: lx, y: ly });
        const d = r === 0
          ? `M${x},${y + nodeHeight / 2} V${midY} H${lx} V${ly - nodeHeight / 2}`
          : `M${x},${y + nodeHeight / 2} V${midY} H${lx - nodeWidth / 2 - spine} V${ly} H${lx - nodeWidth / 2}`;
        links.push({ from: node.person.personId, to: leaf.person.personId, d });
      });
    }
  };

  let left = 0;
  let rows = 0;
  for (const r of list) {
    const m = measure(r);
    place(r, left, 0);
    left += m.width + gapX * 2;
    rows = Math.max(rows, m.rows);
  }
  for (const n of nodes) delete n.node._m;
  return { nodes, links, width: left - gapX * 2, height: (rows - 1) * rowHeight + nodeHeight };
}
