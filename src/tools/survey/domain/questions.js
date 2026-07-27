/**
 * Preguntas de una encuesta (RMR-TSK-0318). Dominio puro (sin Firebase).
 *
 * Una pregunta es `{ id, type, label, min?, max?, required? }`. Tipos:
 *  - `scale`: número entero en [min, max] (eNPS 1–10, Q12 de Gallup 1–5…).
 *  - `text`: texto libre (la «razón» del eNPS).
 * La escala es CONFIGURABLE por pregunta (no hay un 1–6 fijo): cada una lleva su
 * min/max.
 */

export const QUESTION_TYPES = ['scale', 'text'];

export const isScale = (q) => q?.type === 'scale';
export const isText = (q) => q?.type === 'text';

/** Límites de una escala, con 1–5 por defecto si la pregunta no los fija. */
export function scaleRange(question) {
  const min = Number.isInteger(question?.min) ? question.min : 1;
  const max = Number.isInteger(question?.max) ? question.max : 5;
  return { min, max };
}

/** ¿Es `value` una respuesta válida para `question`? */
export function validateAnswer(question, value) {
  if (!question) return false;
  if (question.type === 'text') return typeof value === 'string';
  if (question.type === 'scale') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return false;
    const { min, max } = scaleRange(question);
    return value >= min && value <= max;
  }
  return false;
}

/**
 * Valida un mapa de respuestas `{ qId: value }` contra la lista de preguntas.
 * Una pregunta `required` sin respuesta es un error; una respuesta presente pero
 * fuera de rango/tipo también. Devuelve `{ valid, errors: [{id, error}] }`.
 */
export function validateResponses(questions, responses) {
  const errors = [];
  for (const q of questions ?? []) {
    const answered = responses != null && Object.prototype.hasOwnProperty.call(responses, q.id);
    if (q.required && !answered) { errors.push({ id: q.id, error: 'required' }); continue; }
    if (answered && !validateAnswer(q, responses[q.id])) errors.push({ id: q.id, error: 'invalid' });
  }
  return { valid: errors.length === 0, errors };
}
