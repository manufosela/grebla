/**
 * <dora-app>
 * Shell de la herramienta DORA. En la Fase 1 solo muestra la configuración de
 * repos; las métricas y dashboards llegan en fases posteriores. Recibe
 * persistence e isAdmin inyectados desde client/dora.js.
 */
import { LitElement, html, css } from 'lit';
import './dora-repos.js';

export class DoraApp extends LitElement {
  static properties = {
    persistence: { attribute: false },
    isAdmin: { attribute: false },
    error: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    .loading { padding: 2rem; text-align: center; color: var(--rm-muted, #6b7280); border: 1px dashed var(--rm-border, #d1d5db); border-radius: var(--rm-radius, 12px); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.9rem; }
    .hint { font-size: 0.8rem; color: var(--rm-muted, #9ca3af); margin: 0 0 1rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.isAdmin = false;
    this.error = '';
  }

  render() {
    if (this.error) return html`<p class="error">${this.error}</p>`;
    if (!this.persistence) return html`<p class="loading">Cargando configuración…</p>`;
    return html`
      <p class="hint">Configuración de repos. Las métricas (lead time, deploy frequency…) se calcularán en la siguiente fase desde GitHub.</p>
      <dora-repos .persistence=${this.persistence} .isAdmin=${this.isAdmin}></dora-repos>
    `;
  }
}

if (!customElements.get('dora-app')) {
  customElements.define('dora-app', DoraApp);
}
