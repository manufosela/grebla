/**
 * Preguntas de una encuesta (RMR-TSK-0318). Dominio puro (sin Firebase).
 *
 * Una pregunta es `{ id, type, label, min?, max?, options?, required? }`. Tipos:
 *  - `scale`: número entero en [min, max] (eNPS 1–10, Q12 de Gallup 1–5…).
 *  - `text`: texto libre (la «razón» del eNPS).
 *  - `choice`: opción única entre `options` (lista de strings); permite ramificar.
 * La escala es CONFIGURABLE por pregunta (no hay un 1–6 fijo): cada una lleva su
 * min/max.
 */

export const QUESTION_TYPES = ['scale', 'text', 'choice'];

export const isScale = (q) => q?.type === 'scale';
export const isText = (q) => q?.type === 'text';
export const isChoice = (q) => q?.type === 'choice';

/** Opciones no vacías de una pregunta de opción única. */
export function choiceOptions(question) {
  return (Array.isArray(question?.options) ? question.options : [])
    .map((o) => String(o ?? '').trim())
    .filter(Boolean);
}

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
  if (question.type === 'choice') return typeof value === 'string' && choiceOptions(question).includes(value);
  if (question.type === 'scale') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return false;
    const { min, max } = scaleRange(question);
    return value >= min && value <= max;
  }
  return false;
}

/**
 * Errores de un borrador de encuesta antes de guardarlo (validación de forma):
 * título, umbral de anonimato entero ≥ 2, cada pregunta con enunciado y, si es de
 * escala, min/max enteros con 0 ≤ min < max. Devuelve la lista (vacía = válido).
 */
export function surveyDraftErrors({ title, questions, threshold } = {}) {
  const errors = [];
  if (!String(title ?? '').trim()) errors.push('Falta el título.');
  if (!Number.isInteger(threshold) || threshold < 2) errors.push('El umbral de anonimato debe ser un entero ≥ 2.');
  const list = questions ?? [];
  if (!list.length) errors.push('Añade al menos una pregunta.');
  list.forEach((q, i) => {
    if (!String(q?.label ?? '').trim()) errors.push(`La pregunta ${i + 1} necesita enunciado.`);
    if (q?.type === 'scale'
      && (!Number.isInteger(q.min) || !Number.isInteger(q.max) || q.min < 0 || q.min >= q.max)) {
      errors.push(`La escala de la pregunta ${i + 1} no es válida (min entero ≥ 0 y menor que max).`);
    }
    if (q?.type === 'choice' && choiceOptions(q).length < 2) {
      errors.push(`La pregunta ${i + 1} de opción única necesita al menos dos opciones.`);
    }
  });
  return errors;
}

/**
 * Ensambla el payload persistible de una encuesta desde el borrador del editor,
 * con valores normalizados. Lo usan TANTO el alta como la edición, así la escala
 * por defecto y el umbral se guardan igual en ambos casos.
 */
export function draftToPayload({ title, questions, threshold, defaultScale, email } = {}) {
  return {
    title: String(title ?? '').trim(),
    questions: questions ?? [],
    threshold: Number.isInteger(threshold) ? threshold : 5,
    defaultScale: {
      min: Number.isInteger(defaultScale?.min) ? defaultScale.min : 1,
      max: Number.isInteger(defaultScale?.max) ? defaultScale.max : 5,
    },
    email: {
      subject: String(email?.subject ?? '').trim(),
      body: String(email?.body ?? ''),
    },
  };
}

/**
 * ¿Está `question` respondida en `responses`? Una escala respondida es un valor
 * válido; un texto respondido es una cadena no vacía (los espacios no cuentan).
 * Sirve para la navegación secuencial (una pregunta a la vez).
 */
export function isAnswered(question, responses) {
  if (!question) return false;
  const has = responses != null && Object.hasOwn(responses, question.id);
  if (!has) return false;
  const value = responses[question.id];
  if (question.type === 'text') return String(value ?? '').trim().length > 0;
  return validateAnswer(question, value);
}

/**
 * ¿Se puede avanzar desde `question`? Si es obligatoria, debe estar respondida;
 * si es opcional, se avanza siempre salvo que tenga una respuesta presente pero
 * inválida (que no debería ocurrir desde la UI, pero lo blindamos).
 */
export function canAdvance(question, responses) {
  if (!question) return false;
  if (question.required) return isAnswered(question, responses);
  const has = responses != null && Object.hasOwn(responses, question.id);
  return !has || validateAnswer(question, responses[question.id]);
}

/**
 * Deja solo las respuestas cuyas claves son ids de preguntas de la encuesta y
 * descarta cualquier campo extra (que un cliente no cuele datos arbitrarios).
 */
export function sanitizeResponses(questions, responses) {
  const ids = new Set((questions ?? []).map((q) => q?.id));
  const clean = {};
  for (const [id, value] of Object.entries(responses ?? {})) {
    if (ids.has(id)) clean[id] = value;
  }
  return clean;
}

/**
 * Valida un mapa de respuestas `{ qId: value }` contra la lista de preguntas.
 * Una pregunta `required` sin respuesta es un error; una respuesta presente pero
 * fuera de rango/tipo también. Devuelve `{ valid, errors: [{id, error}] }`.
 */
export function validateResponses(questions, responses) {
  const errors = [];
  for (const q of questions ?? []) {
    const answered = responses != null && Object.hasOwn(responses, q.id);
    if (q.required && !answered) { errors.push({ id: q.id, error: 'required' }); continue; }
    if (answered && !validateAnswer(q, responses[q.id])) errors.push({ id: q.id, error: 'invalid' });
  }
  return { valid: errors.length === 0, errors };
}
