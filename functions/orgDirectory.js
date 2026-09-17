/**
 * Proyección del censo para el organigrama de personas (RMR-PCS-0042 · F1).
 * Puro: recibe los datos de /people y devuelve SOLO lo que el organigrama
 * pinta. /people no es legible por cualquier logado (lleva carrera, valoraciones
 * y notas); la callable `orgDirectory` usa esto para no dejar salir nada más.
 */

/** Claves del bloque `notion` que salen: lo que se muestra en la vista estándar. */
const NOTION_KEYS = ['role', 'level', 'department', 'team', 'type', 'status'];

/** @param {unknown} v @returns {string|null} */
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * @param {Array<{ id: string, data: Record<string, unknown> }>} docs
 * @returns {Array<{ personId: string, name: string, orgRole: string|null, orgBranch: string|null, reportsToPersonId: string|null, notion: Record<string, string|null>|null }>}
 */
export function projectDirectory(docs) {
  return (docs ?? [])
    .filter((d) => d?.data && d.data.active !== false && text(d.data.name))
    .map((d) => ({
      personId: d.id,
      name: text(d.data.name),
      orgRole: text(d.data.orgRole),
      orgBranch: text(d.data.orgBranch),
      reportsToPersonId: text(d.data.reportsToPersonId),
      notion: projectNotion(d.data.notion),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** @param {unknown} block @returns {Record<string, string|null>|null} */
function projectNotion(block) {
  if (!block || typeof block !== 'object') return null;
  const out = {};
  for (const k of NOTION_KEYS) out[k] = text(/** @type {Record<string, unknown>} */ (block)[k]);
  return Object.values(out).some((v) => v !== null) ? out : null;
}
