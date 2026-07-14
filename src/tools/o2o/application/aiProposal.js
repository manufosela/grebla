/**
 * Saneado de la propuesta de preguntas que devuelve la IA (funciones puras, sin
 * Firebase ni fetch). La Cloud Function `o2oProposeQuestions` fuerza JSON con
 * tool-use, pero el modelo puede devolver campos vacíos, tipos raros o de más:
 * `sanitizeProposal` normaliza la propuesta a la forma que consume el editor
 * ({ intro, groups: [{ title, questions: [{ text }] }] }) y descarta lo vacío.
 *
 * @typedef {{ text: string }} ProposedQuestion
 * @typedef {{ title: string, questions: ProposedQuestion[] }} ProposedGroup
 * @typedef {{ intro: string, groups: ProposedGroup[] }} Proposal
 * @typedef {{ guide: Proposal, form: Proposal }} PrepProposal   Guía + formulario a la vez.
 */

/** Límites defensivos para no volcar un elefante en el editor. */
const MAX_GROUPS = 12;
const MAX_QUESTIONS_PER_GROUP = 20;
const MAX_TEXT = 400;

/** Recorta a texto plano de una línea, con tope de longitud. */
const clean = (value) => (typeof value === 'string' ? value : '').replaceAll(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

/**
 * Normaliza la propuesta de la IA a la forma del editor. Tolera `null`, campos
 * ausentes y tipos incorrectos; nunca lanza.
 * @param {unknown} raw   Lo que devuelve la función (content del tool-use).
 * @returns {Proposal}
 */
export function sanitizeProposal(raw) {
  const obj = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const rawGroups = Array.isArray(obj.groups) ? obj.groups : [];
  const groups = rawGroups
    .slice(0, MAX_GROUPS)
    .map((g) => sanitizeGroup(g))
    .filter((g) => g.title || g.questions.length);
  return { intro: clean(obj.intro), groups };
}

/**
 * Normaliza la propuesta DOBLE (guía + formulario) que devuelve la IA unificada.
 * Reusa `sanitizeProposal` en cada batería; tolera basura y nunca lanza.
 * @param {unknown} raw
 * @returns {PrepProposal}
 */
export function sanitizePrep(raw) {
  const obj = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  return { guide: sanitizeProposal(obj.guide), form: sanitizeProposal(obj.form) };
}

/** @param {unknown} raw */
function sanitizeGroup(raw) {
  const obj = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const rawQuestions = Array.isArray(obj.questions) ? obj.questions : [];
  const questions = rawQuestions
    .slice(0, MAX_QUESTIONS_PER_GROUP)
    .map((q) => clean(typeof q === 'string' ? q : q?.text))
    .filter(Boolean)
    .map((text) => ({ text }));
  return { title: clean(obj.title), questions };
}

/**
 * Extrae de un periodo las preguntas ya escritas (guía o formulario) para
 * mandárselas a la IA como contexto. Devuelve grupos con al menos una pregunta.
 * @param {{ name?: string, guide?: { blocks?: unknown[] }, form?: { sections?: unknown[] } }} period
 * @param {'guide'|'form'} kind
 * @returns {{ name: string, groups: { title: string, questions: string[] }[] }}
 */
export function periodQuestions(period, kind) {
  const source = kind === 'form' ? period?.form?.sections : period?.guide?.blocks;
  const groups = (Array.isArray(source) ? source : [])
    .map((g) => ({
      title: clean(g?.title),
      questions: (Array.isArray(g?.questions) ? g.questions : [])
        .map((q) => clean(q?.text))
        .filter(Boolean),
    }))
    .filter((g) => g.questions.length);
  return { name: clean(period?.name), groups };
}

/**
 * Prepara un periodo anterior como contexto para la IA unificada: su nombre y las
 * preguntas de la guía Y del formulario (para que la IA lea el O2O completo).
 * @param {{ name?: string, guide?: object, form?: object }} period
 * @returns {{ name: string, guide: { title: string, questions: string[] }[], form: { title: string, questions: string[] }[] }}
 */
export function periodPrep(period) {
  return {
    name: clean(period?.name),
    guide: periodQuestions(period, 'guide').groups,
    form: periodQuestions(period, 'form').groups,
  };
}
