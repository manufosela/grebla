/**
 * EM por equipo en GREBLA (RMR-TSK-0701). PURO: la Cloud Function lee y escribe.
 *
 * Notion lleva la jerarquía OFICIAL (escalones únicos jefe/subordinado), y en
 * ella un EM puede no ser el jefe de un equipo que sí lleva en el día a día
 * (Nico es EM de IA; Mario, de Platform). GREBLA guarda en /config/org.teamEms
 * qué persona es EM de cada equipo de Notion, y para todo lo que hace un EM
 * —dueño de la ficha, O2O, revisores de carrera— el jefe EFECTIVO de los ICs y
 * leads de ese equipo pasa a ser ese EM. `reportsToPersonId` no se toca: el
 * organigrama oficial sigue saliendo de Notion.
 */

const TECH = 'engineering';
/** Rangos de Notion por encima de IC/lead: su jefe no lo cambia el EM del equipo. */
const MANAGER_LEVELS = new Set(['Manager', 'Head of', 'C-level']);

/**
 * El mapa equipo → id de ficha del EM, limpio. Falla si un valor no es texto.
 * @param {unknown} raw
 * @returns {Record<string, string>}
 */
export function validTeamEms(raw) {
  const out = {};
  for (const [team, id] of Object.entries(raw ?? {})) {
    if (id === null || id === undefined || id === '') continue;
    if (typeof id !== 'string') throw new Error(`EM del equipo «${team}» no válido.`);
    out[team] = id;
  }
  return out;
}

/**
 * Directorio con el jefe efectivo de cada persona. Devuelve copias: las fichas
 * originales no se modifican.
 * @template {{ id: string, reportsToPersonId?: string|null, orgBranch?: string, notion?: { level?: string, team?: string } }} P
 * @param {ReadonlyArray<P>} people
 * @param {Record<string, string>} teamEms
 * @returns {P[]}
 */
export function effectiveDirectory(people, teamEms) {
  const ids = new Set(people.map((p) => p.id));
  return people.map((person) => {
    const emId = teamEms?.[person.notion?.team ?? ''];
    const applies = emId && ids.has(emId) && emId !== person.id
      && person.orgBranch === TECH && !MANAGER_LEVELS.has(person.notion?.level ?? '');
    return applies ? { ...person, reportsToPersonId: emId } : person;
  });
}
