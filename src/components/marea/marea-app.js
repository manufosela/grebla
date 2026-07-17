/**
 * <marea-app> — contenedor de Marea con dos pestañas: «Mi marea» (rellenar) y
 * «Resultados» (agregado anónimo del equipo). Recibe el uid del usuario logado y
 * lo pasa a <marea-fill>. Ambas vistas quedan montadas y se muestran/ocultan para
 * no perder lo que estés rellenando al cambiar de pestaña.
 */
import { LitElement, html, css } from 'lit';
import './marea-fill.js';
import './marea-results.js';
import './marea-evolution.js';

export class MareaApp extends LitElement {
  static properties = {
    uid: { attribute: false },
    _tab: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .seg { display: inline-flex; background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 999px; padding: 0.25rem; gap: 0.2rem; margin-bottom: 1.3rem; }
    .seg button { border: 0; background: transparent; font: inherit; font-size: 0.85rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); padding: 0.45rem 1.05rem; border-radius: 999px; cursor: pointer; }
    .seg button[aria-selected="true"] { background: var(--gr-teal, #2a9d8f); color: #0c1420; }
    .seg button:focus-visible { outline: 2px solid var(--gr-navy, #1e3a5f); outline-offset: 2px; }
    [hidden] { display: none; }
  `;

  constructor() {
    super();
    this.uid = null;
    this._tab = 'mine';
  }

  render() {
    return html`
      <div class="seg" role="tablist" aria-label="Marea">
        <button role="tab" aria-selected=${this._tab === 'mine'} @click=${() => { this._tab = 'mine'; }}>Mi marea</button>
        <button role="tab" aria-selected=${this._tab === 'evolution'} @click=${() => { this._tab = 'evolution'; }}>Mi evolución</button>
        <button role="tab" aria-selected=${this._tab === 'results'} @click=${() => { this._tab = 'results'; }}>Resultados</button>
      </div>
      <div ?hidden=${this._tab !== 'mine'}><marea-fill .uid=${this.uid}></marea-fill></div>
      <div ?hidden=${this._tab !== 'evolution'}><marea-evolution .uid=${this.uid}></marea-evolution></div>
      <div ?hidden=${this._tab !== 'results'}><marea-results></marea-results></div>
    `;
  }
}

if (!customElements.get('marea-app')) {
  customElements.define('marea-app', MareaApp);
}
