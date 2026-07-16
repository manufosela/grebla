/**
 * <o2o-actions> — vista «Acciones» del O2O (FASE 3, sin IA).
 *
 * El manager gestiona los compromisos derivados de los O2O de una persona: crear,
 * marcar hecho/abierto y borrar. Las acciones cuelgan de la persona, así que el
 * ingeniero podrá verlas en «Mi espacio» (fase siguiente). No llevan datos
 * sensibles del manager.
 *
 * Recibe `persistence` (con el repo de acciones) y la lista `people` del equipo.
 */
import { LitElement, html, css } from 'lit';
import {
  listActions, createAction, toggleAction, removeAction,
} from '../../tools/o2o/application/usecases/actions.js';

export class O2OActions extends LitElement {
  static properties = {
    persistence: { attribute: false },
    people: { attribute: false },
    periodId: { attribute: false },
    _personId: { state: true },
    _actions: { state: true },
    _loading: { state: true },
    _desc: { state: true },
    _owner: { state: true },
    _saving: { state: true },
    _error: { state: true },
    _confirmDelete: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .row { display: flex; gap: 0.75rem; align-items: end; flex-wrap: wrap; margin-bottom: 1rem; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    select, input[type='text'] {
      font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db);
      border-radius: 8px; background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
    }
    .add input[type='text'] { min-width: 18rem; }
    .btn {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.45rem 0.9rem; font: inherit; font-weight: 600; cursor: pointer;
    }
    .btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .btn.danger { color: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .item {
      display: flex; align-items: center; gap: 0.75rem;
      border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.55rem 0.85rem;
    }
    .item.done .desc { text-decoration: line-through; color: var(--rm-muted, #9ca3af); }
    .item .desc { flex: 1; font-size: 0.92rem; }
    .who { font-size: 0.72rem; border-radius: 999px; padding: 0.1rem 0.5rem; background: var(--rm-chip, #eef2f7); color: var(--rm-navy, #1e3a5f); }
    .actions { display: flex; gap: 0.4rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.people = [];
    this.periodId = null;
    this._personId = '';
    this._actions = [];
    this._loading = false;
    this._desc = '';
    this._owner = 'person';
    this._saving = false;
    this._error = '';
    this._confirmDelete = '';
  }

  get _personName() {
    return this.people.find((p) => p.id === this._personId)?.name ?? '';
  }

  async _selectPerson(personId) {
    this._personId = personId;
    this._error = '';
    this._confirmDelete = '';
    if (!personId) {
      this._actions = [];
      return;
    }
    this._loading = true;
    try {
      await this._reload();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las acciones.';
    } finally {
      this._loading = false;
    }
  }

  /** Recarga las acciones de la persona filtradas por el periodo actual. */
  async _reload() {
    const all = await listActions(this.persistence, this._personId);
    this._actions = all.filter((a) => !this.periodId || a.periodId === this.periodId);
  }

  async _add() {
    if (!this._desc.trim()) return;
    this._saving = true;
    this._error = '';
    try {
      await createAction(this.persistence, this._personId, { description: this._desc, owner: this._owner, periodId: this.periodId });
      this._desc = '';
      await this._reload();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo crear la acción.';
    } finally {
      this._saving = false;
    }
  }

  async _toggle(action) {
    this._error = '';
    try {
      await toggleAction(this.persistence, this._personId, action);
      await this._reload();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo actualizar la acción.';
    }
  }

  async _delete(id) {
    this._error = '';
    try {
      await removeAction(this.persistence, this._personId, id);
      this._confirmDelete = '';
      await this._reload();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar la acción.';
    }
  }

  render() {
    return html`
      ${this._renderPicker()}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._renderBody()}
    `;
  }

  _renderPicker() {
    const options = this.people.map(
      (p) => html`<option value=${p.id} ?selected=${p.id === this._personId}>${p.name}</option>`,
    );
    return html`<div class="row">
      <label>Persona
        <select .value=${this._personId} @change=${(e) => this._selectPerson(e.target.value)}>
          <option value="">— Elige a alguien de tu equipo —</option>
          ${options}
        </select>
      </label>
    </div>`;
  }

  _renderBody() {
    if (!this._personId) return html`<p class="empty">Elige una persona para gestionar sus acciones.</p>`;
    if (this._loading) return html`<p class="empty">Cargando acciones…</p>`;
    return html`${this._renderAdd()}${this._renderList()}`;
  }

  _renderAdd() {
    return html`<div class="row add">
      <label>Nueva acción
        <input
          type="text"
          placeholder="Qué hay que hacer…"
          .value=${this._desc}
          @input=${(e) => { this._desc = e.target.value; }}
          @keydown=${(e) => { if (e.key === 'Enter') this._add(); }}
        />
      </label>
      <label>Responsable
        <select .value=${this._owner} @change=${(e) => { this._owner = e.target.value; }}>
          <option value="person">La persona</option>
          <option value="leader">Yo (manager)</option>
        </select>
      </label>
      <button class="btn primary" type="button" ?disabled=${this._saving || !this._desc.trim()} @click=${() => this._add()}>
        Añadir
      </button>
    </div>`;
  }

  _renderList() {
    if (!this._actions.length) {
      return html`<p class="empty">Sin acciones para ${this._personName}. Añade la primera arriba.</p>`;
    }
    const items = this._actions.map((a) => this._renderActionItem(a));
    return html`<ul class="list">${items}</ul>`;
  }

  _renderActionItem(a) {
    const done = a.status === 'done';
    const who = a.owner === 'leader' ? 'Manager' : 'Persona';
    const confirming = this._confirmDelete === a.id;
    const delControl = confirming
      ? html`<button class="btn danger" type="button" @click=${() => this._delete(a.id)}>Confirmar</button>
             <button class="btn" type="button" @click=${() => { this._confirmDelete = ''; }}>Cancelar</button>`
      : html`<button class="btn danger" type="button" @click=${() => { this._confirmDelete = a.id; }}>Borrar</button>`;
    return html`<li class="item ${done ? 'done' : ''}">
      <input type="checkbox" .checked=${done} @change=${() => this._toggle(a)} aria-label="Marcar hecha" />
      <span class="desc">${a.description}</span>
      <span class="who">${who}</span>
      <div class="actions">${delControl}</div>
    </li>`;
  }
}

if (!customElements.get('o2o-actions')) {
  customElements.define('o2o-actions', O2OActions);
}
