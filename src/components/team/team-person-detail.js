/**
 * <team-person-detail>
 * Ficha de una persona. En esta fase cubre las dos dimensiones de nivel 1-7
 * independientes (R1): Seniority y Emocional. Para cada una: estado actual
 * (última lectura), formulario de registro (selector de nivel + nota) e
 * histórico ascendente (R2). Conocimiento, contribución, conversaciones y notas
 * llegan en fases posteriores.
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 *  - person: Person
 */
import { LitElement, html, css } from 'lit';
import './team-level-input.js';
import {
  addReading,
  getPersonTimeline,
  registerConversation,
  listConversations,
  addSupportNote,
  listSupportNotes,
  removeSupportNote,
} from '../../tools/team/application/usecases/index.js';
import { levelLabel } from '../../tools/team/domain/levels.js';

const CONVERSATION_TYPES = [
  { value: 'o2o', label: '1:1 (O2O)' },
  { value: 'catchup', label: 'Catch-up' },
];

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** @param {string} iso */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

const DIMENSIONS = [
  { key: 'seniority', label: 'Seniority' },
  { key: 'emotional', label: 'Emocional' },
];

export class TeamPersonDetail extends LitElement {
  static properties = {
    persistence: { attribute: false },
    person: { attribute: false },
    timeline: { state: true },
    conversations: { state: true },
    notes: { state: true },
    loading: { state: true },
    error: { state: true },
    _form: { state: true },
    _conv: { state: true },
    _noteText: { state: true },
    _confirmNote: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .head { margin-bottom: 1rem; }
    .head h2 { margin: 0; font-size: 1.3rem; }
    .head .chips { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
    .chip { background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    .dim-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; }
    h3 { font-size: 1rem; margin: 0; }
    .current { font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    .current strong { color: var(--rm-text, #111827); }
    .form { display: grid; gap: 0.6rem; margin: 0.5rem 0 1rem; }
    textarea, input[type='date'] {
      border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; padding: 0.5rem 0.6rem;
      font: inherit; font-size: 0.9rem; color: var(--rm-text, #111827); background: var(--rm-surface, #fff);
    }
    textarea { resize: vertical; min-height: 2.4rem; }
    .row { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    button.primary {
      border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: #fff;
      border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .hist { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    .hist li { display: flex; gap: 0.6rem; padding: 0.35rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .hist .when { color: var(--rm-muted, #9ca3af); white-space: nowrap; min-width: 7.5rem; }
    .hist .lvl { font-weight: 600; }
    .hist .note { color: var(--rm-muted, #6b7280); }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    label.fld { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    select { border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; padding: 0.5rem 0.6rem; font: inherit; font-size: 0.9rem; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    section.support { border-left: 4px solid var(--rm-warning, #f2887a); }
    .disclaimer { font-size: 0.8rem; color: var(--rm-muted, #6b7280); background: var(--rm-coral-soft, #fdecea); border-radius: 8px; padding: 0.5rem 0.75rem; margin: 0 0 0.75rem; }
    .hist .del { margin-left: auto; white-space: nowrap; }
    .link { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.8rem; color: var(--rm-muted, #6b7280); padding: 0 0.2rem; }
    .link.yes { color: var(--rm-danger, #dc2626); }
  `;

  constructor() {
    super();
    this.persistence = null;
    /** @type {import('../../tools/team/domain/types.js').Person|null} */
    this.person = null;
    this.timeline = { seniority: [], emotional: [], knowledge: [], contribution: [] };
    /** @type {import('../../tools/team/domain/types.js').Conversation[]} */
    this.conversations = [];
    /** @type {import('../../tools/team/domain/types.js').SupportNote[]} */
    this.notes = [];
    this.loading = true;
    this.error = '';
    this._form = {
      seniority: { level: 0, toNext: false, note: '', date: '' },
      emotional: { level: 0, toNext: false, note: '', date: '' },
    };
    this._conv = { type: 'o2o', date: '', notes: '' };
    this._noteText = '';
    /** @type {string|null} */
    this._confirmNote = null;
    this._loadedFor = null;
  }

  updated() {
    if (this.persistence && this.person && this._loadedFor !== this.person.id) {
      this._loadedFor = this.person.id;
      this._load();
    }
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      const [timeline, conversations, notes] = await Promise.all([
        getPersonTimeline(this.persistence, this.person.id),
        listConversations(this.persistence, this.person.id),
        listSupportNotes(this.persistence, this.person.id),
      ]);
      this.timeline = timeline;
      this.conversations = conversations;
      this.notes = notes;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar la ficha.';
    } finally {
      this.loading = false;
    }
  }

  async _reload() {
    this._loadedFor = null;
    await this._load();
    this._loadedFor = this.person.id;
  }

  async _saveConversation() {
    const c = this._conv;
    if (!c.notes.trim()) {
      this.error = 'Escribe las notas de la conversación.';
      return;
    }
    this.error = '';
    try {
      await registerConversation(this.persistence, this.person.id, {
        type: c.type,
        date: c.date || new Date().toISOString(),
        notes: c.notes.trim(),
      });
      this._conv = { type: 'o2o', date: '', notes: '' };
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la conversación.';
    }
  }

  async _saveNote() {
    if (!this._noteText.trim()) return;
    this.error = '';
    try {
      await addSupportNote(this.persistence, this.person.id, this._noteText.trim());
      this._noteText = '';
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la nota.';
    }
  }

  async _deleteNote(id) {
    this._confirmNote = null;
    try {
      await removeSupportNote(this.persistence, this.person.id, id);
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo borrar la nota.';
    }
  }

  _patchForm(dim, patch) {
    this._form = { ...this._form, [dim]: { ...this._form[dim], ...patch } };
  }

  async _save(dim) {
    const f = this._form[dim];
    if (!f.level) {
      this.error = 'Selecciona un nivel.';
      return;
    }
    this.error = '';
    try {
      await addReading(this.persistence, dim, this.person.id, {
        level: f.level,
        toNext: f.toNext,
        note: f.note.trim() || undefined,
        date: f.date || new Date().toISOString(),
      });
      this._patchForm(dim, { level: 0, toNext: false, note: '', date: '' });
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la lectura.';
    }
  }

  _renderDimension({ key, label }) {
    const history = this.timeline[key] ?? [];
    const current = history.at(-1);
    const f = this._form[key];
    return html`
      <section>
        <div class="dim-head">
          <h3>${label}</h3>
          <span class="current">
            ${current
              ? html`Actual: <strong>${levelLabel(current.level, current.toNext)}</strong> · ${formatDate(current.date)}`
              : 'Sin lecturas todavía'}
          </span>
        </div>

        <div class="form">
          <team-level-input
            .level=${f.level}
            .toNext=${f.toNext}
            @level-change=${(e) => this._patchForm(key, { level: e.detail.level, toNext: e.detail.toNext })}
          ></team-level-input>
          <label class="fld">Nota (opcional)
            <textarea
              .value=${f.note}
              @input=${(e) => this._patchForm(key, { note: e.target.value })}
              placeholder="Contexto de esta lectura…"
            ></textarea>
          </label>
          <div class="row">
            <label class="fld">Fecha
              <input type="date" .value=${f.date} @input=${(e) => this._patchForm(key, { date: e.target.value })} />
            </label>
            <button class="primary" ?disabled=${!f.level} @click=${() => this._save(key)}>Registrar lectura</button>
          </div>
        </div>

        ${history.length === 0
          ? html`<p class="empty">Aún no hay histórico.</p>`
          : html`
              <ul class="hist">
                ${history.map(
                  (r) => html`
                    <li>
                      <span class="when">${formatDate(r.date)}</span>
                      <span class="lvl">${levelLabel(r.level, r.toNext)}</span>
                      ${r.note ? html`<span class="note">${r.note}</span>` : null}
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>
    `;
  }

  _renderConversations() {
    const c = this._conv;
    const typeLabel = (t) => CONVERSATION_TYPES.find((x) => x.value === t)?.label ?? t;
    return html`
      <section>
        <h3>Conversaciones</h3>
        <div class="form">
          <div class="row">
            <label class="fld">Tipo
              <select .value=${c.type} @change=${(e) => { this._conv = { ...this._conv, type: e.target.value }; }}>
                ${CONVERSATION_TYPES.map((t) => html`<option value=${t.value} ?selected=${t.value === c.type}>${t.label}</option>`)}
              </select>
            </label>
            <label class="fld">Fecha
              <input type="date" .value=${c.date} @input=${(e) => { this._conv = { ...this._conv, date: e.target.value }; }} />
            </label>
          </div>
          <label class="fld">Notas
            <textarea
              .value=${c.notes}
              @input=${(e) => { this._conv = { ...this._conv, notes: e.target.value }; }}
              placeholder="Qué se habló, acuerdos, comportamientos observados…"
            ></textarea>
          </label>
          <div class="row">
            <button class="primary" ?disabled=${!c.notes.trim()} @click=${this._saveConversation}>Registrar conversación</button>
          </div>
        </div>
        ${this.conversations.length === 0
          ? html`<p class="empty">Sin conversaciones registradas.</p>`
          : html`
              <ul class="hist">
                ${this.conversations.map(
                  (cv) => html`
                    <li>
                      <span class="when">${formatDate(cv.date)}</span>
                      <span class="lvl">${typeLabel(cv.type)}</span>
                      <span class="note">${cv.notes}</span>
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>
    `;
  }

  _renderNotes() {
    return html`
      <section class="support">
        <h3>Notas de acompañamiento</h3>
        <p class="disclaimer">
          Espacio sensible y <strong>no diagnóstico</strong>, separado de la dimensión Emocional.
          No tiene nivel y nunca se incluye en exports ni en agregados.
        </p>
        <div class="form">
          <label class="fld">Nueva nota
            <textarea
              .value=${this._noteText}
              @input=${(e) => { this._noteText = e.target.value; }}
              placeholder="Acompañamiento, contexto personal relevante para tu apoyo…"
            ></textarea>
          </label>
          <div class="row">
            <button class="primary" ?disabled=${!this._noteText.trim()} @click=${this._saveNote}>Guardar nota</button>
          </div>
        </div>
        ${this.notes.length === 0
          ? html`<p class="empty">Sin notas.</p>`
          : html`
              <ul class="hist">
                ${this.notes.map(
                  (n) => html`
                    <li>
                      <span class="when">${formatDate(n.date)}</span>
                      <span class="note">${n.text}</span>
                      <span class="del">
                        ${this._confirmNote === n.id
                          ? html`¿Borrar?
                              <button class="link yes" @click=${() => this._deleteNote(n.id)}>Sí</button>
                              <button class="link" @click=${() => { this._confirmNote = null; }}>No</button>`
                          : html`<button class="link" @click=${() => { this._confirmNote = n.id; }}>Borrar</button>`}
                      </span>
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>
    `;
  }

  render() {
    if (!this.person) return null;
    return html`
      <div class="head">
        <h2>${this.person.name}</h2>
        ${(this.person.teamRoles ?? []).length > 0
          ? html`<span class="chips">${this.person.teamRoles.map((r) => html`<span class="chip">${r}</span>`)}</span>`
          : null}
      </div>
      ${this.error ? html`<p class="error">${this.error}</p>` : null}
      ${this.loading
        ? html`<p class="empty">Cargando…</p>`
        : html`
            ${DIMENSIONS.map((d) => this._renderDimension(d))}
            ${this._renderConversations()}
            ${this._renderNotes()}
          `}
    `;
  }
}

if (!customElements.get('team-person-detail')) {
  customElements.define('team-person-detail', TeamPersonDetail);
}
