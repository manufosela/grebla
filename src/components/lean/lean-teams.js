/**
 * <lean-teams> — configuración de los equipos de Linear a monitorizar (alta, lista
 * y baja) + botón para recalcular las métricas desde Linear (Cloud Function
 * refreshLean). Espeja a <dora-repos> (versión mínima). Props: persistence, canEdit, refresh.
 */
import { LitElement, html, css } from 'lit';
import { addTeam, listTeams, removeTeam } from '../../tools/lean/application/usecases.js';

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const fmtWhen = (iso) => (iso ? dateFmt.format(new Date(iso)) : '—');

export class LeanTeams extends LitElement {
  static properties = {
    persistence: { attribute: false },
    canEdit: { attribute: false },
    refresh: { attribute: false },
    _teams: { state: true },
    _key: { state: true },
    _name: { state: true },
    _refreshing: { state: true },
    _confirmId: { state: true },
    _error: { state: true },
    _loading: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .bar { display: flex; gap: 0.75rem; align-items: end; flex-wrap: wrap; margin: 0 0 1.25rem; }
    label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    input { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    input.key { text-transform: uppercase; min-width: 8rem; }
    .btn { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.45rem 0.85rem; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .btn.danger { color: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .spacer { flex: 1; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    .key-cell { font-weight: 700; font-family: ui-monospace, monospace; }
    .muted { color: var(--rm-muted, #9ca3af); }
    .err { color: var(--rm-danger, #dc2626); font-size: 0.8rem; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .actions { display: flex; gap: 0.35rem; justify-content: flex-end; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.canEdit = false;
    this.refresh = null;
    this._teams = [];
    this._key = '';
    this._name = '';
    this._refreshing = false;
    this._confirmId = '';
    this._error = '';
    this._loading = false;
    this._loaded = false;
  }

  updated(changed) {
    if (changed.has('persistence') && this.persistence && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._teams = await listTeams(this.persistence);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los equipos.';
    } finally {
      this._loading = false;
    }
  }

  async _add() {
    const key = this._key.trim();
    if (!key) return;
    this._error = '';
    try {
      await addTeam(this.persistence, { linearTeamKey: key, name: this._name.trim() });
      this._key = '';
      this._name = '';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo añadir el equipo.';
    }
  }

  async _remove(id) {
    this._error = '';
    try {
      await removeTeam(this.persistence, id);
      this._confirmId = '';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo eliminar.';
    }
  }

  async _refreshMetrics() {
    if (!this.refresh || this._refreshing) return;
    this._refreshing = true;
    this._error = '';
    try {
      await this.refresh();
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo recalcular desde Linear.';
    } finally {
      this._refreshing = false;
    }
  }

  render() {
    return html`
      ${this.canEdit ? this._renderBar() : null}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._loading ? html`<p class="empty">Cargando…</p>` : this._renderTable()}
    `;
  }

  _renderBar() {
    return html`<div class="bar">
      <label>Key del equipo (Linear)
        <input class="key" type="text" placeholder="ENG" .value=${this._key} @input=${(e) => { this._key = e.target.value; }} />
      </label>
      <label>Nombre (opcional)
        <input type="text" placeholder="Ingeniería" .value=${this._name} @input=${(e) => { this._name = e.target.value; }} />
      </label>
      <button class="btn primary" ?disabled=${!this._key.trim()} @click=${() => this._add()}>Añadir equipo</button>
      <span class="spacer"></span>
      <button class="btn" ?disabled=${this._refreshing || !this.refresh} @click=${() => this._refreshMetrics()}>
        ${this._refreshing ? 'Recalculando…' : '↻ Recalcular desde Linear'}
      </button>
    </div>`;
  }

  _renderTable() {
    if (this._teams.length === 0) {
      return html`<p class="empty">Aún no hay equipos. Añade la key de un equipo de Linear (p. ej. «ENG») para empezar.</p>`;
    }
    return html`<table>
      <thead><tr><th>Key</th><th>Nombre</th><th>Últimas métricas</th>${this.canEdit ? html`<th></th>` : null}</tr></thead>
      <tbody>${this._teams.map((t) => this._renderRow(t))}</tbody>
    </table>`;
  }

  _renderRow(t) {
    return html`<tr>
      <td class="key-cell">${t.linearTeamKey}</td>
      <td>${t.name}</td>
      <td>${this._renderStatus(t.metrics)}</td>
      ${this.canEdit ? html`<td><div class="actions">${this._renderRowActions(t)}</div></td>` : null}
    </tr>`;
  }

  /** Estado de las últimas métricas de un equipo (error, fecha de cálculo o «sin calcular»). */
  _renderStatus(m) {
    if (m?.error) return html`<span class="err">Error: ${m.error}</span>`;
    const when = m?.computedAt ? fmtWhen(m.computedAt) : 'Sin calcular';
    return html`<span class="muted">${when}</span>`;
  }

  _renderRowActions(t) {
    if (this._confirmId === t.id) {
      return html`<button class="btn danger" @click=${() => this._remove(t.id)}>Confirmar</button>
        <button class="btn" @click=${() => { this._confirmId = ''; }}>Cancelar</button>`;
    }
    return html`<button class="btn danger" @click=${() => { this._confirmId = t.id; }}>Borrar</button>`;
  }
}

if (!customElements.get('lean-teams')) {
  customElements.define('lean-teams', LeanTeams);
}
