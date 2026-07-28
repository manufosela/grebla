/**
 * Agregación de resultados de la encuesta (RMR-TSK-0327). Dominio puro.
 *
 * Participación se deriva de los TOKENS (padrón: usados/total por departamento).
 * Los resultados salen de las RESPUESTAS anónimas (con metadatos en tramos). La
 * segmentación aplica k-anonimato (oculta segmentos con menos de N respuestas).
 */
import { enps, summarizeScale } from './tally.js';
import { partitionSegments } from './anonymity.js';
import { choiceOptions } from './questions.js';

/** Participación por departamento a partir de los tokens (respondidos/total, %). */
export function participationByDept(tokens) {
  const map = new Map();
  for (const t of tokens ?? []) {
    const dept = t?.metadata?.department ?? '—';
    const entry = map.get(dept) ?? { department: dept, total: 0, responded: 0 };
    entry.total += 1;
    if (t.used) entry.responded += 1;
    map.set(dept, entry);
  }
  return [...map.values()]
    .map((e) => ({ ...e, pct: e.total ? Math.round((e.responded / e.total) * 100) : 0 }))
    .sort((a, b) => String(a.department).localeCompare(String(b.department)));
}

/** Participación global (respondidos/total sobre todos los tokens). */
export function participationTotal(tokens) {
  const list = tokens ?? [];
  const responded = list.filter((t) => t.used).length;
  return { total: list.length, responded, pct: list.length ? Math.round((responded / list.length) * 100) : 0 };
}

/** Los valores de una pregunta a través de las respuestas (descarta ausentes). */
export function answerValues(answers, questionId) {
  return (answers ?? []).map((a) => a?.answers?.[questionId]).filter((v) => v != null);
}

/** Textos de una pregunta de texto (anónimos, sin vacíos). */
export function textAnswers(answers, questionId) {
  return answerValues(answers, questionId).map((v) => String(v).trim()).filter(Boolean);
}

/**
 * Resumen de una pregunta de escala: n, media y distribución; y el eNPS
 * (%promotores − %detractores) SOLO si la escala es 1..10 (o 0..10).
 */
export function scaleResult(question, values) {
  const nums = (values ?? []).filter((v) => typeof v === 'number');
  const isEnps = (question?.min === 1 || question?.min === 0) && question?.max === 10;
  return { ...summarizeScale(nums), enps: isEnps ? enps(nums) : null };
}

/**
 * Distribución de una pregunta de opción única, con k-anonimato POR OPCIÓN:
 * cada opción es un «segmento» y se oculta si tiene menos de `threshold`
 * respuestas. Devuelve `{ visible, suppressed, total }`. El componente NO debe
 * mostrar `total` cuando hay opciones ocultas (evita inferir su conteo por resta).
 */
export function choiceTally(answers, question, threshold) {
  const values = answerValues(answers, question.id);
  const counts = choiceOptions(question).map((opt) => ({
    key: opt,
    count: values.filter((v) => v === opt).length,
  }));
  return { ...partitionSegments(counts, threshold), total: values.length };
}

/**
 * Segmentos de una pregunta de escala por un campo de metadatos (p. ej.
 * `department`), aplicando k-anonimato: devuelve `{ visible, suppressed }` con la
 * media (y eNPS si procede) de cada segmento visible.
 */
export function segmentedScale(answers, question, field, threshold) {
  const groups = new Map();
  for (const a of answers ?? []) {
    const key = a?.metadata?.[field] ?? '—';
    const v = a?.answers?.[question.id];
    if (typeof v !== 'number') continue;
    const arr = groups.get(key) ?? [];
    arr.push(v);
    groups.set(key, arr);
  }
  const segments = [...groups.entries()].map(([key, values]) => {
    const r = scaleResult(question, values);
    return { key, count: values.length, average: r.average, enps: r.enps };
  });
  return partitionSegments(segments, threshold);
}
