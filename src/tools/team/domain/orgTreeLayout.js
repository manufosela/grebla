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
 * @param {{ nodeWidth?: number, gapX?: number, rowHeight?: number, subRowHeight?: number, collapsed?: Set<string>|string[] }} [opts]
 * @returns {{
 *   nodes: Array<{ role: OrgRole, x: number, y: number, childCount: number, hiddenCount: number }>,
 *   links: Array<{ from: string, to: string, x1: number, y1: number, x2: number, y2: number }>,
 *   width: number, height: number,
 * }}
 */
export function treeLayout(roles, opts = {}) {
  const { nodeWidth = 210, gapX = 28, rowHeight = 118, subRowHeight = 54, collapsed = [] } = opts;
  const all = roles ?? [];
  if (all.length === 0) return { nodes: [], links: [], width: 0, height: 0 };
  // Ramas plegadas (RMR-TSK-0441): los descendientes de un rol colapsado no
  // entran en el layout; el rol plegado muestra cuántos esconde.
  const folded = new Set(collapsed);
  const hiddenBy = new Map();
  const hidden = new Set();
  for (const id of folded) {
    const stack = childrenOf(all, id).map((c) => c.id);
    let n = 0;
    while (stack.length > 0) {
      const cur = stack.pop();
      if (hidden.has(cur) && hiddenBy.has(id)) continue;
      hidden.add(cur);
      n += 1;
      for (const c of childrenOf(all, cur)) stack.push(c.id);
    }
    hiddenBy.set(id, n);
  }
  const list = all.filter((r) => !hidden.has(r.id));
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
  // separation por defecto de d3 = 1 entre hermanos y 2 entre primos: deja el
  // DOBLE de hueco entre subárboles. Compactado a 1.15 (RMR-BUG-0093: «no
  // quiero huecos») — sigue distinguiendo grupos sin desperdiciar lienzo.
  tree()
    .nodeSize([nodeWidth + gapX, rowHeight])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.15))(root);

  // Capas DENSAS (RMR-TSK-0441): solo las presentes en ESTA vista generan banda.
  // Antes se usaba la capa absoluta y, si nadie ocupaba la 3 (vista Product),
  // quedaba una fila vacía en medio del dibujo.
  const ranks = [...new Set(list.map((r) => layerOf(list, r)))].toSorted((a, b) => a - b);
  const rankOf = new Map(ranks.map((l, i) => [l, i]));
  const maxLayer = ranks.length - 1;
  const placed = root.descendants().filter((n) => !n.data.__virtual);
  const xs = placed.map((n) => n.x);
  const offsetX = placed.length ? Math.min(...xs) : 0;

  const nodes = placed.map((n) => ({
    role: n.data,
    x: n.x - offsetX,
    // Invertido: capa 0 (la base) abajo del todo; dentro de la banda, quien
    // depende de alguien de su misma capa sube.
    y: (maxLayer - rankOf.get(layerOf(list, n.data))) * rowHeight - intraLayerDepth(list, n.data) * subRowHeight,
    childCount: childrenOf(all, n.data.id).length,
    hiddenCount: hiddenBy.get(n.data.id) ?? 0,
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
  // Compactado horizontal (RMR-TSK-0441): cada nodo se acerca a la vertical de
  // su familia —la media de sus hijos si los tiene, si no la de su padre—
  // mientras no choque con sus vecinos de fila. Tres pasadas bastan para cerrar
  // los huecos laterales sin deshacer el orden ni crear solapes.
  const parentOf = new Map();
  for (const n of placed) {
    const p = n.parent?.data;
    if (p && !p.__virtual) parentOf.set(n.data.id, p.id);
  }
  const kidsOf = new Map();
  for (const [child, parent] of parentOf) kidsOf.set(parent, [...(kidsOf.get(parent) ?? []), child]);
  const rowList = [...rows.values()];
  for (let pass = 0; pass < 3; pass += 1) {
    for (const row of rowList) {
      for (let i = 0; i < row.length; i += 1) {
        const node = row[i];
        const kids = (kidsOf.get(node.role.id) ?? []).map((id) => posById.get(id)).filter(Boolean);
        const anchor = kids.length > 0
          ? kids.reduce((sum, k) => sum + k.x, 0) / kids.length
          : posById.get(parentOf.get(node.role.id))?.x;
        if (anchor === undefined) continue;
        const min = i > 0 ? row[i - 1].x + nodeWidth + gapX : -Infinity;
        const max = i < row.length - 1 ? row[i + 1].x - nodeWidth - gapX : Infinity;
        node.x = Math.min(Math.max(anchor, min), max);
      }
    }
  }
  // Normaliza la X a 0 tras el compactado y actualiza las aristas.
  const minX = Math.min(...nodes.map((n) => n.x));
  for (const n of nodes) n.x -= minX;
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

/**
 * Trazado de una arista hijo → base (RMR-BUG-0093). Enrutado en «peine»: el hijo
 * baja por SU columna —donde no hay otras tarjetas, porque esa columna es la
 * suya— y solo gira en el carril inmediatamente encima de la base, donde
 * convergen las líneas de todos sus hijos. Girar bajo el hijo y bajar por la
 * columna de la BASE cruzaba a sus otros hijos, que es exactamente lo que
 * ocupa esa columna. Función PURA.
 * @param {{x:number,y:number}} from base (abajo)
 * @param {{x:number,y:number}} to hijo (arriba)
 * @param {{ nodeWidth?: number, nodeHeight?: number, clearance?: number }} [opts]
 * @returns {string} atributo `d` del path
 */
export function linkPath(from, to, opts = {}) {
  const { nodeWidth = 210, nodeHeight = 58, clearance = 16 } = opts;
  const cx = (n) => n.x + nodeWidth / 2;
  const turn = from.y - clearance;
  return `M ${cx(to)} ${to.y + nodeHeight} V ${turn} H ${cx(from)} V ${from.y}`;
}
