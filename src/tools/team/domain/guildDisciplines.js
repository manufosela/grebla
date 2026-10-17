/**
 * Las disciplinas del framework de carrera salen de los gremios (RMR-TSK-0759).
 * Antes eran dos listas marcadas por separado —gremios en Organización,
 * disciplinas en Carrera— y podían contradecirse. Ahora solo se eligen gremios;
 * cada gremio del catálogo dice a qué disciplina pertenece (`disciplineId`, o
 * null si no tiene, como QA). PURO.
 */

/**
 * @param {ReadonlyArray<string>|null|undefined} guildNames  gremios de la persona
 * @param {ReadonlyArray<{ name: string, disciplineId?: string|null }>} catalog
 * @returns {string[]}  ids de disciplina, sin repetir
 */
export function disciplinesForGuilds(guildNames, catalog) {
  const byName = new Map((catalog ?? []).map((g) => [g.name, g.disciplineId ?? null]));
  const ids = (guildNames ?? []).map((name) => byName.get(name)).filter(Boolean);
  return [...new Set(ids)];
}
