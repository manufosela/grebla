/**
 * Cliente de la Cloud Function `o2oProposeQuestions`: a partir de un ENFOQUE y de
 * los O2O anteriores (guía + formulario), pide a la IA una preparación completa —
 * la nueva guía y el nuevo formulario previo a la vez. La respuesta se sanea con
 * `sanitizePrep` antes de volcarla en los editores.
 *
 * @typedef {import('../tools/o2o/application/aiProposal.js').PrepProposal} PrepProposal
 */
import { sanitizePrep } from '../tools/o2o/application/aiProposal.js';

/**
 * @param {{ focus?: string, previousPeriods: Array<{ name: string, guide: Array<{ title: string, questions: string[] }>, form: Array<{ title: string, questions: string[] }> }> }} params
 * @returns {Promise<PrepProposal>}  Guía + formulario saneados, listos para los editores.
 */
export async function proposePrep({ focus, previousPeriods }) {
  const { getRegionalFunctions } = await import('./firebase.js');
  const { httpsCallable } = await import('firebase/functions');
  const fns = await getRegionalFunctions();
  const res = await httpsCallable(fns, 'o2oProposeQuestions')({ focus, previousPeriods });
  const data = /** @type {{ proposal: unknown }} */ (res.data);
  return sanitizePrep(data?.proposal);
}
