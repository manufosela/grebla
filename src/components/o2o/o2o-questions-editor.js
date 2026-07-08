/**
 * <o2o-questions-editor> — edita las preguntas de un periodo de O2O: la GUÍA
 * (bloques + preguntas) o el FORMULARIO previo (secciones + preguntas). Añadir /
 * editar / borrar grupos y preguntas, guardar (bump de versión), o rellenar de
 * golpe importando un .md. El botón «Generar con IA» es un placeholder hasta
 * configurar la IA.
 *
 * Props: persistence, periodId, kind ('guide'|'form'), value (la guía o el
 * formulario embebidos del periodo). Emite `saved` tras guardar (con el nuevo valor).
 */
import { LitElement, html, css } from 'lit';
import { savePeriodGuide, savePeriodForm } from '../../tools/o2o/application/usecases/periods.js';
import { parseQuestionsMarkdown } from '../../tools/o2o/application/markdown.js';
import { periodQuestions } from '../../tools/o2o/application/aiProposal.js';

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `id-${Math.round(performance.now() * 1000)}`);

export class O2OQuestionsEditor extends LitElement {
  static properties = {
    persistence: { attribute: false },
    periodId: { attribute: false },
    kind: { type: String },
    value: { attribute: false },
    aiPropose: { attribute: false },
    previousPeriods: { attribute: false },
    _groups: { state: true },
    _intro: { state: true },
    _instructions: { state: true },
    _dirty: { state: true },
    _saving: { state: true },
    _ai: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .bar { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin: 0 0 1rem; }
    .lead { font-size: 0.85rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; }
    .btn {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.4rem 0.8rem; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    .btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .btn.danger { color: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    input, textarea {
      font: inherit; padding: 0.4rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db);
      border-radius: 8px; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); width: 100%;
    }
    .group { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 0.85rem 1rem; margin: 0 0 0.85rem; }
    .group-head { display: flex; gap: 0.5rem; align-items: center; margin: 0 0 0.6rem; }
    .group-head input { font-weight: 700; }
    .q { display: flex; gap: 0.4rem; align-items: center; margin: 0 0 0.4rem; }
    .q .rm { flex: none; }
    .muted { font-size: 0.75rem; color: var(--rm-muted, #9ca3af); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .ai-hint { font-size: 0.75rem; color: var(--rm-muted, #9ca3af); }
    .ai-focus { width: auto; flex: 1; min-width: 12rem; }
    .file { display: none; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.periodId = null;
    this.kind = 'guide';
    this.value = null;
    /** @type {import('../../lib/o2oAi.js').proposeQuestions|null} */
    this.aiPropose = null;
    this.previousPeriods = [];
    this._groups = [];
    this._intro = '';
    this._instructions = '';
    this._dirty = false;
    this._saving = false;
    this._ai = false;
    this._error = '';
    this._loadedFrom = null;
  }

  updated(changed) {
    // Carga el estado de trabajo desde `value` la primera vez (o si cambia el periodo).
    if ((changed.has('value') || changed.has('kind')) && this.value && this.value !== this._loadedFrom) {
      this._loadedFrom = this.value;
      this._loadFromValue();
    }
  }

  _loadFromValue() {
    const v = this.value ?? {};
    const raw = this.kind === 'form' ? (v.sections ?? []) : (v.blocks ?? []);
    this._groups = raw.map((g) => ({
      id: g.id ?? uid(),
      title: g.title ?? '',
      questions: (g.questions ?? []).map((q) => ({ id: q.id ?? uid(), text: q.text ?? '' })),
    }));
    this._intro = this.kind === 'form' ? (v.intro ?? '') : '';
    this._dirty = false;
    this._error = '';
  }

  _setGroups(groups) {
    this._groups = groups;
    this._dirty = true;
  }

  _addGroup() {
    this._setGroups([...this._groups, { id: uid(), title: '', questions: [] }]);
  }

  _renameGroup(gid, title) {
    this._setGroups(this._groups.map((g) => (g.id === gid ? { ...g, title } : g)));
  }

  _removeGroup(gid) {
    this._setGroups(this._groups.filter((g) => g.id !== gid));
  }

  _addQuestion(gid) {
    this._setGroups(this._groups.map((g) => (g.id === gid ? { ...g, questions: [...g.questions, { id: uid(), text: '' }] } : g)));
  }

  _editQuestion(gid, qid, text) {
    this._setGroups(this._groups.map((g) => (g.id === gid
      ? { ...g, questions: g.questions.map((q) => (q.id === qid ? { ...q, text } : q)) }
      : g)));
  }

  _removeQuestion(gid, qid) {
    this._setGroups(this._groups.map((g) => (g.id === gid
      ? { ...g, questions: g.questions.filter((q) => q.id !== qid) }
      : g)));
  }

  async _onMdFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    this._error = '';
    try {
      const { intro, groups } = parseQuestionsMarkdown(await file.text());
      this._groups = groups.map((g) => ({
        id: uid(),
        title: g.title,
        questions: g.questions.map((q) => ({ id: uid(), text: q.text })),
      }));
      if (this.kind === 'form' && intro) this._intro = intro;
      this._dirty = true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo leer el .md.';
    }
  }

  async _generateAi() {
    if (!this.aiPropose || this._ai) return;
    this._ai = true;
    this._error = '';
    try {
      const previousPeriods = (this.previousPeriods ?? [])
        .map((p) => periodQuestions(p, this.kind))
        .filter((p) => p.groups.length);
      const proposal = await this.aiPropose({ kind: this.kind, previousPeriods, instructions: this._instructions.trim() });
      this._groups = proposal.groups.map((g) => ({
        id: uid(),
        title: g.title,
        questions: g.questions.map((q) => ({ id: uid(), text: q.text })),
      }));
      if (this.kind === 'form' && proposal.intro) this._intro = proposal.intro;
      this._dirty = true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo generar con IA.';
    } finally {
      this._ai = false;
    }
  }

  _buildValue() {
    // Descarta grupos/preguntas totalmente vacíos al guardar.
    const groups = this._groups
      .map((g) => ({ ...g, questions: g.questions.filter((q) => q.text.trim()) }))
      .filter((g) => g.title.trim() || g.questions.length);
    if (this.kind === 'form') {
      return { ...this.value, intro: this._intro.trim(), sections: groups };
    }
    return { ...this.value, blocks: groups };
  }

  async _save() {
    this._saving = true;
    this._error = '';
    try {
      const built = this._buildValue();
      const saved = this.kind === 'form'
        ? await savePeriodForm(this.persistence, this.periodId, built)
        : await savePeriodGuide(this.persistence, this.periodId, built);
      this._loadedFrom = saved;
      this.value = saved;
      this._loadFromValue();
      this.dispatchEvent(new CustomEvent('saved', { detail: { kind: this.kind, value: saved }, bubbles: true, composed: true }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar.';
    } finally {
      this._saving = false;
    }
  }

  render() {
    const groupWord = this.kind === 'form' ? 'sección' : 'bloque';
    return html`
      <p class="lead">
        Edita las preguntas de este periodo. Cada O2O puede tener preguntas propias.
        Puedes escribirlas a mano o <strong>importar un .md</strong>
        (títulos <code>#</code> = ${groupWord}s, viñetas <code>-</code> = preguntas).
      </p>
      <div class="bar">
        <button class="btn" @click=${() => this._addGroup()}>+ ${groupWord}</button>
        <button class="btn" @click=${() => this.renderRoot.querySelector('.file')?.click()}>Importar .md</button>
        <input class="file" type="file" accept=".md,.markdown,text/markdown,text/plain" @change=${(e) => this._onMdFile(e)} />
        ${this._renderAi()}
      </div>
      ${this.kind === 'form' ? this._renderIntro() : null}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._groups.length ? this._groups.map((g) => this._renderGroup(g, groupWord)) : html`<p class="muted">Sin ${groupWord}s todavía. Añade uno o importa un .md.</p>`}
      <div class="bar">
        <button class="btn primary" ?disabled=${this._saving || !this._dirty} @click=${() => this._save()}>
          ${this._saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        ${this._dirty ? html`<span class="muted">Cambios sin guardar</span>` : null}
      </div>
    `;
  }

  _renderAi() {
    if (!this.aiPropose) {
      return html`<button class="btn" disabled title="Disponible al configurar la IA">✨ Generar con IA</button>
        <span class="ai-hint">La IA aún no está configurada en esta instancia.</span>`;
    }
    return html`
      <input class="ai-focus" type="text" placeholder="Enfoque para la IA (opcional)"
        .value=${this._instructions} @input=${(e) => { this._instructions = e.target.value; }}
        ?disabled=${this._ai} />
      <button class="btn" ?disabled=${this._ai || this._saving} @click=${() => this._generateAi()}>
        ${this._ai ? 'Generando…' : '✨ Generar con IA'}
      </button>`;
  }

  _renderIntro() {
    return html`<div class="group">
      <p class="muted">Cabecera del formulario (lo que ve la persona)</p>
      <textarea rows="2" .value=${this._intro} @input=${(e) => { this._intro = e.target.value; this._dirty = true; }}></textarea>
    </div>`;
  }

  _renderGroup(g, groupWord) {
    const questions = g.questions.map((q) => html`<div class="q">
      <input type="text" .value=${q.text} placeholder="Pregunta…" @input=${(e) => this._editQuestion(g.id, q.id, e.target.value)} />
      <button class="btn danger rm" @click=${() => this._removeQuestion(g.id, q.id)} aria-label="Borrar pregunta">×</button>
    </div>`);
    return html`<div class="group">
      <div class="group-head">
        <input type="text" .value=${g.title} placeholder="Título del ${groupWord}" @input=${(e) => this._renameGroup(g.id, e.target.value)} />
        <button class="btn danger" @click=${() => this._removeGroup(g.id)}>Borrar ${groupWord}</button>
      </div>
      ${questions}
      <button class="btn" @click=${() => this._addQuestion(g.id)}>+ pregunta</button>
    </div>`;
  }
}

if (!customElements.get('o2o-questions-editor')) {
  customElements.define('o2o-questions-editor', O2OQuestionsEditor);
}
