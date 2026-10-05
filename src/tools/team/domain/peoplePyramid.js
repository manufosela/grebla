/**
 * La pirámide invertida de PERSONAS (RMR-TSK-0617): quien más responsabilidad
 * tiene está en la base, sosteniendo al resto. Con Notion, la capa es su Level
 * (C-level en la base, IC en la cima); sin Notion (la demo), la capa canónica de
 * su rol. Cada persona lleva su rol y su departamento. Puro.
 */
import { layerOf } from './orgRoles.js';

/** Los Level del directorio de Notion, de la base a la cima. */
export const NOTION_LEVELS = Object.freeze(['C-level', 'Head of', 'Manager', 'Lead', 'Team lead', 'IC']);

/**
 * @typedef {{ personId: string, name: string, orgRole?: string|null, orgBranch?: string|null,
 *   notion?: { level?: string|null, role?: string|null }|null }} DirectoryPerson
 * @typedef {{ key: string, label: string, people: Array<{ personId: string, name: string, title: string, branch: string|null }> }} Band
 */

const byName = (a, b) => a.name.localeCompare(b.name, 'es');

/** Agrupa por clave conservando el orden de las claves que se le dan. */
function bandsFrom(order, keyOf, people, titleOf) {
  const groups = new Map(order.map(({ key, label }) => [key, { key, label, people: [] }]));
  for (const person of people) {
    const band = groups.get(keyOf(person));
    band.people.push({ personId: person.personId, name: person.name, title: titleOf(person), branch: person.orgBranch ?? null });
  }
  return [...groups.values()].filter((b) => b.people.length).map((b) => ({ ...b, people: b.people.toSorted(byName) }));
}

/**
 * @param {DirectoryPerson[]} people @param {import('./orgRoles.js').OrgRole[]} roles
 * @returns {{ source: 'notion'|'roles', bands: Band[] }} capas de la base a la cima
 */
export function peoplePyramid(people, roles) {
  const list = people ?? [];
  if (list.some((p) => p.notion?.level)) {
    const order = [...NOTION_LEVELS.map((l) => ({ key: l, label: l })), { key: 'sin-nivel', label: 'Sin nivel en Notion' }];
    const keyOf = (p) => (NOTION_LEVELS.includes(p.notion?.level) ? p.notion.level : 'sin-nivel');
    return { source: 'notion', bands: bandsFrom(order, keyOf, list, (p) => p.notion?.role ?? '') };
  }
  const roleById = new Map((roles ?? []).map((r) => [r.id, r]));
  const layerByRole = new Map((roles ?? []).map((r) => [r.id, layerOf(roles, r)]));
  const layers = [...new Set(layerByRole.values())].toSorted((a, b) => a - b);
  const labelOf = (layer) => (roles ?? []).filter((r) => layerByRole.get(r.id) === layer).map((r) => r.label).join(' · ');
  const order = [...layers.map((l) => ({ key: `capa-${l}`, label: labelOf(l) })), { key: 'sin-rol', label: 'Sin rol' }];
  const keyOf = (p) => (roleById.has(p.orgRole) ? `capa-${layerByRole.get(p.orgRole)}` : 'sin-rol');
  return { source: 'roles', bands: bandsFrom(order, keyOf, list, (p) => roleById.get(p.orgRole)?.label ?? '') };
}
