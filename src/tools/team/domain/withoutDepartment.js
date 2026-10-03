/**
 * Quién no tiene departamento de verdad (RMR-TSK-0615): está en el cajón
 * 'generico', no tiene rama, o tiene una que ya no está en el catálogo. Es lo
 * que falta: no tener gremio no lo es, porque el gremio es solo de Tech. Puro.
 * @template {{ orgBranch?: string|null }} P
 * @param {P[]} people @param {Array<{ id: string }>} branches catálogo /orgBranches
 * @returns {P[]}
 */
export function withoutDepartment(people, branches) {
  const known = new Set(branches.map((b) => b.id));
  return people.filter((p) => !p.orgBranch || p.orgBranch === 'generico' || !known.has(p.orgBranch));
}
