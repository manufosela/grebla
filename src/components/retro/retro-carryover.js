/**
 * <retro-carryover> — «Acciones de la retro anterior» (RMR-TSK-0246): el bucle.
 * Muestra en la retro actual las acciones PENDIENTES del mismo ámbito que vienen
 * de retros anteriores (no de esta), con owner y estado (fila reutilizada
 * <retro-action-row>). Al marcarlas hechas dejan de arrastrarse; mientras sigan
 * pendientes, reaparecen en cada retro.
 *
 * Props: retroId (actual), uid, leaderUid, scope ({type,label}), members ([{uid,name}]).
 */
import { LitElement, html, css } from 'lit';
import './retro-action-row.js';
import { sameScope } from '../../tools/retro/domain/actionView.js';
import { listOpenActions, setActionStatus } from '../../lib/retros.js';

export class RetroCarryover extends LitElement {
  static properties = {
    retroId: { attribute: false },
    uid: { attribute: false },
    leaderUid: { attribute: false },
    scope: { attribute: false },
    members: { attribute: false },
    _actions: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --amber: #d1902f; }
    .loop { border: 1px solid var(--rm-border, #dde7ec); border-left: 4px solid var(--amber); border-radius: 12px; padding: 0.9rem 1.1rem; background: var(--rm-surface, #fff); }
    .h { font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--rm-muted, #5b6b7d); font-weight: 700; margin: 0 0 0.3rem; }
    .sub { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 0.8rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.retroId = null;
    this.uid = null;
    this.leaderUid = null;
    this.scope = { type: 'team', label: null };
    this.members = [];
    this._actions = [];
    this._error = '';
    this._loadedFor = null;
  }

  updated(changed) {
    const key = `${this.retroId}:${this.leaderUid}`;
    if ((changed.has('retroId') || changed.has('leaderUid')) && this.retroId && this.leaderUid && key !== this._loadedFor) {
      this._loadedFor = key;
      this._load();
    }
  }

  async _load() {
    this._error = '';
    try {
      const open = await listOpenActions(this.leaderUid);
      // Pendientes del mismo ámbito que NO son de esta retro: son las que se arrastran.
      this._actions = open.filter((a) => a.fromRetroId !== this.retroId && sameScope(a, this.scope));
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las acciones anteriores.';
    }
  }

  async _toggle(action) {
    try {
      await setActionStatus(action.id, action.status === 'done' ? 'pending' : 'done');
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cambiar el estado.';
    }
  }

  render() {
    // Si no hay acciones arrastradas, el bucle no ocupa espacio.
    if (!this._actions.length && !this._error) return null;
    return html`
      <div class="loop" @retro-toggle=${(e) => this._toggle(e.detail.action)}>
        <p class="h">↩ Acciones de la retro anterior</p>
        <p class="sub">Se arrastran hasta cerrarse: revisa si se hicieron.</p>
        ${this._error ? html`<p class="error">${this._error}</p>` : null}
        ${this._actions.map((a) => html`<retro-action-row .action=${a} .uid=${this.uid} .leaderUid=${this.leaderUid} .members=${this.members}></retro-action-row>`)}
      </div>`;
  }
}

if (!customElements.get('retro-carryover')) {
  customElements.define('retro-carryover', RetroCarryover);
}
