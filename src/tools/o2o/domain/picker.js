/**
 * Selector de persona del O2O (RMR-TSK-0662). Un CTO lleva a mucha gente: su
 * lista junta a quien tiene asignado a mano y a toda su rama del directorio, y
 * para encontrar a alguien se filtra por squad o gremio y se busca por nombre.
 */

/**
 * @typedef {{ id: string, name: string, squads?: string[], guilds?: string[] }} PickerPerson
 */

/** Une la lista manual y la rama del directorio sin repetir a nadie. */
export function mergeO2OPeople(manual, branch) {
  const byId = new Map([...manual, ...branch].map((p) => [p.id, p]));
  return [...byId.values()];
}

const GROUP_KINDS = [
  { kind: 'squad', field: 'squads', label: 'Squad' },
  { kind: 'guild', field: 'guilds', label: 'Gremio' },
];

/**
 * Grupos que se pueden elegir: cada squad y cada gremio que tenga alguien de la
 * lista, con cuántas personas tiene. Squads primero y, dentro, por nombre.
 * @param {ReadonlyArray<PickerPerson>} people
 * @returns {Array<{ key: string, label: string }>}
 */
export function pickerGroups(people) {
  return GROUP_KINDS.flatMap(({ kind, field, label }) => {
    const count = new Map();
    for (const p of people) for (const name of p[field] ?? []) count.set(name, (count.get(name) ?? 0) + 1);
    return [...count.entries()]
      .toSorted(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([name, n]) => ({ key: `${kind}:${name}`, label: `${label} · ${name} (${n})` }));
  });
}

/** Minúsculas y sin tildes, para buscar como se escribe. */
const fold = (s) => String(s ?? '').normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Personas del grupo elegido (`''` = todas) cuyo nombre contiene el texto.
 * @param {ReadonlyArray<PickerPerson>} people
 * @param {string} groupKey
 * @param {string} text
 * @returns {PickerPerson[]}
 */
export function filterPicker(people, groupKey, text) {
  const [kind, ...rest] = String(groupKey ?? '').split(':');
  const name = rest.join(':');
  const field = GROUP_KINDS.find((g) => g.kind === kind)?.field;
  const needle = fold(text).trim();
  return people.filter((p) => (!field || (p[field] ?? []).includes(name)) && (!needle || fold(p.name).includes(needle)));
}
