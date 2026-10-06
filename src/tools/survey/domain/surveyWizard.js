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

/**
 * Lo que se dice tras un envío masivo (RMR-TSK-0643). Si Resend llega a su
 * límite, se dice cuántos quedan y qué hacer: nada se queda sin contar.
 * @param {{ sent: number, failed: number, pending: number, quotaReached: boolean }} result
 */
export function bulkNotice({ sent, failed, pending, quotaReached }) {
  const parts = [`Enviados ${sent} correo${sent === 1 ? '' : 's'}.`];
  if (failed) parts.push(`${failed} fallaron: se ve el motivo en su enlace y se pueden reintentar con «Enviar a quienes faltan».`);
  if (quotaReached) parts.push(`Resend ha llegado a su límite de envíos: quedan ${pending} sin enviar. Pulsa «Enviar a quienes faltan» cuando se renueve el cupo.`);
  return parts.join(' ');
}

/**
 * Recuentos del paso Envío (RMR-TSK-0643), con el mismo criterio que el
 * servidor: «faltan» = sin correo enviado y sin responder; «sin responder» =
 * todos los que no han respondido, se les enviara o no (los envíos anteriores
 * al registro de sentAt no constan, así que excluirlos dejaría gente fuera).
 * Enlaces sin email no cuentan.
 * @param {Array<{ email?: string, used?: boolean, sentAt?: unknown }>} tokens
 */
export function sendCounts(tokens) {
  const withEmail = tokens.filter((t) => t.email);
  const unanswered = withEmail.filter((t) => t.used !== true);
  return {
    sent: withEmail.filter((t) => t.sentAt).length,
    pending: unanswered.filter((t) => !t.sentAt).length,
    unanswered: unanswered.length,
  };
}
