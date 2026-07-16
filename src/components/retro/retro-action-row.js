/**
 * <retro-action-row> — una fila de acción (texto + owner(s) + toggle hecha/pendiente).
 * Reutilizada por <retro-actions> (acciones de esta retro) y <retro-carryover>
 * (acciones arrastradas). Emite `retro-toggle` con la acción; el padre persiste.
 *
 * Props: action, uid, leaderUid, members ([{uid,name}]).
 */
import { LitElement, html, css } from 'lit';
import { ownersText, canToggle } from '../../tools/retro/domain/actionView.js';

export class RetroActionRow extends LitElement {
  static properties = {
    action: { attribute: false },
    uid: { attribute: false },
    leaderUid: { attribute: false },
    members: { attribute: false },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); --amber: #d1902f; }
    .row { display: flex; align-items: center; gap: 0.7rem; padding: 0.55rem 0; border-top: 1px solid var(--rm-border, #eef0f2); flex-wrap: wrap; }
    :host(:first-of-type) .row { border-top: 0; }
    .txt { flex: 1; min-width: 12rem; font-size: 0.9rem; }
    .who { font-size: 0.74rem; color: var(--rm-muted, #5b6b7d); }
    .toggle { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface-2, #f5fafa); font: inherit; font-size: 0.74rem; font-weight: 700; padding: 0.28rem 0.7rem; border-radius: 999px; cursor: pointer; white-space: nowrap; }
    .toggle:disabled { opacity: 0.6; cursor: default; }
    .toggle.done { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--rm-accent-700, var(--teal)); border-color: color-mix(in srgb, var(--teal) 40%, transparent); }
    .toggle.pending { background: color-mix(in srgb, var(--amber) 15%, transparent); color: var(--amber); border-color: color-mix(in srgb, var(--amber) 40%, transparent); }
  `;

  constructor() {
    super();
    this.action = null;
    this.uid = null;
    this.leaderUid = null;
    this.members = [];
  }

  _toggle() {
    if (!canToggle(this.action, this.uid, this.leaderUid)) return;
    this.dispatchEvent(new CustomEvent('retro-toggle', { detail: { action: this.action }, bubbles: true, composed: true }));
  }

  render() {
    if (!this.action) return null;
    const done = this.action.status === 'done';
    return html`
      <div class="row">
        <span class="txt">${this.action.text} <span class="who">· ${ownersText(this.action, this.members)}</span></span>
        <button class="toggle ${done ? 'done' : 'pending'}" ?disabled=${!canToggle(this.action, this.uid, this.leaderUid)} @click=${() => this._toggle()}>
          ${done ? '✓ Hecha' : '⏳ Pendiente'}
        </button>
      </div>`;
  }
}

if (!customElements.get('retro-action-row')) {
  customElements.define('retro-action-row', RetroActionRow);
}
