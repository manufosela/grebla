/**
 * Propuestas del Role Mirror (épica RMR-PCS-0036 · RM-v2): lógica PURA.
 *
 * El rol se fija de forma conjunta pero PREVALECE el manager: la sesión
 * canónica es suya, y los retoques del ingeniero se guardan en un doc de
 * PROPUESTA aparte (/people/{pid}/rolemirror/proposal) que nunca pisa la
 * canónica. El manager ve el diff respuesta a respuesta y decide (F2).
 */

/** Respuesta normalizada: null y undefined son «sin respuesta». */
const valueOf = (answers, key) => {
  const v = answers?.[key];
  return v === undefined || v === null ? null : v;
};

const sameValue = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
};

/**
 * Diferencias entre las respuestas canónicas (del manager) y las propuestas
 * (del ingeniero): solo los ítems cuyo valor difiere, con ambos valores. El
 * orden respeta el mapa canónico y añade al final los ítems solo-propuestos.
 * @param {Record<string, unknown>|null|undefined} canonicalAnswers
 * @param {Record<string, unknown>|null|undefined} proposedAnswers
 * @returns {Array<{ itemId: string, managerValue: unknown, proposedValue: unknown }>}
 */
export function diffSessions(canonicalAnswers, proposedAnswers) {
  const keys = [...new Set([...Object.keys(canonicalAnswers ?? {}), ...Object.keys(proposedAnswers ?? {})])];
  const diffs = [];
  for (const itemId of keys) {
    const managerValue = valueOf(canonicalAnswers, itemId);
    const proposedValue = valueOf(proposedAnswers, itemId);
    if (sameValue(managerValue, proposedValue)) continue;
    diffs.push({ itemId, managerValue, proposedValue });
  }
  return diffs;
}

/**
 * Fusión de la decisión del manager (F2): sobre una COPIA de la canónica,
 * aplica solo los diffs cuyos itemId estén aceptados. Un valor propuesto null
 * aceptado retira la respuesta (el ítem vuelve a «sin respuesta»).
 * @param {Record<string, unknown>|null|undefined} canonicalAnswers
 * @param {Array<{ itemId: string, proposedValue: unknown }>} diffs
 * @param {ReadonlyArray<string>} acceptedIds
 * @returns {Record<string, unknown>}
 */
export function applyAccepted(canonicalAnswers, diffs, acceptedIds) {
  const accepted = new Set(acceptedIds ?? []);
  const merged = { ...canonicalAnswers };
  for (const diff of diffs ?? []) {
    if (!accepted.has(diff.itemId)) continue;
    if (diff.proposedValue === null) delete merged[diff.itemId];
    else merged[diff.itemId] = diff.proposedValue;
  }
  return merged;
}

/** Estados válidos de una propuesta; cualquier otro cae a 'open'. */
const PROPOSAL_STATUSES = Object.freeze(['open', 'approved', 'rejected']);

/**
 * Lectura tolerante del doc de propuesta: basura → null; campos ausentes con
 * defaults seguros. No valida contra el catálogo de ítems (eso es de la vista).
 * @param {unknown} raw data() del doc, o null/undefined si no existe.
 * @returns {{ answers: Record<string, unknown>, targetRole: string|null, status: 'open'|'approved'|'rejected', by: { uid: string|null, name: string|null } }|null}
 */
export function normalizeProposal(raw) {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = /** @type {Record<string, unknown>} */ (raw);
  const answers = typeof value.answers === 'object' && value.answers !== null && !Array.isArray(value.answers)
    ? /** @type {Record<string, unknown>} */ (value.answers)
    : {};
  const by = typeof value.by === 'object' && value.by !== null ? /** @type {any} */ (value.by) : {};
  return {
    answers,
    targetRole: typeof value.targetRole === 'string' && value.targetRole ? value.targetRole : null,
    status: PROPOSAL_STATUSES.includes(/** @type {any} */ (value.status)) ? /** @type {any} */ (value.status) : 'open',
    by: {
      uid: typeof by.uid === 'string' && by.uid ? by.uid : null,
      name: typeof by.name === 'string' && by.name ? by.name : null,
    },
  };
}
