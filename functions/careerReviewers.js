/**
 * Quién acepta las expectativas de cada persona (Mi carrera, RMR-TSK-0676).
 * PURO: la Cloud Function lee y escribe; aquí solo se decide.
 *
 * Dos revisores con el mismo peso, según el rango de Notion de la persona:
 * ingeniero y lead, su EM y el Head of; EM, el Head of y el CTO; Head of, solo
 * el CTO. Sin EM, el CTO ocupa su lugar. Desempata el CTO. Solo cuentan los
 * jefes con cuenta (sin uid no pueden revisar). Sin rangos de Notion (la demo),
 * revisan los dos jefes con cuenta más cercanos.
 */

const RANK_BY_LEVEL = Object.freeze({ 'C-level': 'cto', 'Head of': 'head', Manager: 'em' });

/** Rango de carrera a partir del Level de Notion; null si no hay Level. */
function rankOf(person) {
  const level = person?.notion?.level;
  if (!level) return null;
  return RANK_BY_LEVEL[level] ?? 'ic';
}

/** Solo Tech tiene revisores de carrera (decisión del 12-oct-2026): el resto de
 *  departamentos se organiza de otra forma y su responsable sigue siendo el de Notion. */
const TECH = 'engineering';
const isTech = (p) => p?.orgBranch === TECH;

/** Jefes de Tech de la persona, del más cercano hacia arriba, sin colgarse en ciclos. */
function chainOf(person, byId) {
  const chain = [];
  const seen = new Set([person.id]);
  let boss = byId.get(person.reportsToPersonId ?? '');
  while (boss && isTech(boss) && !seen.has(boss.id)) {
    seen.add(boss.id);
    chain.push(boss);
    boss = byId.get(boss.reportsToPersonId ?? '');
  }
  return chain;
}

function resolve(person, chain) {
  const nearest = (rank) => chain.find((b) => b.uid && rankOf(b) === rank)?.uid ?? null;
  const cto = nearest('cto');
  switch (rankOf(person)) {
    case 'cto': return [null, null, null];
    case 'head': return [cto, null, null];
    case 'em': return [nearest('head') ?? cto, cto, cto];
    case null: return [];
    default: return [nearest('em') ?? cto, nearest('head') ?? cto, cto];
  }
}

/** Revisores de una persona, con los huecos repetidos colapsados. */
function reviewersFor(person, byId) {
  if (!isTech(person)) return { firstUid: null, secondUid: null, arbiterUid: null };
  const chain = chainOf(person, byId);
  const byRank = resolve(person, chain);
  const fallback = !byRank[0] && rankOf(person) !== 'cto';
  const [first = null, second = null, arbiter = null] = fallback
    ? chain.filter((b) => b.uid).map((b) => b.uid).slice(0, 2)
    : byRank;
  const secondUid = second === first ? null : second;
  return { firstUid: first, secondUid, arbiterUid: secondUid ? arbiter : null };
}

const nobody = (r) => !r.firstUid && !r.secondUid && !r.arbiterUid;
/** Sin campo y sin revisores es lo mismo: a quien no es de Tech no se le escribe nada. */
const sameReviewers = (a, b) => (a
  ? a.firstUid === b.firstUid && a.secondUid === b.secondUid && a.arbiterUid === b.arbiterUid
  : nobody(b));

/**
 * @param {ReadonlyArray<{ id: string, uid?: string|null, reportsToPersonId?: string|null,
 *   notion?: { level?: string }, careerReviewers?: object }>} people
 * @returns {Array<{ id: string, reviewers: { firstUid: string|null, secondUid: string|null, arbiterUid: string|null } }>}
 */
export function careerReviewersPatches(people) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const patches = [];
  for (const person of people) {
    const reviewers = reviewersFor(person, byId);
    if (!sameReviewers(person.careerReviewers, reviewers)) patches.push({ id: person.id, reviewers });
  }
  return patches;
}
