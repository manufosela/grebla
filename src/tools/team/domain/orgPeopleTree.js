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
import { hierarchy, tree } from 'd3-hierarchy';

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
 * Coordenadas para pintar el árbol hacia abajo (raíces arriba). Varias raíces
 * cuelgan de una raíz virtual que no se dibuja. Solo geometría.
 * @param {PeopleNode[]} roots
 * @param {{ nodeWidth?: number, nodeHeight?: number, gapX?: number, rowHeight?: number }} [opts]
 * @returns {{
 *   nodes: Array<{ node: PeopleNode, x: number, y: number }>,
 *   links: Array<{ from: string, to: string, x1: number, y1: number, x2: number, y2: number }>,
 *   width: number, height: number,
 * }}
 */
export function peopleTreeLayout(roots, opts = {}) {
  const { nodeWidth = 200, nodeHeight = 74, gapX = 24, rowHeight = 120 } = opts;
  if (!roots || roots.length === 0) return { nodes: [], links: [], width: 0, height: 0 };
  const virtual = { person: { personId: '__root__', name: '' }, children: roots, depth: -1, orphan: false, reports: 0 };
  const root = hierarchy(virtual, (n) => n.children);
  tree().nodeSize([nodeWidth + gapX, rowHeight])(root);
  const real = root.descendants().filter((d) => d.depth > 0);
  const minX = Math.min(...real.map((d) => d.x));
  const maxX = Math.max(...real.map((d) => d.x));
  const maxDepth = Math.max(...real.map((d) => d.depth));
  const shift = -minX + nodeWidth / 2;
  const pos = new Map(real.map((d) => [d.data.person.personId, { x: d.x + shift, y: (d.depth - 1) * rowHeight + nodeHeight / 2 }]));
  const nodes = real.map((d) => ({ node: d.data, ...pos.get(d.data.person.personId) }));
  const links = real
    .filter((d) => d.depth > 1)
    .map((d) => {
      const from = pos.get(d.parent.data.person.personId);
      const to = pos.get(d.data.person.personId);
      return { from: d.parent.data.person.personId, to: d.data.person.personId, x1: from.x, y1: from.y + nodeHeight / 2, x2: to.x, y2: to.y - nodeHeight / 2 };
    });
  return { nodes, links, width: maxX - minX + nodeWidth, height: (maxDepth - 1) * rowHeight + nodeHeight };
}
