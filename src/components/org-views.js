/**
 * <org-views> — las dos vistas del organigrama (RMR-PCS-0042 · F1) en
 * pestañas: «GREBLA» (pirámide invertida de roles, <org-chart>) y «Estándar»
 * (árbol de personas, <org-people-chart>). Solo conmuta; cada vista carga lo
 * suyo. La pestaña se recuerda en el hash (#estandar) para poder enlazarla.
 */
import { LitElement, html, css } from 'lit';
import './org-chart.js';
import './org-people-chart.js';

const VIEWS = [
  { id: 'grebla', label: 'Pirámide GREBLA', hash: '' },
  { id: 'estandar', label: 'Estándar', hash: '#estandar' },
];

export class OrgViews extends LitElement {
  static properties = { _view: { state: true } };

  static styles = css`
    :host { display: block; }
    .tabs { display: flex; gap: 0.1rem; border-bottom: 2px solid var(--rm-border, #e5e7eb); margin-bottom: 1rem; }
    .tab { border: 0; background: none; color: var(--rm-muted, #5b6b7d); padding: 0.55rem 1rem; font: inherit; font-size: 0.95rem; font-weight: 700; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; }
    .tab.on { color: var(--rm-accent, #2a9d8f); border-bottom-color: var(--rm-accent, #2a9d8f); }
    .tab:hover:not(.on) { color: var(--rm-text, #111827); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 6px; }
  `;

  constructor() {
    super();
    this._view = globalThis.location?.hash === '#estandar' ? 'estandar' : 'grebla';
  }

  _select(view) {
    this._view = view.id;
    globalThis.history?.replaceState(null, '', `${globalThis.location.pathname}${view.hash}`);
  }

  render() {
    return html`
      <div class="tabs" role="tablist" aria-label="Vistas del organigrama">
        ${VIEWS.map((v) => html`<button type="button" role="tab" class="tab ${this._view === v.id ? 'on' : ''}"
          aria-selected=${this._view === v.id ? 'true' : 'false'} @click=${() => this._select(v)}>${v.label}</button>`)}
      </div>
      ${this._view === 'estandar' ? html`<org-people-chart></org-people-chart>` : html`<org-chart></org-chart>`}`;
  }
}

if (!customElements.get('org-views')) customElements.define('org-views', OrgViews);
