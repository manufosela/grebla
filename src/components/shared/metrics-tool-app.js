/**
 * <MetricsToolApp> — base compartida de los shells de herramientas de métricas
 * (DORA y LEAN): props comunes (persistence/canEdit/refresh/view/error), guardas
 * de error/carga, la barra de pestañas y el disclaimer de nivel-equipo. Evita
 * duplicar el mismo andamiaje en cada tool.
 *
 * Las subclases definen:
 *  - `static tabs` = [{ id, label }]  (la primera es la vista por defecto)
 *  - getter `disclaimer` → TemplateResult con el texto del aviso
 *  - `renderView()` → el panel de la vista activa
 */
import { LitElement, html } from 'lit';
import { toolShellStyles, toolDisclaimer } from './toolShellStyles.js';

export class MetricsToolApp extends LitElement {
  static properties = {
    persistence: { attribute: false },
    canEdit: { attribute: false },
    refresh: { attribute: false },
    view: { state: true },
    error: { state: true },
  };

  static styles = toolShellStyles;

  /** @type {ReadonlyArray<{ id: string, label: string }>} */
  static tabs = [];

  constructor() {
    super();
    this.persistence = null;
    this.canEdit = false;
    this.refresh = null;
    this.view = this.constructor.tabs[0]?.id ?? '';
    this.error = '';
  }

  render() {
    if (this.error) return html`<p class="error">${this.error}</p>`;
    if (!this.persistence) return html`<p class="loading">Cargando configuración…</p>`;
    return html`
      <nav class="tabs">
        ${this.constructor.tabs.map((t) => html`<button
          class="tab ${this.view === t.id ? 'active' : ''}"
          @click=${() => { this.view = t.id; }}
        >${t.label}</button>`)}
      </nav>
      ${toolDisclaimer(this.disclaimer)}
      ${this.renderView()}
    `;
  }
}
