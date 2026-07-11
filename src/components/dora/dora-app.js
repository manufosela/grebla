/**
 * <dora-app>
 * Shell de la herramienta DORA (config de repos + métricas de entrega). Extiende
 * MetricsToolApp (base compartida con LEAN). Recibe persistence, canEdit y refresh
 * inyectados desde client/dora.js.
 */
import { html } from 'lit';
import './dora-repos.js';
import './dora-metrics.js';
import { MetricsToolApp } from '../shared/metrics-tool-app.js';

export class DoraApp extends MetricsToolApp {
  static properties = {
    ...MetricsToolApp.properties,
    interpret: { attribute: false },
    loadSaved: { attribute: false },
    canInterpret: { attribute: false },
  };

  static tabs = [
    { id: 'repos', label: 'Repos' },
    { id: 'metrics', label: 'Métricas' },
  ];

  constructor() {
    super();
    this.interpret = null;
    this.loadSaved = null;
    this.canInterpret = false;
  }

  get disclaimer() {
    return html`Las métricas DORA miden la <strong>salud de la entrega del equipo/sistema</strong>, no el rendimiento de personas concretas. No las uses para evaluar a ingenieros individuales: para eso están la carrera, las dimensiones y los O2O.`;
  }

  renderView() {
    return this.view === 'repos'
      ? html`<dora-repos .persistence=${this.persistence} .canEdit=${this.canEdit} .refresh=${this.refresh}></dora-repos>`
      : html`<dora-metrics
          .persistence=${this.persistence}
          .interpret=${this.interpret}
          .loadSaved=${this.loadSaved}
          .canInterpret=${this.canInterpret}
        ></dora-metrics>`;
  }
}

if (!customElements.get('dora-app')) {
  customElements.define('dora-app', DoraApp);
}
