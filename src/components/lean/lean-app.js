/**
 * <lean-app> — shell de la herramienta LEAN / Flujo (métricas de cómo fluye el
 * trabajo del equipo, desde Linear). Dos pestañas: Equipos (config) y Métricas.
 * Extiende MetricsToolApp (base compartida con DORA). Recibe persistence, canEdit
 * y refresh inyectados desde client/lean.js.
 */
import { html } from 'lit';
import './lean-teams.js';
import './lean-metrics.js';
import { MetricsToolApp } from '../shared/metrics-tool-app.js';

export class LeanApp extends MetricsToolApp {
  static properties = {
    ...MetricsToolApp.properties,
    discover: { attribute: false },
  };

  static tabs = [
    { id: 'teams', label: 'Equipos' },
    { id: 'metrics', label: 'Métricas' },
  ];

  constructor() {
    super();
    this.discover = null;
  }

  get disclaimer() {
    return html`Las métricas de flujo miden cómo <strong>fluye el trabajo del equipo</strong> (throughput, ciclo, WIP, atascos), no el rendimiento de personas concretas. Complementan a DORA; no las uses para evaluar a ingenieros individuales.`;
  }

  renderView() {
    return this.view === 'teams'
      ? html`<lean-teams .persistence=${this.persistence} .canEdit=${this.canEdit} .refresh=${this.refresh} .discover=${this.discover}></lean-teams>`
      : html`<lean-metrics .persistence=${this.persistence}></lean-metrics>`;
  }
}

if (!customElements.get('lean-app')) {
  customElements.define('lean-app', LeanApp);
}
