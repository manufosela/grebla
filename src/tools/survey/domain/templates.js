/**
 * Plantillas de preguntas de encuesta (RMR-TSK-0325). Dominio puro.
 *
 * Plantilla de CLIMA: eNPS (recomendación 1–10 + razón en texto) + las 12
 * preguntas del Q12 de Gallup (escala 1–5). Es un punto de partida editable por
 * People (el Q12 es un instrumento de Gallup; su uso es decisión de People).
 *
 * Además, import/export de plantillas propias en JSON `{ version, title,
 * questions }`, para reutilizar conjuntos de preguntas entre encuestas.
 */

import { QUESTION_TYPES, surveyDraftErrors, choiceOptions } from './questions.js';
import { flowErrors } from './flow.js';

/** Campos que se conservan de cada pregunta importada (whitelist anti-inyección). */
const QUESTION_FIELDS = ['id', 'type', 'label', 'required', 'min', 'max', 'options', 'next', 'rules'];

/** Normaliza las reglas de salto importadas: solo `{ equals, goto }` con tipos válidos. */
function normalizeRules(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((r) => r && (typeof r.equals === 'string' || typeof r.equals === 'number') && typeof r.goto === 'string' && r.goto)
    .map((r) => ({ equals: r.equals, goto: r.goto }));
}

const Q12_LABELS = [
  'Sé lo que se espera de mí en el trabajo.',
  'Tengo los materiales y el equipo que necesito para hacer bien mi trabajo.',
  'En el trabajo, tengo la oportunidad de hacer cada día lo que mejor sé hacer.',
  'En los últimos siete días, he recibido reconocimiento o elogios por hacer un buen trabajo.',
  'Mi responsable, o alguien en el trabajo, se preocupa por mí como persona.',
  'Hay alguien en el trabajo que estimula mi desarrollo.',
  'En el trabajo, mis opiniones cuentan.',
  'La misión o el propósito de la empresa me hace sentir que mi trabajo es importante.',
  'Mis compañeros están comprometidos con hacer un trabajo de calidad.',
  'Tengo un buen amigo en el trabajo.',
  'En los últimos seis meses, alguien me ha hablado sobre mi progreso.',
  'Este último año he tenido oportunidades de aprender y crecer en el trabajo.',
];

/** Preguntas de la plantilla de clima (eNPS + Q12), con ids estables. */
export function climateTemplate() {
  return [
    { id: 'enps', type: 'scale', min: 1, max: 10, required: true, label: '¿Recomendarías TRIBBU como un lugar para trabajar?' },
    { id: 'enps_reason', type: 'text', required: false, label: '¿Cuál es la razón de esta puntuación?' },
    ...Q12_LABELS.map((label, i) => ({ id: `q${i + 1}`, type: 'scale', min: 1, max: 5, required: true, label })),
  ];
}

/** Serializa una plantilla a JSON legible (con salto de línea) para descargar. */
export function serializeTemplate({ title = '', questions = [] } = {}) {
  return JSON.stringify({ version: 1, title, questions }, null, 2);
}

/**
 * Normaliza una pregunta importada: whitelist de campos conocidos (descarta
 * cualquier extra que un archivo cuele), tipo soportado y, en escalas, min/max
 * enteros (por defecto 1–5). No genera ids: si falta, lo pone la capa de UI.
 */
function normalizeImportedQuestion(raw, i) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`La pregunta ${i + 1} no tiene el formato correcto.`);
  }
  if (!QUESTION_TYPES.includes(raw.type)) {
    throw new Error(`La pregunta ${i + 1} tiene un tipo no soportado.`);
  }
  const q = { type: raw.type, label: typeof raw.label === 'string' ? raw.label : '', required: raw.required === true };
  if (typeof raw.id === 'string' && raw.id) q.id = raw.id;
  if (raw.type === 'scale') {
    q.min = Number.isInteger(raw.min) ? raw.min : 1;
    q.max = Number.isInteger(raw.max) ? raw.max : 5;
  }
  if (raw.type === 'choice') q.options = choiceOptions(raw);
  if (typeof raw.next === 'string' && raw.next) q.next = raw.next;
  const rules = normalizeRules(raw.rules);
  if (rules.length) q.rules = rules;
  return QUESTION_FIELDS.reduce((acc, f) => (q[f] === undefined ? acc : { ...acc, [f]: q[f] }), {});
}

/**
 * Parsea una plantilla desde texto JSON. Acepta `{ title?, questions: [...] }` o
 * directamente un array de preguntas. Valida forma y escalas; lanza un Error con
 * mensaje claro si algo no encaja. Devuelve `{ title, questions }`.
 */
export function parseTemplate(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const list = Array.isArray(data) ? data : data?.questions;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('El JSON no contiene ninguna pregunta.');
  }
  const questions = list.map(normalizeImportedQuestion);
  const errors = [...surveyDraftErrors({ title: 'plantilla', threshold: 5, questions }), ...flowErrors(questions)];
  if (errors.length) throw new Error(errors[0]);
  const title = typeof data?.title === 'string' ? data.title : '';
  return { title, questions };
}
