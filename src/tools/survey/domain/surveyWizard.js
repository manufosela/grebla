/**
 * El asistente de una encuesta (RMR-TSK-0631). Puro: los pasos, en orden, y
 * qué impide pasar al siguiente. Una encuesta se prepara de principio a fin en
 * un solo camino: preguntas → a quién se envía → sus enlaces → el envío.
 */

export const WIZARD_STEPS = Object.freeze([
  { id: 'questions', label: 'Preguntas' },
  { id: 'recipients', label: 'Destinatarios' },
  { id: 'links', label: 'Enlaces' },
  { id: 'send', label: 'Envío' },
]);

const key = (email) => String(email).trim().toLowerCase();

/**
 * Por qué no se puede pasar del paso `step` al siguiente; null si se puede.
 * @param {string} step
 * @param {{ surveyId: string|null, selected?: number, links?: number }} state
 * @returns {string|null}
 */
export function stepBlocker(step, { surveyId, selected = 0, links = 0 }) {
  if (!surveyId) return 'Guarda la encuesta para seguir.';
  if (step === 'recipients' && selected === 0) return 'Marca al menos a una persona.';
  if (step === 'links' && links === 0) return 'Genera los enlaces para poder enviarlos.';
  return null;
}

/** A quién se marcó la última vez en esta encuesta (emails en minúsculas). */
export function savedRecipients(survey) {
  const list = Array.isArray(survey?.recipients) ? survey.recipients : [];
  return new Set(list.filter((e) => typeof e === 'string' && e.includes('@')).map(key));
}

/**
 * Marcados que aún no tienen enlace: generar dos veces no duplica ni cambia
 * los enlaces ya enviados.
 * @template {{ email: string }} P
 * @param {P[]} marked
 * @param {Array<{ email?: string }>} tokens
 * @returns {P[]}
 */
export function linksToCreate(marked, tokens) {
  const have = new Set(tokens.filter((t) => t.email).map((t) => key(t.email)));
  return marked.filter((p) => !have.has(key(p.email)));
}
