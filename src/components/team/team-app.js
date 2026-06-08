/**
 * <team-app>
 * Shell de la mini-SPA de seguimiento de equipo. Router por estado entre
 * secciones. En la Fase 3a solo "Personas" es funcional; "Equipo" y "Ajustes"
 * son placeholders que se completarán en 3b/3c. Recibe persistence/storage por
 * propiedad (inyectados desde el composition root en client/team.js).
 *
 * Propiedades:
 *  - persistence: PersistencePort
 *  - storage: FileStoragePort
 *  - uid: string
 */
import { LitElement, html, css } from 'lit';
import './team-people.js';
import './team-departures.js';

export class TeamApp extends LitElement {
  static properties = {
    persistence: { attribute: false },
    storage: { attribute: false },
    uid: { attribute: false },
    isAdmin: { attribute: false },
    view: { state: true },
    error: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    .sections { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-muted, #6b7280);
      border-radius: 999px;
      padding: 0.4rem 1rem;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    .loading, .placeholder {
      padding: 2rem; text-align: center; color: var(--rm-muted, #6b7280);
      border: 1px dashed var(--rm-border, #d1d5db); border-radius: var(--rm-radius, 12px);
    }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.9rem; margin: 0.5rem 0; }
  `;

  constructor() {
    super();
    /** @type {import('../../tools/team/domain/ports.js').PersistencePort|null} */
    this.persistence = null;
    this.storage = null;
    /** @type {string|null} */
    this.uid = null;
    /** @type {boolean} */
    this.isAdmin = false;
    /** @type {'people'|'departures'|'team'|'settings'} */
    this.view = 'people';
    this.error = '';
  }

  _go(view) {
    this.view = view;
  }

  _tab(key, label) {
    return html`<button
      class="tab ${this.view === key ? 'active' : ''}"
      @click=${() => this._go(key)}
    >${label}</button>`;
  }

  render() {
    if (this.error) return html`<p class="error">${this.error}</p>`;
    if (!this.persistence) return html`<p class="loading">Cargando tu equipo…</p>`;
    return html`
      <nav class="sections" aria-label="Secciones">
        ${this._tab('people', 'Personas')}
        ${this._tab('departures', 'Bajas')}
        ${this._tab('team', 'Equipo')}
        ${this._tab('settings', 'Ajustes')}
      </nav>
      ${this._renderView()}
    `;
  }

  _renderView() {
    switch (this.view) {
      case 'people':
        return html`<team-people .persistence=${this.persistence} .isAdmin=${this.isAdmin}></team-people>`;
      case 'departures':
        return html`<team-departures .persistence=${this.persistence}></team-departures>`;
      case 'team':
        return html`<div class="placeholder">Cobertura de roles, bus factor y avisos de silencio — próximamente (Fase 3c).</div>`;
      case 'settings':
        return html`<div class="placeholder">Áreas de conocimiento, cadencia y umbrales — próximamente (Fase 3c).</div>`;
      default:
        return null;
    }
  }
}

if (!customElements.get('team-app')) {
  customElements.define('team-app', TeamApp);
}
