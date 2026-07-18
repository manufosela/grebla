/**
 * <app-modal>
 * Modal reutilizable y accesible. Sustituye a alert()/confirm()/prompt() nativos.
 * Muestra un backdrop con un panel centrado; el contenido va en el slot por
 * defecto y el título por la propiedad `heading`. Se cierra con el botón ×, la
 * tecla Escape o pulsando fuera del panel, emitiendo el evento `close`.
 *
 * Propiedades:
 *  - open: boolean   Visibilidad del modal (controlada por el padre).
 *  - heading: string Título mostrado en la cabecera.
 *
 * Eventos:
 *  - close  Cuando el usuario pide cerrar (botón, Escape o click fuera).
 *
 * Uso:
 *   <app-modal .open=${this._open} heading="Compartir" @close=${() => { this._open = false; }}>
 *     …contenido…
 *   </app-modal>
 */
import { LitElement, html, css } from 'lit';

export class AppModal extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    heading: { type: String },
    /** Tamaño del panel: '' (normal, 32rem) o 'wide' (52rem). */
    size: { type: String, reflect: true },
  };

  static styles = css`
    :host { display: none; }
    :host([open]) { display: block; }
    .backdrop {
      position: fixed;
      inset: 0;
      background: var(--rm-overlay, rgba(17, 24, 39, 0.5));
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      z-index: 1000;
    }
    .panel {
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      box-shadow: var(--rm-shadow, 0 10px 30px rgba(0, 0, 0, 0.2));
      width: min(32rem, 100%);
      /* Deja siempre ≥10% de aire arriba y abajo (RMR-TSK-0265): el panel nunca
         pasa del 80% del alto y el backdrop lo centra. Si el contenido es más
         alto, scrollea dentro. */
      max-height: 80vh;
      overflow: auto;
      padding: 1.25rem 1.5rem 1.5rem;
    }
    /* Variante ancha para formularios densos (p. ej. el editor de rutas). */
    :host([size='wide']) .panel { width: min(52rem, 100%); }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    h2 { font-size: 1.05rem; margin: 0; }
    .close {
      border: 0;
      background: none;
      color: var(--rm-muted, #6b7280);
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
      padding: 0 0.25rem;
      border-radius: 8px;
    }
    .close:hover { color: var(--rm-text, #111827); }
    .close:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
  `;

  constructor() {
    super();
    this.open = false;
    this.heading = '';
    this._onKeydown = this._onKeydown.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this._onKeydown);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._onKeydown);
    super.disconnectedCallback();
  }

  /** @param {KeyboardEvent} event */
  _onKeydown(event) {
    if (this.open && event.key === 'Escape') {
      event.preventDefault();
      this._close();
    }
  }

  updated(changed) {
    if (changed.has('open') && this.open) {
      // Lleva el foco al panel al abrir, para teclado y lectores de pantalla.
      this.updateComplete.then(() => {
        this.renderRoot.querySelector('.close')?.focus();
      });
    }
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  /** @param {MouseEvent} event */
  _onBackdropClick(event) {
    if (event.target === event.currentTarget) this._close();
  }

  render() {
    if (!this.open) return null;
    return html`
      <div
        class="backdrop"
        @click=${this._onBackdropClick}
      >
        <div
          class="panel"
          role="dialog"
          aria-modal="true"
          aria-label=${this.heading || 'Diálogo'}
        >
          <div class="head">
            <h2>${this.heading}</h2>
            <button class="close" type="button" aria-label="Cerrar" @click=${this._close}>×</button>
          </div>
          <slot></slot>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('app-modal')) {
  customElements.define('app-modal', AppModal);
}
