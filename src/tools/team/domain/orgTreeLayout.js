/**
 * Layout del organigrama como ÁRBOL INVERTIDO (RMR-TSK-0440). Lógica PURA: solo
 * calcula coordenadas; el SVG lo pinta la vista.
 *
 * Invertido de verdad: la BASE (capa 0 — quien sostiene a todos) queda ABAJO y
 * los sostenidos suben. El eje X lo resuelve d3-hierarchy (Reingold–Tilford: sin
 * solapes y cada padre centrado bajo sus hijos); el eje Y NO es la profundidad
 * del árbol sino la CAPA CANÓNICA del rol (layerOf), más un desplazamiento por
 * dependencia intra-capa (el coCEO que depende del CEO se separa de él dentro de
 * la misma banda). Varias cimas caben: cuelgan de una raíz VIRTUAL que no se
 * pinta. Los ciclos preexistentes no cuelgan el layout: la arista que cerraría
 * el ciclo se ignora y ese rol pasa a colgar de la raíz virtual.
 */
import { hierarchy, tree } from 'd3-hierarchy';
import { childrenOf, intraLayerDepth, layerOf } from './orgRoles.js';

/** @typedef {import('./orgRoles.js').OrgRole} OrgRole */

/**
 * @param {OrgRole[]} roles
 * @param {{ nodeWidth?: number, gapX?: number, rowHeight?: number, subRowHeight?: number }} [opts]
 * @returns {{
 *   nodes: Array<{ role: OrgRole, x: number, y: number }>,
 *   links: Array<{ from: string, to: string, x1: number, y1: number, x2: number, y2: number }>,
 *   width: number, height: number,
 * }}
 */
export function treeLayout(roles, opts = {}) {
  const { nodeWidth = 210, gapX = 28, rowHeight = 118, subRowHeight = 54 } = opts;
  const list = roles ?? [];
  if (list.length === 0) return { nodes: [], links: [], width: 0, height: 0 };

  // Cimas: las que no reportan a nadie, más las que apuntan a un rol ausente…
  const byId = new Map(list.map((r) => [r.id, r]));
  const bases = list.filter((r) => !r.reportsToRoleId || !byId.has(r.reportsToRoleId));
  // …y las INALCANZABLES desde ninguna cima (ciclo preexistente en los datos):
  // se muestran como cimas sueltas en vez de desaparecer del dibujo.
  const reachable = new Set();
  const queue = bases.map((r) => r.id);
  while (queue.length > 0) {
    const id = queue.shift();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const c of childrenOf(list, id)) if (!reachable.has(c.id)) queue.push(c.id);
  }
  const roots = [...bases, ...list.filter((r) => !reachable.has(r.id))];
  const rootIds = new Set(roots.map((r) => r.id));
  // Anti-ciclo: un rol solo se visita una vez; el que cierre el ciclo se queda
  // sin arista y aparece como cima suelta (se ve, en vez de desaparecer).
  const visited = new Set();
  const childrenFn = (node) => {
    if (node.__virtual) return roots;
    visited.add(node.id);
    return childrenOf(list, node.id).filter((c) => !visited.has(c.id) && !rootIds.has(c.id));
  };

  const root = hierarchy({ __virtual: true }, childrenFn);
  tree().nodeSize([nodeWidth + gapX, rowHeight])(root);

  const maxLayer = Math.max(...list.map((r) => layerOf(list, r)));
  const placed = root.descendants().filter((n) => !n.data.__virtual);
  const xs = placed.map((n) => n.x);
  const offsetX = placed.length ? Math.min(...xs) : 0;

  const nodes = placed.map((n) => ({
    role: n.data,
    x: n.x - offsetX,
    // Invertido: capa 0 (la base) abajo del todo; dentro de la banda, quien
    // depende de alguien de su misma capa sube.
    y: (maxLayer - layerOf(list, n.data)) * rowHeight - intraLayerDepth(list, n.data) * subRowHeight,
  }));
  const posById = new Map(nodes.map((n) => [n.role.id, n]));

  const links = [];
  for (const n of placed) {
    const parent = n.parent?.data;
    if (!parent || parent.__virtual) continue;
    const from = posById.get(parent.id);
    const to = posById.get(n.data.id);
    if (from && to) links.push({ from: parent.id, to: n.data.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
  }

  // Sin solapes DENTRO de cada fila: el eje X lo calcula d3 por profundidad de
  // árbol, pero la Y la manda la CAPA, así que un rol que cambia de fila (un PM
  // de capa 4 colgado del CPO) puede aterrizar encima de otro. Se empujan a la
  // derecha conservando su orden — el layout deja de solapar sin inventar sitios.
  const rows = new Map();
  for (const n of nodes) rows.set(n.y, [...(rows.get(n.y) ?? []), n]);
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i += 1) {
      const min = row[i - 1].x + nodeWidth + gapX;
      if (row[i].x < min) row[i].x = min;
    }
  }
  // Las aristas siguen a sus nodos tras el empujón.
  for (const l of links) {
    l.x1 = posById.get(l.from).x;
    l.x2 = posById.get(l.to).x;
  }

  const ys = nodes.map((n) => n.y);
  const minY = Math.min(...ys, 0);
  // Normaliza la Y a 0 (las subfilas pueden dar negativos) manteniendo el orden.
  for (const n of nodes) n.y -= minY;
  for (const l of links) { l.y1 -= minY; l.y2 -= minY; }

  return {
    nodes,
    links,
    width: Math.max(...nodes.map((n) => n.x), 0) + nodeWidth,
    height: Math.max(...nodes.map((n) => n.y), 0) + rowHeight,
  };
}
