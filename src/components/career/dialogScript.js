/**
 * Guion de un diálogo de personaje (<game-dialog>, JG-8): máquina de estados
 * PURA e inmutable sobre una secuencia de pasos. El componente la usa para
 * saber qué bocadillo pintar y qué interacción esperar; aquí no hay DOM ni
 * timers — solo transiciones validadas (testables como lógica pura).
 *
 * Tipos de paso:
 *  - 'say'     → un bocadillo del personaje; avanza el jugador (clic/Enter).
 *  - 'ask'     → el personaje espera TEXTO del jugador (textarea); el host
 *                resuelve el envío (asíncrono) y continúa con continueDialog.
 *  - 'effect'  → efecto escénico ('trance': el personaje tiembla y brilla);
 *                el componente lo avanza solo al terminar la animación.
 *  - 'choices' → botones en el bocadillo (v1 ESBOZADA: opciones lineales, sin
 *                ramas; el host reacciona a la elección y continúa el guion.
 *                Futuro: `option.next` con sub-guiones por rama).
 *
 * El guion puede CRECER en caliente: tras resolver un 'ask' o un 'choices' el
 * host encola los pasos siguientes con continueDialog(dialog, pasos) — así la
 * conversación reacciona a datos asíncronos (p. ej. guardar la consulta al
 * brujo antes del trance).
 *
 * @typedef {{ kind: 'say', text: string }} SayStep
 * @typedef {{ kind: 'ask', text?: string, placeholder: string, submitLabel: string }} AskStep
 * @typedef {{ kind: 'effect', effect: 'trance', text?: string }} EffectStep
 * @typedef {{ id: string, label: string }} ChoiceOption
 * @typedef {{ kind: 'choices', text?: string, options: ChoiceOption[] }} ChoicesStep
 * @typedef {SayStep|AskStep|EffectStep|ChoicesStep} DialogStep
 * @typedef {{ steps: ReadonlyArray<DialogStep>, index: number }} DialogState
 */

/** Tipos de paso reconocidos. @type {ReadonlyArray<DialogStep['kind']>} */
export const STEP_KINDS = Object.freeze(['say', 'ask', 'effect', 'choices']);

/** Efectos escénicos disponibles. @type {ReadonlyArray<EffectStep['effect']>} */
export const EFFECTS = Object.freeze(['trance']);

/** Textos por defecto del formulario de un paso 'ask'. */
const ASK_DEFAULTS = Object.freeze({ placeholder: 'Escribe aquí…', submitLabel: 'Enviar' });

/** @param {unknown} value @returns {string} */
function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Valida y normaliza un paso crudo del guion. Un paso malformado es un BUG del
 * guion, no un dato del usuario: se lanza error (sin fallbacks silenciosos).
 * @param {unknown} raw
 * @returns {DialogStep}
 */
export function normalizeStep(raw) {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('normalizeStep requiere un objeto de paso.');
  }
  const step = /** @type {Record<string, unknown>} */ (raw);
  const kind = /** @type {DialogStep['kind']} */ (step.kind);
  if (!STEP_KINDS.includes(kind)) {
    throw new Error(`normalizeStep: tipo de paso desconocido "${String(step.kind)}".`);
  }
  const text = cleanString(step.text);
  if (kind === 'say') {
    if (!text) throw new Error('normalizeStep: un paso "say" necesita texto.');
    return Object.freeze({ kind, text });
  }
  if (kind === 'ask') {
    return Object.freeze({
      kind,
      ...(text ? { text } : {}),
      placeholder: cleanString(step.placeholder) || ASK_DEFAULTS.placeholder,
      submitLabel: cleanString(step.submitLabel) || ASK_DEFAULTS.submitLabel,
    });
  }
  if (kind === 'effect') {
    const effect = /** @type {EffectStep['effect']} */ (step.effect);
    if (!EFFECTS.includes(effect)) {
      throw new Error(`normalizeStep: efecto desconocido "${String(step.effect)}".`);
    }
    return Object.freeze({ kind, effect, ...(text ? { text } : {}) });
  }
  // 'choices' (v1): opciones con id y etiqueta no vacíos, ids únicos.
  const rawOptions = Array.isArray(step.options) ? step.options : [];
  if (rawOptions.length === 0) {
    throw new Error('normalizeStep: un paso "choices" necesita al menos una opción.');
  }
  const seen = new Set();
  const options = rawOptions.map((opt) => {
    const id = cleanString(/** @type {{id?: unknown}} */ (opt)?.id);
    const label = cleanString(/** @type {{label?: unknown}} */ (opt)?.label);
    if (!id || !label) {
      throw new Error('normalizeStep: cada opción de "choices" necesita id y label.');
    }
    if (seen.has(id)) throw new Error(`normalizeStep: opción duplicada "${id}" en "choices".`);
    seen.add(id);
    return Object.freeze({ id, label });
  });
  return Object.freeze({ kind, ...(text ? { text } : {}), options: Object.freeze(options) });
}

