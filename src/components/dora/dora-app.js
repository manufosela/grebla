/**
 * <dora-app>
 * Shell de la herramienta DORA. En la Fase 1 solo muestra la configuración de
 * repos; las métricas y dashboards llegan en fases posteriores. Recibe
 * persistence y canEdit inyectados desde client/dora.js.
 */
import { LitElement, html, css } from 'lit';
import './dora-repos.js';
import './dora-metrics.js';

export class DoraApp extends LitElement {
  static properties = {
    persistence: { attribute: false },
    canEdit: { attribute: false },
    refresh: { attribute: false },
    view: { state: true },
    error: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280); border-radius: 999px; padding: 0.4rem 1rem; font-size: 0.88rem; font-weight: 600; cursor: pointer; }
    .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    .loading { padding: 2rem; text-align: center; color: var(--rm-muted, #6b7280); border: 1px dashed var(--rm-border, #d1d5db); border-radius: var(--rm-radius, 12px); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.9rem; }
    .disclaimer {
      display: flex; gap: 0.5rem; align-items: baseline;
      background: var(--rm-chip, #eef2f7); color: var(--rm-navy, #1e3a5f);
      border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--rm-accent, #2a9d8f);
      border-radius: 10px; padding: 0.55rem 0.85rem; margin-bottom: 1rem; font-size: 0.85rem;
    }
    .disclaimer strong { font-weight: 700; }
  `;

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
