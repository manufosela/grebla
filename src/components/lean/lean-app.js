/**
 * <lean-app> — shell de la herramienta LEAN / Flujo (métricas de cómo fluye el
 * trabajo del equipo, desde Linear). Dos pestañas: Equipos (config) y Métricas.
 * Recibe persistence, canEdit y refresh inyectados desde client/lean.js. Espeja
 * a <dora-app>.
 */
import { LitElement, html } from 'lit';
import './lean-teams.js';
import './lean-metrics.js';
import { toolShellStyles } from '../shared/toolShellStyles.js';

export class LeanApp extends LitElement {
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
    /** @type {'teams'|'metrics'} */
    this.view = 'teams';
    this.error = '';
  }

  render() {
    if (this.error) return html`<p class="error">${this.error}</p>`;
    if (!this.persistence) return html`<p class="loading">Cargando configuración…</p>`;
    return html`
      <nav class="tabs">
        <button class="tab ${this.view === 'teams' ? 'active' : ''}" @click=${() => { this.view = 'teams'; }}>Equipos</button>
        <button class="tab ${this.view === 'metrics' ? 'active' : ''}" @click=${() => { this.view = 'metrics'; }}>Métricas</button>
      </nav>
      <p class="disclaimer">
        <span aria-hidden="true">👥</span>
        <span>Las métricas de flujo miden cómo <strong>fluye el trabajo del equipo</strong> (throughput, ciclo, WIP, atascos), no el rendimiento de personas concretas. Complementan a DORA; no las uses para evaluar a ingenieros individuales.</span>
      </p>
      ${this.view === 'teams'
        ? html`<lean-teams .persistence=${this.persistence} .canEdit=${this.canEdit} .refresh=${this.refresh}></lean-teams>`
        : html`<lean-metrics .persistence=${this.persistence}></lean-metrics>`}
    `;
  }
}

if (!customElements.get('lean-app')) {
  customElements.define('lean-app', LeanApp);
}
