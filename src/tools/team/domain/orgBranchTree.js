/**
 * Organigrama por rama (RMR-TSK-0670): árbol invertido por `reportsToPersonId`.
 * Mandos en filas por su Level (C-level en la base, encima Head of, Manager, Lead
 * y Team lead) y arriba una caja por equipo con sus personas. Dos del mismo
 * nivel, uno del otro, se apilan. Sin Level (demo), cada mando sube una fila. Puro.
 */

/** Los Level de mando del directorio de Notion, de la base hacia arriba. */
export const LEAD_LEVELS = Object.freeze(['C-level', 'Head of', 'Manager', 'Lead', 'Team lead']);
const NO_TEAM = 'Sin equipo';

/** @typedef {{ personId: string, name: string, orgBranch?: string|null, reportsToPersonId?: string|null,
 *   notion?: { level?: string|null, team?: string|null }|null }} DirectoryPerson */

const byName = (a, b) => a.name.localeCompare(b.name, 'es');
const personNode = (p) => ({ id: p.personId, kind: 'person', person: p, branch: p.orgBranch ?? null });

/**
 * @param {DirectoryPerson[]} people
 * @param {string|null} branchId rama a pintar; `null` = toda la casa
 */
export function branchTree(people, branchId) {
  const list = (people ?? []).filter((p) => branchId === null || p.orgBranch === branchId);
  const ids = new Set(list.map((p) => p.personId));
  const bossOf = (p) => (p.reportsToPersonId !== p.personId && ids.has(p.reportsToPersonId) ? p.reportsToPersonId : null);
  const withReports = new Set(list.map(bossOf).filter(Boolean));
  const isLead = (p) => LEAD_LEVELS.includes(p.notion?.level) || withReports.has(p.personId);
  const levelOf = (p) => LEAD_LEVELS.indexOf(p.notion?.level);

  const children = new Map();
  const addChild = (parentId, node) => children.set(parentId, [...(children.get(parentId) ?? []), node]);
  const leads = list.filter(isLead).toSorted((a, b) => levelOf(a) - levelOf(b) || byName(a, b));
  for (const p of leads) addChild(bossOf(p), personNode(p));
  for (const box of teamBoxes(list.filter((p) => !isLead(p)), bossOf)) addChild(box.parentId, box);

  const [nodes, visited] = [[], new Set()];
  const walk = (node, parent) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const level = levelUnder(node.kind === 'person' ? levelOf(node.person) : -1, parent);
    const placed = { ...node, parentId: parent?.id ?? null, level, sub: parent?.level === level ? parent.sub + 1 : 0 };
    nodes.push(placed);
    for (const child of children.get(node.id) ?? []) walk(child, placed);
  };
  (children.get(null) ?? []).forEach((r) => walk(r, null));
  // Un ciclo en el directorio no tiene raíz: se corta por cualquiera de sus mandos.
  leads.filter((l) => !visited.has(l.personId)).forEach((p) => walk(personNode(p), null));
  return withRows(nodes);
}

/** Sin Level, un nivel por encima del jefe; con él, nunca por debajo del jefe. */
function levelUnder(known, parent) {
  if (!parent) return Math.max(known, 0);
  return known >= 0 ? Math.max(known, parent.level) : parent.level + 1;
}

/** Los IC, en una caja por jefe y equipo. */
function teamBoxes(ics, bossOf) {
  const groups = Map.groupBy(ics, (p) => `${bossOf(p) ?? ''}|${p.notion?.team ?? NO_TEAM}`);
  return [...groups.values()].map((members) => {
    const parentId = bossOf(members[0]);
    const label = members[0].notion?.team ?? NO_TEAM;
    return { id: `team:${parentId ?? ''}:${label}`, kind: 'team', parentId, label, count: members.length, branch: members[0].orgBranch ?? null };
  }).toSorted((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** Cada nivel ocupa tantas filas como mandos apilados tenga; las cajas, la de arriba. */
function withRows(nodes) {
  const persons = nodes.filter((n) => n.kind === 'person');
  const levels = [...new Set(persons.map((n) => n.level))].toSorted((a, b) => a - b);
  const bands = [];
  const baseOf = new Map();
  let next = 0;
  for (const level of levels) {
    const height = 1 + Math.max(...persons.filter((n) => n.level === level).map((n) => n.sub));
    baseOf.set(level, next);
    const named = persons.some((n) => n.level === level && n.person.notion?.level === LEAD_LEVELS[level]);
    bands.push({ label: named ? LEAD_LEVELS[level] : null, fromRow: next, toRow: next + height - 1 });
    next += height;
  }
  if (nodes.some((n) => n.kind === 'team')) bands.push({ label: 'Equipos', fromRow: next, toRow: next });
  const placed = nodes.map(({ level, sub, ...n }) => ({ ...n, row: n.kind === 'team' ? next : baseOf.get(level) + sub }));
  // Ya sin ciclos: el árbol que se pinta es el de `parentId`, no el del directorio.
  const children = Map.groupBy(placed.filter((n) => n.parentId), (n) => n.parentId);
  const roots = placed.filter((n) => !n.parentId);
  return { nodes: placed, roots, children, bands, rowCount: bands.at(-1)?.toRow + 1 || 0 };
}

/**
 * Píxeles: cada hoja tiene su columna y cada mando se centra sobre los suyos; la
 * base abajo. La arista baja por la columna del hijo hasta un carril sobre su jefe.
 * @param {ReturnType<typeof branchTree>} tree
 */
export function branchTreeLayout(tree, { nodeWidth, nodeHeight, gapX, rowHeight }) {
  const pad = 16;
  const columns = new Map();
  let col = 0;
  const place = (node) => {
    const kids = tree.children.get(node.id) ?? [];
    kids.forEach(place);
    columns.set(node.id, kids.length ? (columns.get(kids[0].id) + columns.get(kids.at(-1).id)) / 2 : col++);
  };
  tree.roots.forEach(place);
  const top = Math.max(tree.rowCount - 1, 0);
  const xOf = (id) => pad + nodeWidth / 2 + columns.get(id) * (nodeWidth + gapX);
  const nodes = tree.nodes.map((n) => ({ ...n, x: xOf(n.id), y: pad + nodeHeight / 2 + (top - n.row) * rowHeight }));
  const at = new Map(nodes.map((n) => [n.id, n]));
  const bus = Math.min(18, (rowHeight - nodeHeight) / 2);
  const links = nodes.filter((n) => n.parentId).map((n) => {
    const boss = at.get(n.parentId);
    const bossTop = boss.y - nodeHeight / 2;
    return { from: n.id, to: boss.id, d: `M ${n.x} ${n.y + nodeHeight / 2} V ${bossTop - bus} H ${boss.x} V ${bossTop}` };
  });
  const width = Math.max(col, 1) * (nodeWidth + gapX) - gapX + 2 * pad;
  return { nodes, links, width, height: 2 * pad + nodeHeight + top * rowHeight };
}
