/**
 * <survey-respond> — página pública de respuesta de una encuesta (RMR-TSK-0320).
 * SIN login: recibe surveyId + token (del enlace), carga la encuesta vía Cloud
 * Function, pinta las preguntas (escala configurable 1–10 / 1–5 y texto libre),
 * prefilla la respuesta previa (editable hasta el cierre) y envía por la CF. No
 * toca Firestore: el anonimato lo garantizan las reglas + las funciones.
 *
 * Props: surveyId, token (del glue que lee la URL).
 */
import { LitElement, html, css } from 'lit';
import '../common/busy-overlay.js';
import { scaleRange, isScale, isText, isChoice, choiceOptions, validateResponses, sanitizeResponses, canAdvance } from '../../tools/survey/domain/questions.js';
import { END, firstQuestionId, hasBranching, resolveNext } from '../../tools/survey/domain/flow.js';
import { getSurveyForToken, submitSurveyResponse } from '../../lib/survey.js';

export class SurveyRespond extends LitElement {
  static properties = {
    surveyId: { attribute: false },
    token: { attribute: false },
    _phase: { state: true }, // 'loading' | 'ready' | 'error'
    _survey: { state: true },
    _responses: { state: true },
    _path: { state: true }, // pila de ids de preguntas visitadas (permite ir atrás por el grafo)
    _navError: { state: true },
    _saving: { state: true },
    _saved: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #1e3a5f); }
    .card { max-width: 720px; margin: 0 auto; background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #dde7ec); border-radius: 14px; padding: 1.6rem 1.5rem 1.8rem; }
    h1 { font-size: 1.4rem; margin: 0 0 0.3rem; }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.92rem; margin: 0 0 1.4rem; }
    .q { padding: 1rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .q:first-of-type { border-top: 0; }
    .q .label { font-weight: 600; margin: 0 0 0.7rem; line-height: 1.4; }
    .scale { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .choice { display: flex; flex-direction: column; gap: 0.5rem; }
    .opt { min-width: 2.6rem; height: 2.6rem; padding: 0 0.5rem; border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; font: inherit; font-weight: 700; cursor: pointer; }
    .opt.wide { min-width: 0; height: auto; width: 100%; padding: 0.7rem 0.9rem; text-align: left; font-weight: 600; }
    .opt:hover { border-color: var(--rm-accent, #2a9d8f); }
    .opt[aria-pressed="true"] { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .scale-ends { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--rm-muted, #5b6b7d); margin-top: 0.35rem; }
    textarea { width: 100%; box-sizing: border-box; min-height: 5rem; padding: 0.6rem 0.7rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); resize: vertical; }
    textarea:focus { outline: none; border-color: var(--rm-accent, #2a9d8f); background: var(--rm-surface, #fff); }
    .actions { margin-top: 1.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    button.submit { background: var(--rm-accent, #2a9d8f); border: 1px solid var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); font: inherit; font-weight: 700; padding: 0.6rem 1.3rem; border-radius: 9px; cursor: pointer; }
    button.submit:disabled { opacity: 0.5; cursor: default; }
    .banner { border-radius: 9px; padding: 0.7rem 0.9rem; font-size: 0.9rem; font-weight: 600; }
    .banner.ok { background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 15%, transparent); color: var(--rm-accent-700, #1f7a6e); }
    .banner.err { background: #fdecea; color: #b42318; }
    .muted { color: var(--rm-muted, #5b6b7d); font-size: 0.86rem; }
    .center { text-align: center; padding: 2rem 1rem; }
    .progress { margin: 0 0 1.2rem; }
    .progress .count { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); font-weight: 600; margin-bottom: 0.4rem; }
    .progress .track { height: 6px; border-radius: 999px; background: var(--rm-border, #eef0f2); overflow: hidden; }
    .progress .fill { height: 100%; border-radius: 999px; background: var(--rm-accent, #2a9d8f); transition: width 0.25s ease; }
    button.nav { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #dde7ec); color: var(--rm-text, #1e3a5f); font: inherit; font-weight: 600; padding: 0.6rem 1.2rem; border-radius: 9px; cursor: pointer; }
    button.nav:hover:not(:disabled) { border-color: var(--rm-accent, #2a9d8f); color: var(--rm-accent-700, #1f7a6e); }
    button.nav:disabled { opacity: 0.4; cursor: default; }
    .spacer { flex: 1; }
  `;

  constructor() {
    super();
    this.surveyId = null;
    this.token = null;
    this._phase = 'loading';
    this._survey = null;
    this._responses = {};
    this._path = [];
    this._navError = '';
    this._saving = false;
    this._saved = false;
    this._error = '';
    this._loadedFor = null;
  }

  /** Lo llama el glue con los parámetros de la URL. Sin enlace válido → error. */
  setLink(surveyId, token) {
    if (surveyId && token) {
      this.surveyId = surveyId;
      this.token = token;
    } else {
      this._error = 'Falta el enlace personal de la encuesta. Abre el enlace que recibiste por correo.';
      this._phase = 'error';
    }
  }

  updated(changed) {
    if ((changed.has('surveyId') || changed.has('token')) && this.surveyId && this.token) {
      const key = `${this.surveyId}:${this.token}`;
      if (key === this._loadedFor) return;
      this._loadedFor = key;
      this._load();
    }
  }

  async _load() {
    this._phase = 'loading';
    try {
      const { survey, responses } = await getSurveyForToken(this.surveyId, this.token);
      this._survey = survey;
      this._responses = { ...responses };
      const first = firstQuestionId(survey?.questions ?? []);
      this._path = first ? [first] : [];
      this._navError = '';
      this._saved = responses != null; // ya había respondido antes
      this._phase = 'ready';
    } catch (err) {
      this._error = this._friendly(err);
      this._phase = 'error';
    }
  }

  /** Traduce el error de la CF a un mensaje claro, sin filtrar detalles. */
  _friendly(err) {
    const code = err?.code ?? '';
    if (code.includes('failed-precondition')) return 'Esta encuesta ya no está abierta.';
    if (code.includes('permission-denied')) return 'Este enlace no es válido. Usa el enlace personal que recibiste.';
    if (code.includes('not-found')) return 'No encontramos la encuesta.';
    return 'No se ha podido cargar la encuesta. Inténtalo de nuevo más tarde.';
  }

  _setAnswer(qid, value) {
    this._responses = { ...this._responses, [qid]: value };
    this._navError = '';
    this._saved = false;
  }

  _clearAnswer(qid) {
    const rest = { ...this._responses };
    delete rest[qid];
    this._responses = rest;
    this._navError = '';
    this._saved = false;
  }

  /** Opción única: reelegir la misma opción la deselecciona si la pregunta es opcional. */
  _toggleChoice(qid, opt, isRequired) {
    if (!isRequired && this._responses[qid] === opt) this._clearAnswer(qid);
    else this._setAnswer(qid, opt);
  }

  get _questions() {
    return this._survey?.questions ?? [];
  }

  get _current() {
    const id = this._path.at(-1);
    return this._questions.find((q) => q.id === id) ?? null;
  }

  /** Preguntas efectivamente recorridas: solo estas cuentan para validar el envío. */
  get _pathQuestions() {
    return this._path.map((id) => this._questions.find((q) => q.id === id)).filter(Boolean);
  }

  get _valid() {
    return validateResponses(this._pathQuestions, this._responses).valid;
  }

  /** Siguiente id desde la pregunta actual, o END; trata un ciclo (id ya visitado) como fin. */
  get _resolvedNextId() {
    const q = this._current;
    if (!q) return END;
    const nextId = resolveNext(q, this._responses[q.id], this._questions);
    return nextId !== END && this._path.includes(nextId) ? END : nextId;
  }

  /** ¿La pregunta actual es el final del camino (según su respuesta)? */
  get _isLast() {
    return this._resolvedNextId === END;
  }

  _next() {
    if (!canAdvance(this._current, this._responses)) {
      this._navError = 'Responde esta pregunta para continuar.';
      return;
    }
    this._navError = '';
    const nextId = this._resolvedNextId;
    if (nextId !== END) this._path = [...this._path, nextId];
  }

  _prev() {
    this._navError = '';
    if (this._path.length > 1) this._path = this._path.slice(0, -1);
  }

  async _submit() {
    if (!this._valid || this._saving) return;
    this._saving = true;
    this._error = '';
    try {
      const clean = sanitizeResponses(this._survey.questions, this._responses);
      await submitSurveyResponse(this.surveyId, this.token, clean);
      this._saved = true;
    } catch (err) {
      this._error = this._friendly(err);
    } finally {
      this._saving = false;
    }
  }

  _renderQuestion(q) {
    if (isScale(q)) {
      const { min, max } = scaleRange(q);
      const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      const current = this._responses[q.id];
      return html`<fieldset class="q" style="border:0;margin:0;padding:1rem 0;">
        <legend class="label">${q.label}</legend>
        <div class="scale" role="group" aria-label=${q.label}>
          ${options.map((n) => html`<button type="button" class="opt"
            aria-pressed=${current === n ? 'true' : 'false'}
            @click=${() => this._setAnswer(q.id, n)}>${n}</button>`)}
        </div>
        ${q.minLabel || q.maxLabel
          ? html`<div class="scale-ends"><span>${q.minLabel ?? ''}</span><span>${q.maxLabel ?? ''}</span></div>`
          : null}
      </fieldset>`;
    }
    if (isChoice(q)) {
      const current = this._responses[q.id];
      return html`<fieldset class="q" style="border:0;margin:0;padding:1rem 0;">
        <legend class="label">${q.label}</legend>
        <div class="choice" role="group" aria-label=${q.label}>
          ${choiceOptions(q).map((opt) => html`<button type="button" class="opt wide"
            aria-pressed=${current === opt ? 'true' : 'false'}
            @click=${() => this._toggleChoice(q.id, opt, q.required !== false)}>${opt}</button>`)}
        </div>
        ${q.required === false ? html`<p class="muted" style="margin-top:0.5rem">Opcional: vuelve a tocar la opción elegida para deseleccionarla.</p>` : null}
      </fieldset>`;
    }
    if (isText(q)) {
      const id = `q-${q.id}`;
      return html`<div class="q">
        <label class="label" for=${id}>${q.label}</label>
        <textarea id=${id} .value=${this._responses[q.id] ?? ''}
          @input=${(e) => this._setAnswer(q.id, e.target.value)}></textarea>
      </div>`;
    }
    return null;
  }

  render() {
    if (this._phase === 'loading') return html`<div class="card"><p class="center muted">Cargando la encuesta…</p></div>`;
    if (this._phase === 'error') return html`<div class="card"><p class="banner err">${this._error}</p></div>`;

    const questions = this._questions;
    const total = questions.length;
    const current = this._current;
    const isLast = this._isLast;
    const branching = hasBranching(questions);
    // Con saltos, el total de pasos no es fijo: se muestra el nº recorrido sin barra.
    const posInOrder = current ? questions.findIndex((q) => q.id === current.id) : -1;
    const stepText = branching ? `Pregunta ${this._path.length}` : `Pregunta ${posInOrder + 1} de ${total}`;
    const pct = total ? Math.round(((posInOrder + 1) / total) * 100) : 0;
    let submitLabel = 'Enviar respuesta';
    if (this._saving) submitLabel = 'Guardando…';
    else if (this._saved) submitLabel = 'Actualizar respuesta';
    const showRequiredHint = isLast && !this._valid;
    return html`
      ${this._saving ? html`<busy-overlay message="Enviando tus respuestas…"></busy-overlay>` : null}<div class="card">
      <h1>${this._survey.title}</h1>
      <p class="lead">Tus respuestas son anónimas. Puedes editarlas hasta que se cierre la encuesta.</p>
      ${this._saved && !this._error ? html`<p class="banner ok">✓ Respuesta guardada. Puedes seguir editándola.</p>` : null}
      ${this._error ? html`<p class="banner err">${this._error}</p>` : null}
      ${total ? html`<div class="progress">
        <div class="count">${stepText}</div>
        ${branching ? null : html`<div class="track"><div class="fill" style="width:${pct}%"></div></div>`}
      </div>` : null}
      ${current ? this._renderQuestion(current) : html`<p class="muted">Esta encuesta no tiene preguntas.</p>`}
      ${this._navError ? html`<p class="muted" style="color:#b42318">${this._navError}</p>` : null}
      <div class="actions">
        <button type="button" class="nav" ?disabled=${this._path.length <= 1} @click=${() => this._prev()}>Atrás</button>
        <span class="spacer"></span>
        ${isLast
          ? html`<button type="button" class="submit" ?disabled=${!this._valid || this._saving} @click=${() => this._submit()}>
              ${submitLabel}
            </button>`
          : html`<button type="button" class="submit" @click=${() => this._next()}>Siguiente</button>`}
      </div>
      ${showRequiredHint ? html`<p class="muted">Responde las preguntas obligatorias para enviar.</p>` : null}
    </div>`;
  }
}

if (!customElements.get('survey-respond')) {
  customElements.define('survey-respond', SurveyRespond);
}
