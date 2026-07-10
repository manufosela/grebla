/**
 * <lean-teams> — configuración de las unidades de flujo (equipos = label del grupo
 * Squad de Linear; gremios = grupo Chapter). Botón «Descubrir desde Linear»
 * (auto-poblado), «Recalcular» y alta/baja manual. Props: persistence, canEdit,
 * refresh, discover.
 */
import { LitElement, html, css } from 'lit';
import { addUnit, listUnits, removeUnit } from '../../tools/lean/application/usecases.js';

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const fmtWhen = (iso) => (iso ? dateFmt.format(new Date(iso)) : '—');
const KIND_LABEL = { squad: 'Equipos', chapter: 'Gremios' };

export class LeanTeams extends LitElement {
  static properties = {
    persistence: { attribute: false },
    canEdit: { attribute: false },
    refresh: { attribute: false },
    discover: { attribute: false },
    _units: { state: true },
    _label: { state: true },
    _kind: { state: true },
    _name: { state: true },
    _refreshing: { state: true },
    _discovering: { state: true },
    _confirmId: { state: true },
    _error: { state: true },
    _loading: { state: true },
    _info: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .bar { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin: 0 0 1rem; }
    .btn { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.45rem 0.85rem; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .btn.danger { color: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .spacer { flex: 1; }
    .info { font-size: 0.82rem; color: var(--rm-muted, #6b7280); margin: 0 0 1rem; }
    details.manual { margin: 0 0 1rem; }
    details.manual summary { cursor: pointer; font-size: 0.82rem; color: var(--rm-muted, #6b7280); }
    .manual .row { display: flex; gap: 0.6rem; align-items: end; flex-wrap: wrap; margin: 0.6rem 0 0; }
    label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.76rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    input, select { font: inherit; padding: 0.4rem 0.55rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    h4 { font-size: 0.85rem; color: var(--rm-navy, #1e3a5f); margin: 1.1rem 0 0.4rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    .label-cell { font-weight: 700; }
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
    this.discover = null;
    this._units = [];
    this._label = '';
    this._kind = 'squad';
    this._name = '';
    this._refreshing = false;
    this._discovering = false;
    this._confirmId = '';
    this._error = '';
    this._loading = false;
    this._info = '';
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
      this._units = await listUnits(this.persistence);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las unidades.';
    } finally {
      this._loading = false;
    }
  }

  async _discoverUnits() {
    if (!this.discover || this._discovering) return;
    this._discovering = true;
    this._error = '';
    this._info = '';
    try {
      const res = await this.discover();
      const n = (res?.created ?? []).length;
      this._info = n ? `Se añadieron ${n} unidades desde Linear. Pulsa «Recalcular» para traer sus métricas.` : 'No había unidades nuevas que descubrir.';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo descubrir desde Linear.';
    } finally {
      this._discovering = false;
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

  async _add() {
    const linearLabel = this._label.trim();
    if (!linearLabel) return;
    this._error = '';
    try {
      await addUnit(this.persistence, { linearLabel, kind: this._kind, name: this._name.trim() });
      this._label = '';
      this._name = '';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo añadir.';
    }
  }

  async _remove(id) {
    this._error = '';
    try {
      await removeUnit(this.persistence, id);
      this._confirmId = '';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo eliminar.';
    }
  }

  render() {
    return html`
      ${this.canEdit ? this._renderBar() : null}
      ${this._info ? html`<p class="info">${this._info}</p>` : null}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this.canEdit ? this._renderManual() : null}
      ${this._loading ? html`<p class="empty">Cargando…</p>` : this._renderGroups()}
    `;
  }

  _renderBar() {
    return html`<div class="bar">
      <button class="btn primary" ?disabled=${this._discovering || !this.discover} @click=${() => this._discoverUnits()}>
        ${this._discovering ? 'Descubriendo…' : '✨ Descubrir equipos y gremios desde Linear'}
      </button>
      <span class="spacer"></span>
      <button class="btn" ?disabled=${this._refreshing || !this.refresh} @click=${() => this._refreshMetrics()}>
        ${this._refreshing ? 'Recalculando…' : '↻ Recalcular métricas'}
      </button>
    </div>`;
  }

  _renderManual() {
    return html`<details class="manual">
      <summary>Añadir una unidad a mano</summary>
      <div class="row">
        <label>Label de Linear
          <input type="text" placeholder="Trust" .value=${this._label} @input=${(e) => { this._label = e.target.value; }} />
        </label>
        <label>Tipo
          <select .value=${this._kind} @change=${(e) => { this._kind = e.target.value; }}>
            <option value="squad">Equipo (Squad)</option>
            <option value="chapter">Gremio (Chapter)</option>
          </select>
        </label>
        <label>Nombre (opcional)
          <input type="text" placeholder="Equipo Trust" .value=${this._name} @input=${(e) => { this._name = e.target.value; }} />
        </label>
        <button class="btn" ?disabled=${!this._label.trim()} @click=${() => this._add()}>Añadir</button>
      </div>
    </details>`;
  }

  _renderGroups() {
    if (this._units.length === 0) {
      return html`<p class="empty">Aún no hay unidades. Pulsa «✨ Descubrir equipos y gremios desde Linear» para poblarlas automáticamente.</p>`;
    }
    return html`
      ${this._renderKind('squad')}
      ${this._renderKind('chapter')}
    `;
  }

  _renderKind(kind) {
    const units = this._units.filter((u) => u.kind === kind);
    if (units.length === 0) return null;
    return html`
      <h4>${KIND_LABEL[kind]} (${units.length})</h4>
      <table>
        <thead><tr><th>Label</th><th>Nombre</th><th>Últimas métricas</th>${this.canEdit ? html`<th></th>` : null}</tr></thead>
        <tbody>${units.map((u) => this._renderRow(u))}</tbody>
      </table>
    `;
  }

  _renderRow(u) {
    return html`<tr>
      <td class="label-cell">${u.linearLabel}</td>
      <td>${u.name}</td>
      <td>${this._renderStatus(u.metrics)}</td>
      ${this.canEdit ? html`<td><div class="actions">${this._renderRowActions(u)}</div></td>` : null}
    </tr>`;
  }

  _renderStatus(m) {
    if (m?.error) return html`<span class="err">Error: ${m.error}</span>`;
    const when = m?.computedAt ? fmtWhen(m.computedAt) : 'Sin calcular';
    return html`<span class="muted">${when}</span>`;
  }

  _renderRowActions(u) {
    if (this._confirmId === u.id) {
      return html`<button class="btn danger" @click=${() => this._remove(u.id)}>Confirmar</button>
        <button class="btn" @click=${() => { this._confirmId = ''; }}>Cancelar</button>`;
    }
    return html`<button class="btn danger" @click=${() => { this._confirmId = u.id; }}>Borrar</button>`;
  }
}

if (!customElements.get('lean-teams')) {
  customElements.define('lean-teams', LeanTeams);
}