/**
 * Crea el estado inicial del diálogo a partir del guion. Un guion vacío es un
 * bug del que lo construye: error.
 * @param {ReadonlyArray<unknown>} steps
 * @returns {DialogState}
 */
export function createDialog(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('createDialog requiere un guion con al menos un paso.');
  }
  return Object.freeze({ steps: Object.freeze(steps.map(normalizeStep)), index: 0 });
}

/**
 * Paso actual, o null si el guion terminó.
 * @param {DialogState} dialog
 * @returns {DialogStep|null}
 */
export function currentStep(dialog) {
  return dialog.index < dialog.steps.length ? dialog.steps[dialog.index] : null;
}

/** true cuando no quedan pasos. @param {DialogState} dialog @returns {boolean} */
export function isDone(dialog) {
  return dialog.index >= dialog.steps.length;
}

/**
 * Avanza un paso NARRATIVO ('say' o 'effect'). Los pasos interactivos ('ask',
 * 'choices') esperan al jugador y al host: se avanzan con continueDialog tras
 * resolver la interacción — llamar advance sobre ellos es un bug.
 * @param {DialogState} dialog
 * @returns {DialogState}
 */
export function advance(dialog) {
  const step = currentStep(dialog);
  if (!step) throw new Error('advance: el diálogo ya terminó.');
  if (step.kind === 'ask' || step.kind === 'choices') {
    throw new Error(
      `advance: el paso ${dialog.index} ("${step.kind}") espera al jugador; usa continueDialog tras resolverlo.`,
    );
  }
  return Object.freeze({ steps: dialog.steps, index: dialog.index + 1 });
}

/**
 * Resuelve el paso ACTUAL (típicamente 'ask'/'choices' ya atendidos por el
 * host), encolando antes los pasos extra de la continuación — así el guion
 * reacciona a datos asíncronos (guardar la consulta → trance → despedida).
 * @param {DialogState} dialog
 * @param {ReadonlyArray<unknown>} [extraSteps] Pasos a añadir al final del guion.
 * @returns {DialogState}
 */
export function continueDialog(dialog, extraSteps = []) {
  if (isDone(dialog)) throw new Error('continueDialog: el diálogo ya terminó.');
  const appended = extraSteps.length
    ? [...dialog.steps, ...extraSteps.map(normalizeStep)]
    : dialog.steps;
  return Object.freeze({ steps: Object.freeze(appended), index: dialog.index + 1 });
}

/**
 * Valida el texto que el jugador envía en un paso 'ask' y lo devuelve saneado.
 * Texto vacío → error con mensaje mostrable (el componente lo pinta junto al
 * formulario, sin tocar la máquina).
 * @param {DialogState} dialog
 * @param {unknown} text
 * @returns {string}
 */
export function validateSubmission(dialog, text) {
  const step = currentStep(dialog);
  if (step?.kind !== 'ask') {
    throw new Error('validateSubmission: el paso actual no espera texto del jugador.');
  }
  const clean = cleanString(text);
  if (!clean) throw new Error('Escribe algo antes de enviarlo.');
  return clean;
}

/**
 * Valida que una opción pertenece al paso 'choices' actual (guarda del
 * componente antes de emitir el evento de elección).
 * @param {DialogState} dialog
 * @param {string} optionId
 * @returns {ChoiceOption}
 */
export function assertChoice(dialog, optionId) {
  const step = currentStep(dialog);
  if (step?.kind !== 'choices') {
    throw new Error('assertChoice: el paso actual no ofrece opciones.');
  }
  const option = step.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`assertChoice: opción desconocida "${optionId}".`);
  return option;
}
