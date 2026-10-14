/**
 * Marcas de expectativas (Mi carrera, RMR-TSK-0675). Dominio PURO: sin Firebase.
 *
 * El ingeniero marca una expectativa del nivel siguiente como cumplida y aporta
 * evidencia. Cuenta cuando la aceptan sus dos revisores, con el mismo peso
 * (ingeniero y lead: su EM y el Head of; EM: el Head of y el CTO; Head of: solo
 * el CTO). Si discrepan, desempata el árbitro; si el árbitro ya es uno de los
 * revisores, manda su propia decisión.
 *
 * @typedef {'accept'|'reject'} Decision
 * @typedef {{ decision: Decision, reason?: string }} Review
 * @typedef {{ first?: Review, second?: Review, arbiter?: Review }} Reviews
 * @typedef {{ levelId: string, dimensionId: string, status: 'claimed'|'withdrawn', reviews?: Reviews }} Claim
 * @typedef {{ firstUid: string|null, secondUid: string|null, arbiterUid: string|null }} Reviewers
 * @typedef {'open'|'pending'|'accepted'|'rejected'|'tie'} ClaimStatus
 */

export const MAX_EVIDENCE_TEXT = 1000;
export const MAX_EVIDENCE_LINKS = 5;
export const LINK_KINDS = Object.freeze(['pr', 'adr', 'rfc', 'doc', 'otro']);

/** Id del documento: una sola marca viva por expectativa. */
export const claimId = (levelId, dimensionId) => `${levelId}__${dimensionId}`;

/**
 * Normaliza la evidencia o falla con un mensaje para la persona.
 * @param {{ text?: unknown, links?: unknown }} input
 * @returns {{ text: string, links: { kind: string, url: string }[] }}
 */
export function validateEvidence(input) {
  const text = typeof input?.text === 'string' ? input.text.trim() : '';
  if (!text) throw new Error('Falta la evidencia: cuenta qué has hecho que lo demuestra.');
  if (text.length > MAX_EVIDENCE_TEXT) throw new Error(`La evidencia no puede pasar de ${MAX_EVIDENCE_TEXT} caracteres.`);
  const links = Array.isArray(input?.links) ? input.links : [];
  if (links.length > MAX_EVIDENCE_LINKS) throw new Error(`Como mucho ${MAX_EVIDENCE_LINKS} enlaces.`);
  return { text, links: links.map(validateLink) };
}

function validateLink(link) {
  const kind = typeof link?.kind === 'string' ? link.kind : '';
  if (!LINK_KINDS.includes(kind)) throw new Error(`Tipo de enlace desconocido: «${kind}».`);
  const url = typeof link?.url === 'string' ? link.url.trim() : '';
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error(`El enlace debe empezar por http:// o https://: «${url}».`);
  return { kind, url };
}

const verdict = (decision) => (decision === 'accept' ? 'accepted' : 'rejected');

/**
 * Estado de una marca según sus revisiones.
 * @param {Claim|null|undefined} claim
 * @param {Reviewers} reviewers
 * @returns {ClaimStatus}
 */
export function claimStatus(claim, reviewers) {
  if (claim?.status !== 'claimed') return 'open';
  const first = claim.reviews?.first?.decision;
  const second = claim.reviews?.second?.decision;
  if (!reviewers?.secondUid) return first ? verdict(first) : 'pending';
  if (!first || !second) return 'pending';
  if (first === second) return verdict(first);
  if (reviewers.arbiterUid && reviewers.arbiterUid === reviewers.firstUid) return verdict(first);
  if (reviewers.arbiterUid && reviewers.arbiterUid === reviewers.secondUid) return verdict(second);
  const arbiter = claim.reviews?.arbiter?.decision;
  return arbiter ? verdict(arbiter) : 'tie';
}

/** Marca nueva del ingeniero: sin revisiones ni historial (las reglas lo exigen). */
export function newClaim({ levelId, dimensionId, evidence, by, at }) {
  return {
    levelId, dimensionId, status: 'claimed', evidence: validateEvidence(evidence),
    claimedBy: by, claimedAt: at, reviews: {}, history: [], updatedAt: at,
  };
}

/**
 * Reenvío o retirada: la ronda anterior (evidencia y revisiones) se archiva tal
 * cual al final del historial y las revisiones vuelven a cero.
 */
export function resubmitted(current, { evidence, at, status = 'claimed' }) {
  return {
    evidence: validateEvidence(evidence), status, claimedAt: at, reviews: {}, updatedAt: at,
    history: [...(current.history ?? []), { evidence: current.evidence, reviews: current.reviews ?? {} }],
  };
}

/**
 * Revisión de un hueco. Aceptar o rechazar, siempre con motivo: el ingeniero ve
 * por qué cuenta o por qué no (RMR-TSK-0703).
 */
export function reviewPatch(slot, { decision, reason = '', by, at }) {
  if (decision !== 'accept' && decision !== 'reject') throw new Error(`Decisión desconocida: «${decision}».`);
  const why = typeof reason === 'string' ? reason.trim() : '';
  if (!why) throw new Error(decision === 'reject' ? 'Para rechazar hace falta un motivo.' : 'Para aceptar hace falta un motivo.');
  return { [`reviews.${slot}`]: { decision, reason: why, by, at }, updatedAt: at };
}

/**
 * Qué revisión le toca a `uid` en esta marca: su hueco de revisor, o el de
 * árbitro solo si hay empate. null si no le toca ninguna.
 * @returns {'first'|'second'|'arbiter'|null}
 */
export function slotFor(reviewers, uid, claim) {
  if (!uid) return null;
  if (reviewers?.firstUid === uid) return 'first';
  if (reviewers?.secondUid === uid) return 'second';
  if (reviewers?.arbiterUid === uid && claimStatus(claim, reviewers) === 'tie') return 'arbiter';
  return null;
}

/**
 * Cuántas marcas esperan la revisión de `uid`: vivas, con su hueco aún vacío.
 * @param {Claim[]} claims @param {Reviewers} reviewers @param {string|null} uid
 */
export function pendingForReviewer(claims, reviewers, uid) {
  return (claims ?? []).filter((claim) => {
    if (claim?.status !== 'claimed') return false;
    const slot = slotFor(reviewers, uid, claim);
    return !!slot && !claim.reviews?.[slot];
  }).length;
}

/**
 * Marcas aceptadas de un nivel, en la forma que consume `levelProgressFor`.
 * @param {Claim[]} claims
 * @param {string} levelId
 * @param {Reviewers} reviewers
 * @returns {Record<string, boolean>}
 */
export function marksFromClaims(claims, levelId, reviewers) {
  const marks = {};
  for (const claim of claims ?? []) {
    if (claim?.levelId === levelId && claimStatus(claim, reviewers) === 'accepted') marks[claim.dimensionId] = true;
  }
  return marks;
}
