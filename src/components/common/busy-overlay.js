/**
 * <busy-overlay> — capa BLOQUEANTE para operaciones en curso (RMR-TSK-0406).
 *
 * Mientras algo se está enviando/guardando, cubre el viewport COMPLETO
 * (position: fixed) con un velo que captura todos los clics, un spinner y el
 * mensaje de la acción («Enviando tu kudo…»). Así no se puede navegar dentro
 * de la app a mitad de escritura y perder el envío.
 *
 * Uso: renderizarlo condicionalmente mientras dura la operación —
 *   ${this._sending ? html`<busy-overlay message="Enviando…"></busy-overlay>` : nothing}
 * Vive dentro del shadow root del tool, pero al ser fixed cubre toda la
 * página. Accesible: role="alert" + aria-busy, y sin animación con
 * prefers-reduced-motion.
 */
import { LitElement, html, css } from 'lit';

export class BusyOverlay extends LitElement {
  static properties = {
    message: { type: String },
  };

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--rm-navy, #1e3a5f) 38%, transparent);
      backdrop-filter: blur(2px);
      /* La capa captura TODO: nada debajo es clicable mientras esté montada. */
      pointer-events: auto;
      cursor: progress;
    }
    .box {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: 999px;
      padding: 0.8rem 1.4rem;
      box-shadow: 0 14px 40px rgba(17, 24, 39, 0.28);
      font-size: 0.95rem;
      font-weight: 600;
    }
    .spinner {
      width: 1.2rem;
      height: 1.2rem;
      flex: none;
      border-radius: 50%;
      border: 3px solid var(--rm-track, #e9f0f2);
      border-top-color: var(--rm-accent, #2a9d8f);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .spinner { animation: none; border-top-color: var(--rm-navy, #1e3a5f); }
    }
  `;

  constructor() {
    super();
    this.message = 'Un momento…';
    /** Guarda el foco previo para devolverlo al desmontar. @type {Element|null} */
    this._previousFocus = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'alert');
    this.setAttribute('aria-busy', 'true');
    // El teclado tampoco debe operar lo de debajo: foco al velo mientras dure.
    this._previousFocus = document.activeElement;
    this.tabIndex = -1;
    this.updateComplete.then(() => this.focus());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._previousFocus instanceof HTMLElement) this._previousFocus.focus();
  }

  render() {
    return html`<div class="box">
      <span class="spinner" aria-hidden="true"></span>
      <span>${this.message}</span>
    </div>`;
  }
}

if (!customElements.get('busy-overlay')) {
  customElements.define('busy-overlay', BusyOverlay);
}
