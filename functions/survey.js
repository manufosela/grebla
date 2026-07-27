/**
 * Lógica pura de Encuestas para las Cloud Functions (RMR-TSK-0319). Aislada del
 * bundle de functions (como pulseAggregate.js): ESPEJO de src/tools/survey/domain
 * (questions/buckets), porque el deploy de functions no puede importar de src/.
 * Si cambia la validación o los tramos allí, actualizar aquí.
 */
import { createHmac } from 'node:crypto';

/** Límites de una escala (1–5 por defecto). */
function scaleRange(question) {
  const min = Number.isInteger(question?.min) ? question.min : 1;
  const max = Number.isInteger(question?.max) ? question.max : 5;
  return { min, max };
}

/** ¿Es `value` una respuesta válida para `question`? (espejo del dominio). */
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

/** Valida un mapa de respuestas contra las preguntas. `{ valid, errors }`. */
export function validateResponses(questions, responses) {
  const errors = [];
  for (const q of questions ?? []) {
    const answered = responses != null && Object.prototype.hasOwnProperty.call(responses, q.id);
    if (q.required && !answered) { errors.push({ id: q.id, error: 'required' }); continue; }
    if (answered && !validateAnswer(q, responses[q.id])) errors.push({ id: q.id, error: 'invalid' });
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Deja solo las respuestas cuyas claves son ids de preguntas de la encuesta y
 * descarta cualquier campo extra: un token válido no debe poder inyectar datos
 * arbitrarios en el documento de respuesta. Espejo del dominio.
 */
export function sanitizeResponses(questions, responses) {
  const ids = new Set((questions ?? []).map((q) => q?.id));
  const clean = {};
  for (const [id, value] of Object.entries(responses ?? {})) {
    if (ids.has(id)) clean[id] = value;
  }
  return clean;
}

/** Tramo de antigüedad desde la fecha de alta y la de referencia (espejo del dominio). */
export function tenureBucket(startDateIso, refIso) {
  if (!startDateIso || !refIso) return null;
  const start = new Date(startDateIso);
  const ref = new Date(refIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(ref.getTime())) return null;
  const ms = ref.getTime() - start.getTime();
  const years = ms <= 0 ? 0 : ms / (365.25 * 24 * 3600 * 1000);
  if (years < 1) return '<1';
  if (years < 3) return '1-3';
  if (years < 5) return '3-5';
  if (years < 10) return '5-10';
  return '10+';
}

/**
 * Convierte los metadatos CRUDOS del token (que incluyen email y fecha de alta)
 * en los metadatos ANÓNIMOS que se guardan con la respuesta: nunca el email; la
 * fecha de alta se reduce a TRAMO; el resto de campos no sensibles pasan tal cual.
 * Lista blanca explícita para no filtrar un campo sensible por descuido.
 */
export function bucketMetadata(rawMetadata, refIso) {
  const raw = rawMetadata ?? {};
  const meta = {};
  if (raw.department != null) meta.department = raw.department;
  if (raw.location != null) meta.location = raw.location;
  const tenure = tenureBucket(raw.startDate, refIso);
  if (tenure != null) meta.tenure = tenure;
  // `email`, `startDate` exacta, `name` y cualquier otro campo NO se copian.
  return meta;
}

/**
 * Id determinista del documento de respuesta a partir del token y un salt
 * secreto (SURVEY_SALT). Permite localizar/editar la MISMA respuesta anónima sin
 * guardar en ningún sitio el mapeo token→respuesta: sin el salt no se puede
 * recomputar, así que un admin con la BBDD no puede reidentificar por esta vía.
 */
export function answerId(token, salt) {
  return createHmac('sha256', String(salt)).update(String(token)).digest('hex');
}
