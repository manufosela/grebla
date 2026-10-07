/**
 * Managers de O2O de una persona (RMR-TSK-0654): quién le hace O2O, que puede ser
 * más de uno (su EM cada mes, su Head cada trimestre, el CTO dos veces al año).
 * Los asigna a mano el superadmin. Solo puede ser manager de alguien quien está
 * por DEBAJO en la pirámide invertida, es decir, más senior. Puro.
 */
import { layerOf } from './orgRoles.js';
import { NOTION_LEVELS } from './peoplePyramid.js';

/**
 * Rango en la pirámide con la escala de la que sale. El Level de Notion y la capa
 * del rol son escalas distintas: solo se comparan rangos de la misma.
 * @returns {{ scale: 'notion'|'roles', value: number }|null}
 */
function rankOf(person, roles) {
  const level = NOTION_LEVELS.indexOf(person?.notion?.level);
  if (level >= 0) return { scale: 'notion', value: level };
  const role = (roles ?? []).find((r) => r.id === person?.orgRole);
  return role ? { scale: 'roles', value: layerOf(roles, role) } : null;
}

/** Rango de una persona: menor es más senior (la base). null si no se sabe. */
export function seniorityRank(person, roles) {
  return rankOf(person, roles)?.value ?? null;
}

/** ¿Puede `candidate` ser manager de O2O de `person`? */
export function canBeO2OManager(candidate, person, roles) {
  if (!candidate?.uid || candidate.id === person?.id) return false;
  const mine = rankOf(candidate, roles);
  const theirs = rankOf(person, roles);
  return !!mine && !!theirs && mine.scale === theirs.scale && mine.value < theirs.value;
}

/** Managers en el orden de la pirámide: de la base hacia arriba; sin rango, al final. */
export function sortO2OManagers(managers, roles) {
  const rank = (m) => seniorityRank(m, roles) ?? Number.POSITIVE_INFINITY;
  return (managers ?? []).toSorted((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name), 'es'));
}

/**
 * Los managers de O2O asignados a `person`, resueltos a su ficha y en orden. Un
 * uid que ya no casa con ninguna ficha se enseña, no se esconde: sigue dando acceso.
 */
export function o2oManagersOf(person, people, roles) {
  const byUid = new Map((people ?? []).filter((x) => x.uid).map((x) => [x.uid, x]));
  return sortO2OManagers(
    (person?.o2oManagerUids ?? []).map((uid) => byUid.get(uid) ?? { id: null, uid, name: '(cuenta sin ficha)' }),
    roles,
  );
}

/** Quién se puede añadir como manager de O2O de `person`: válido y no asignado ya. */
export function o2oManagerCandidates(person, people, roles) {
  const assigned = new Set(person?.o2oManagerUids ?? []);
  return sortO2OManagers((people ?? []).filter((c) => !assigned.has(c.uid) && canBeO2OManager(c, person, roles)), roles);
}
