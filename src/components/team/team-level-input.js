/**
 * <team-level-input>
 * Selector reutilizable del nivel GREBLA (1-7) con su color y la opción de
 * "en tránsito al siguiente nivel" (toNext). Emite `level-change` con
 * { level, toNext }. Lo usan las dimensiones de nivel (seniority, emocional y,
 * más adelante, conocimiento por área).
 *
 * Propiedades:
 *  - level: number (1-7, 0 = sin seleccionar)
 *  - toNext: boolean
 */
import { LitElement, html, css } from 'lit';
import { LEVELS, MAX_LEVEL } from '../../tools/team/domain/levels.js';

export class TeamLevelInput extends LitElement {
  static properties = {
    level: { type: Number },
    toNext: { type: Boolean },
  };

  static styles = css`
    :host { display: block; }
    .levels { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .lvl {
      display: inline-flex; align-items: center; gap: 0.4rem;
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827); border-radius: 999px; padding: 0.3rem 0.7rem;
      font-size: 0.8rem; font-weight: 600; cursor: pointer;
    }
    .lvl .dot { width: 12px; height: 12px; border-radius: 50%; background: var(--c, #999); border: 1px solid rgba(0,0,0,0.1); }
    .lvl.sel { border-color: var(--c, #2a9d8f); box-shadow: inset 0 0 0 1px var(--c, #2a9d8f); }
    .tonext { display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 0.6rem; font-size: 0.82rem; color: var(--rm-muted, #6b7280); }
    .tonext.disabled { opacity: 0.5; }
  `;

  constructor() {
    super();
    this.level = 0;
    this.toNext = false;
  }

  _select(order) {
    this.level = order;
    if (this.level >= MAX_LEVEL) this.toNext = false;
    this._emit();
  }

  _toggle(event) {
    this.toNext = event.target.checked;
    this._emit();
  }

  _emit() {
    this.dispatchEvent(
      new CustomEvent('level-change', {
        detail: { level: this.level, toNext: this.toNext },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const atMax = this.level >= MAX_LEVEL;
    return html`
      <div class="levels" role="radiogroup" aria-label="Nivel">
        ${LEVELS.map(
          (l) => html`
            <button
              type="button"
              class="lvl ${this.level === l.order ? 'sel' : ''}"
              style=${`--c:${l.color}`}
              title=${l.groupName}
              aria-pressed=${this.level === l.order}
              @click=${() => this._select(l.order)}
            >
              <span class="dot"></span><span>${l.order}. ${l.name}</span>
            </button>
          `,
        )}
      </div>
      <label class="tonext ${atMax || this.level === 0 ? 'disabled' : ''}">
        <input
          type="checkbox"
          .checked=${this.toNext}
          ?disabled=${atMax || this.level === 0}
          @change=${this._toggle}
        />
        En tránsito al siguiente nivel
      </label>
    `;
  }
}

if (!customElements.get('team-level-input')) {
  customElements.define('team-level-input', TeamLevelInput);
}
