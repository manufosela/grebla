/**
 * <retro-actions> — acciones de una retro con owner(s) y estado (RMR-TSK-0245).
 * El líder de la retro (uid === leaderUid) añade acciones y asigna owner(s) del
 * roster del equipo; el owner (o el líder) marca hecha/pendiente. Las acciones
 * persisten a nivel equipo (/retroActions) y se arrastran a la siguiente (card 5).
 *
 * Props: retroId, uid, leaderUid, scope ({type,label}), members ([{uid,name}]).
 */
import { LitElement, html, css } from 'lit';
import './retro-action-row.js';
import { listRetroActions, addAction, setActionStatus } from '../../lib/retros.js';

export class RetroActions extends LitElement {
  static properties = {
    retroId: { attribute: false },
    uid: { attribute: false },
    leaderUid: { attribute: false },
    scope: { attribute: false },
    members: { attribute: false },
    _actions: { state: true },
    _newText: { state: true },
    _newOwners: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); --amber: #d1902f; --navy: var(--gr-navy, #1e3a5f); }
    .h { font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--rm-muted, #5b6b7d); font-weight: 700; margin: 0 0 0.8rem; }
    .add { margin-top: 1rem; border-top: 1px dashed var(--rm-border, #dde7ec); padding-top: 0.9rem; }
    .add input[type="text"] { width: 100%; box-sizing: border-box; font: inherit; font-size: 0.88rem; padding: 0.5rem 0.6rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 9px; background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); }
    .owners { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.6rem 0; }
    .owner-chip { display: inline-flex; align-items: center; gap: 0.3rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 999px; padding: 0.2rem 0.6rem; font-size: 0.78rem; cursor: pointer; color: var(--rm-text, #1e3a5f); }
    .owner-chip.on { background: color-mix(in srgb, var(--navy) 12%, transparent); border-color: var(--navy); font-weight: 600; }
    .btn { border: 0; background: var(--teal); color: #0c1420; border-radius: 10px; padding: 0.5rem 1rem; font: inherit; font-weight: 700; font-size: 0.85rem; cursor: pointer; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.85rem; padding: 0.3rem 0; }
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
    this._newText = '';
    this._newOwners = [];
    this._loading = false;
    this._error = '';
    this._loadedFor = null;
  }

  updated(changed) {
    if (changed.has('retroId') && this.retroId && this.retroId !== this._loadedFor) {
      this._loadedFor = this.retroId;
      this._load();
    }
  }

  get _canManage() { return !!this.uid && this.uid === this.leaderUid; }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._actions = await listRetroActions(this.retroId);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las acciones.';
    } finally {
      this._loading = false;
    }
  }

  _toggleOwner(uid) {
    this._newOwners = this._newOwners.includes(uid)
      ? this._newOwners.filter((u) => u !== uid)
      : [...this._newOwners, uid];
  }

  async _add() {
    const text = this._newText.trim();
    if (!text || !this._canManage) return;
    this._error = '';
    try {
      const ownerNames = this._newOwners.map((uid) => this.members.find((m) => m.uid === uid)?.name ?? 'Alguien');
      await addAction({ text, owners: this._newOwners, ownerNames, ownerLeaderUid: this.leaderUid, scope: this.scope, fromRetroId: this.retroId });
      this._newText = '';
      this._newOwners = [];
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo añadir la acción.';
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

  _renderAdd() {
    if (!this._canManage) return null;
    return html`
      <div class="add">
        <input type="text" placeholder="Nueva acción…" .value=${this._newText}
          @input=${(e) => { this._newText = e.target.value; }}
          @keydown=${(e) => { if (e.key === 'Enter') this._add(); }} />
        <div class="owners">
          ${this.members.map((m) => html`
            <button type="button" class="owner-chip ${this._newOwners.includes(m.uid) ? 'on' : ''}" @click=${() => this._toggleOwner(m.uid)}>
              ${this._newOwners.includes(m.uid) ? '✓' : '+'} ${m.name}
            </button>`)}
        </div>
        <button class="btn" ?disabled=${!this._newText.trim()} @click=${() => this._add()}>Añadir acción</button>
      </div>`;
  }

  render() {
    return html`
      <p class="h">✚ Acciones de esta retro</p>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      <div @retro-toggle=${(e) => this._toggle(e.detail.action)}>
        ${this._actions.length
          ? this._actions.map((a) => html`<retro-action-row .action=${a} .uid=${this.uid} .leaderUid=${this.leaderUid} .members=${this.members}></retro-action-row>`)
          : html`<p class="empty">Aún no hay acciones.</p>`}
      </div>
      ${this._renderAdd()}
    `;
  }
}

if (!customElements.get('retro-actions')) {
  customElements.define('retro-actions', RetroActions);
}
