/**
 * Cliente de la Cloud Function `o2oProposeQuestions`: pide a la IA una batería de
 * preguntas para un periodo de O2O a partir de las de periodos anteriores. La
 * respuesta se sanea con `sanitizeProposal` antes de volcarla al editor.
 *
 * @typedef {import('../tools/o2o/application/aiProposal.js').Proposal} Proposal
 */
import { sanitizeProposal } from '../tools/o2o/application/aiProposal.js';

/**
 * @param {{ kind: 'guide'|'form', previousPeriods: Array<{ name: string, groups: Array<{ title: string, questions: string[] }> }>, instructions?: string }} params
 * @returns {Promise<Proposal>}  Propuesta saneada, lista para el editor.
 */
export async function proposeQuestions({ kind, previousPeriods, instructions }) {
  const { app } = await import('./firebase.js');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'europe-west1');
  const res = await httpsCallable(fns, 'o2oProposeQuestions')({ kind, previousPeriods, instructions });
  const data = /** @type {{ proposal: unknown }} */ (res.data);
  return sanitizeProposal(data?.proposal);
}
