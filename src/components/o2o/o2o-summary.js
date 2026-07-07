/**
 * <o2o-summary> — vista «Resumen acumulado» del O2O (FASE 3, sin IA).
 *
 * Para una persona, muestra en SOLO LECTURA su trayectoria de O2O: la lista
 * cronológica de sesiones (fecha, resumen, si está compartido) y sus acciones
 * abiertas/cerradas. Es una agregación de lo ya registrado; no edita nada. La
 * síntesis con IA («qué ha evolucionado») llega en una fase futura.
 *
 * Recibe `persistence` (sesiones + acciones) y la lista `people` del equipo.
 */
import { LitElement, html, css } from 'lit';
import { listSessions } from '../../tools/o2o/application/usecases/sessions.js';
import { listActions } from '../../tools/o2o/application/usecases/actions.js';

export class O2OSummary extends LitElement {
  static properties = {
    persistence: { attribute: false },
    people: { attribute: false },
    _personId: { state: true },
    _sessions: { state: true },
    _actions: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .row { display: flex; gap: 0.75rem; align-items: end; flex-wrap: wrap; margin-bottom: 1rem; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    select { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    .stats { display: flex; gap: 1rem; margin: 0 0 1rem; flex-wrap: wrap; }
    .stat { background: var(--rm-chip, #eef2f7); border-radius: 10px; padding: 0.5rem 0.9rem; }
    .stat .n { font-size: 1.2rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .stat .l { font-size: 0.75rem; color: var(--rm-muted, #6b7280); }
    h3 { font-size: 0.95rem; margin: 1.1rem 0 0.5rem; color: var(--rm-navy, #1e3a5f); }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .card { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.6rem 0.85rem; }
    .card .head { display: flex; align-items: center; gap: 0.5rem; }
    .card .date { font-weight: 600; font-size: 0.9rem; }
    .card .body { font-size: 0.88rem; color: var(--rm-text, #111827); margin: 0.35rem 0 0; white-space: pre-wrap; }
    .card .none { font-size: 0.85rem; color: var(--rm-muted, #9ca3af); margin: 0.35rem 0 0; }
    .tag { font-size: 0.72rem; border-radius: 999px; padding: 0.1rem 0.5rem; background: var(--rm-chip, #eef2f7); color: var(--rm-navy, #1e3a5f); }
    .act { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .act.done { color: var(--rm-muted, #9ca3af); text-decoration: line-through; }
    .who { font-size: 0.72rem; border-radius: 999px; padding: 0.1rem 0.5rem; background: var(--rm-chip, #eef2f7); color: var(--rm-navy, #1e3a5f); text-decoration: none; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.people = [];
    this._personId = '';
    this._sessions = [];
    this._actions = [];
    this._loading = false;
    this._error = '';
  }

  get _personName() {
    return this.people.find((p) => p.id === this._personId)?.name ?? '';
  }

  async _selectPerson(personId) {
    this._personId = personId;
    this._error = '';
    if (!personId) {
      this._sessions = [];
      this._actions = [];
      return;
    }
    this._loading = true;
    try {
      const [sessions, actions] = await Promise.all([
        listSessions(this.persistence, personId),
        listActions(this.persistence, personId),
      ]);
      this._sessions = sessions;
      this._actions = actions;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el resumen.';
    } finally {
      this._loading = false;
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
    if (!this._personId) return html`<p class="empty">Elige una persona para ver su trayectoria de O2O.</p>`;
    if (this._loading) return html`<p class="empty">Cargando resumen…</p>`;
    if (!this._sessions.length && !this._actions.length) {
      return html`<p class="empty">Aún no hay O2O ni acciones con ${this._personName}.</p>`;
    }
    return html`${this._renderStats()}${this._renderSessions()}${this._renderActions()}`;
  }

  _renderStats() {
    const open = this._actions.filter((a) => a.status !== 'done').length;
    const done = this._actions.length - open;
    return html`<div class="stats">
      <div class="stat"><div class="n">${this._sessions.length}</div><div class="l">O2O registrados</div></div>
      <div class="stat"><div class="n">${open}</div><div class="l">Acciones abiertas</div></div>
      <div class="stat"><div class="n">${done}</div><div class="l">Acciones hechas</div></div>
    </div>`;
  }

  _renderSessions() {
    if (!this._sessions.length) return html`<h3>Sesiones</h3><p class="empty">Sin O2O registrados.</p>`;
    const items = this._sessions.map((s) => this._renderSessionCard(s));
    return html`<h3>Sesiones</h3><ul class="list">${items}</ul>`;
  }

  _renderSessionCard(s) {
    const shared = s.sharedWithPerson ? html`<span class="tag">Compartido</span>` : null;
    const body = s.summary
      ? html`<p class="body">${s.summary}</p>`
      : html`<p class="none">Sin resumen. ${(s.answers ?? []).length} respuesta(s) a la guía.</p>`;
    return html`<li class="card">
      <div class="head"><span class="date">${s.date?.slice(0, 10)}</span>${shared}</div>
      ${body}
    </li>`;
  }

  _renderActions() {
    if (!this._actions.length) return html`<h3>Acciones</h3><p class="empty">Sin acciones.</p>`;
    const items = this._actions.map((a) => {
      const done = a.status === 'done';
      const who = a.owner === 'leader' ? 'Líder' : 'Persona';
      return html`<li class="act ${done ? 'done' : ''}">
        ${done ? '✓' : '○'} <span>${a.description}</span> <span class="who">${who}</span>
      </li>`;
    });
    return html`<h3>Acciones</h3><ul class="list">${items}</ul>`;
  }
}

if (!customElements.get('o2o-summary')) {
  customElements.define('o2o-summary', O2OSummary);
}
