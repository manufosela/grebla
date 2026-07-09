/**
 * <dora-app>
 * Shell de la herramienta DORA. En la Fase 1 solo muestra la configuración de
 * repos; las métricas y dashboards llegan en fases posteriores. Recibe
 * persistence y canEdit inyectados desde client/dora.js.
 */
import { LitElement, html } from 'lit';
import './dora-repos.js';
import './dora-metrics.js';
import { toolShellStyles } from '../shared/toolShellStyles.js';

export class DoraApp extends LitElement {
  static properties = {
    persistence: { attribute: false },
    canEdit: { attribute: false },
    refresh: { attribute: false },
    view: { state: true },
    error: { state: true },
  };

  static styles = toolShellStyles;

  constructor() {
    super();
    this.persistence = null;
    this.canEdit = false;
    this.refresh = null;
    /** @type {'repos'|'metrics'} */
    this.view = 'repos';
    this.error = '';
  }

  render() {
    if (this.error) return html`<p class="error">${this.error}</p>`;
    if (!this.persistence) return html`<p class="loading">Cargando configuración…</p>`;
    return html`
      <nav class="tabs">
        <button class="tab ${this.view === 'repos' ? 'active' : ''}" @click=${() => { this.view = 'repos'; }}>Repos</button>
        <button class="tab ${this.view === 'metrics' ? 'active' : ''}" @click=${() => { this.view = 'metrics'; }}>Métricas</button>
      </nav>
      <p class="disclaimer">
        <span aria-hidden="true">👥</span>
        <span>Las métricas DORA miden la <strong>salud de la entrega del equipo/sistema</strong>, no el rendimiento de personas concretas. No las uses para evaluar a ingenieros individuales: para eso están la carrera, las dimensiones y los O2O.</span>
      </p>
      ${this.view === 'repos'
        ? html`<dora-repos .persistence=${this.persistence} .canEdit=${this.canEdit} .refresh=${this.refresh}></dora-repos>`
        : html`<dora-metrics .persistence=${this.persistence}></dora-metrics>`}
    `;
  }
}

if (!customElements.get('dora-app')) {
  customElements.define('dora-app', DoraApp);
}
