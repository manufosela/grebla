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
import { addReading, getPersonTimeline } from '../../tools/team/application/usecases/index.js';
import { levelLabel } from '../../tools/team/domain/levels.js';

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
    loading: { state: true },
    error: { state: true },
    _form: { state: true },
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
  `;

  constructor() {
    super();
    this.persistence = null;
    /** @type {import('../../tools/team/domain/types.js').Person|null} */
    this.person = null;
    this.timeline = { seniority: [], emotional: [], knowledge: [], contribution: [] };
    this.loading = true;
    this.error = '';
    this._form = {
      seniority: { level: 0, toNext: false, note: '', date: '' },
      emotional: { level: 0, toNext: false, note: '', date: '' },
    };
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
      this.timeline = await getPersonTimeline(this.persistence, this.person.id);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar la ficha.';
    } finally {
      this.loading = false;
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
      this._loadedFor = null; // forzar recarga
      await this._load();
      this._loadedFor = this.person.id;
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
      ${this.loading ? html`<p class="empty">Cargando…</p>` : DIMENSIONS.map((d) => this._renderDimension(d))}
    `;
  }
}

if (!customElements.get('team-person-detail')) {
  customElements.define('team-person-detail', TeamPersonDetail);
}
