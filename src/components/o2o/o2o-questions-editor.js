/**
 * <o2o-questions-editor> — edita UNA batería de un periodo de O2O: la GUÍA
 * (bloques + preguntas) o el FORMULARIO previo (secciones + preguntas). Añadir /
 * editar / borrar grupos y preguntas, guardar (bump de versión), o rellenar de
 * golpe importando un .md. La generación con IA la orquesta el padre
 * (<o2o-prepare>), que vuelca la propuesta con `applyProposal(...)`.
 *
 * Props: persistence, periodId, kind ('guide'|'form'), value (la guía o el
 * formulario embebidos del periodo). Emite `saved` tras guardar (con el nuevo valor).
 */
import { LitElement, html, css } from 'lit';
import { savePeriodGuide, savePeriodForm } from '../../tools/o2o/application/usecases/periods.js';
import { parseQuestionsMarkdown } from '../../tools/o2o/application/markdown.js';
import { buildO2ODocHtml, o2oDocMeta, WORD_DOC_MIME } from '../../tools/o2o/application/wordExport.js';

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `id-${Math.round(performance.now() * 1000)}`);

export class O2OQuestionsEditor extends LitElement {
  static properties = {
    persistence: { attribute: false },
    periodId: { attribute: false },
    kind: { type: String },
    value: { attribute: false },
    _groups: { state: true },
    _intro: { state: true },
    _dirty: { state: true },
    _saving: { state: true },
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
      border-radius: 8px; background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); width: 100%;
    }
    .group { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 0.85rem 1rem; margin: 0 0 0.85rem; }
    .group-head { display: flex; gap: 0.5rem; align-items: center; margin: 0 0 0.6rem; }
    .group-head input { font-weight: 700; }
    .q { display: flex; gap: 0.4rem; align-items: center; margin: 0 0 0.4rem; }
    .q .rm { flex: none; }
    .muted { font-size: 0.75rem; color: var(--rm-muted, #9ca3af); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .file { display: none; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.periodId = null;
    this.kind = 'guide';
    this.value = null;
    this._groups = [];
    this._intro = '';
    this._dirty = false;
    this._saving = false;
    this._error = '';
    this._loadedFrom = null;
  }

  /**
   * Vuelca una propuesta (de la IA, orquestada por el padre) en el editor: reemplaza
   * los grupos y, en el formulario, la cabecera; deja los cambios sin guardar.
   * @param {{ groups: Array<{ title: string, questions: Array<{ text: string }> }>, intro?: string }} proposal
   */
  applyProposal(proposal) {
    this._groups = (proposal?.groups ?? []).map((g) => ({
      id: uid(),
      title: g.title ?? '',
      questions: (g.questions ?? []).map((q) => ({ id: uid(), text: q.text ?? '' })),
    }));
    if (this.kind === 'form' && proposal?.intro) this._intro = proposal.intro;
    this._dirty = true;
    this._error = '';
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

  /**
   * Descarga el contenido actual del editor como documento Word (.doc): HTML con
   * los namespaces de Office, servido como application/msword. Refleja lo que se
   * ve ahora (incluidos cambios sin guardar). No usa document.write ni deps.
   */
  _download() {
    const { title, filename } = o2oDocMeta(this.kind);
    const groups = this._groups.map((g) => ({ title: g.title, questions: g.questions }));
    const intro = this.kind === 'form' ? this._intro : '';
    const html = buildO2ODocHtml({ title, intro, groups });
    const url = URL.createObjectURL(new Blob([html], { type: WORD_DOC_MIME }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
        <button class="btn" ?disabled=${!this._groups.length} title="Descargar como documento Word (.doc)" @click=${() => this._download()}>Descargar</button>
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
