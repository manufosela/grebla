/**
 * El informe de la sincronización con Notion (RMR-TSK-0623) en filas legibles:
 * un cambio por fila, el campo en castellano y el manager por su nombre, para
 * que quien revisa antes de aplicar vea qué se mueve. Puro.
 */

/** Campos de la ficha que manda Notion, con el nombre que ve una persona. */
const FIELD_LABELS = {
  name: 'Nombre', orgBranch: 'Departamento', reportsToPersonId: 'Manager',
  startDate: 'Alta', external: 'Externo',
  // Bloque informativo `notion` (RMR-TSK-0633): lo que el organigrama muestra tal cual.
  'notion.id': 'Id (Notion)', 'notion.role': 'Rol (Notion)', 'notion.level': 'Nivel (Notion)',
  'notion.department': 'Departamento (Notion)', 'notion.team': 'Equipo (Notion)',
  'notion.type': 'Tipo (Notion)', 'notion.status': 'Estado (Notion)',
};

/** @param {string} field @param {unknown} value @param {(id: string) => string} nameOf */
function shown(field, value, nameOf) {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'reportsToPersonId') return nameOf(String(value));
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  return String(value);
}

/**
 * @param {Record<string, any>} report lo que devuelve la callable notionSync
 * @param {(personId: string) => string} nameOf nombre de una ficha (existente o nueva)
 */
export function reportRows(report, nameOf) {
  const changes = (report.updates ?? []).flatMap((u) => Object.entries(u.changes ?? {})
    .map(([field, { from, to }]) => ({
      name: u.name, field: FIELD_LABELS[field] ?? field,
      from: shown(field, from, nameOf), to: shown(field, to, nameOf),
    })));
  return {
    changes,
    creates: (report.creates ?? []).map((c) => c.name),
    skipped: report.skipped ?? [],
    notInNotion: (report.notInNotion ?? []).map((p) => p.name),
  };
}
