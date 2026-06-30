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
import './team-person-detail.js';
import './team-settings.js';
import './team-overview.js';
import './team-map.js';

export class TeamApp extends LitElement {
  static properties = {
    persistence: { attribute: false },
    storage: { attribute: false },
    uid: { attribute: false },
    isAdmin: { attribute: false },
    members: { attribute: false },
    view: { state: true },
    selected: { state: true },
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
    .back {
      border: 0; background: none; color: var(--rm-accent, #2a9d8f);
      font-size: 0.88rem; font-weight: 600; cursor: pointer; padding: 0; margin-bottom: 1rem;
    }
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
    /** @type {import('../../lib/leaders.js').Leader[]} líderes de la instancia (para compartir) */
    this.members = [];
    /** @type {'people'|'map'|'departures'|'team'|'settings'|'person'} */
    this.view = 'people';
    /** @type {import('../../tools/team/domain/types.js').Person|null} */
    this.selected = null;
    this.error = '';
  }

  _go(view) {
    this.view = view;
    if (view !== 'person') this.selected = null;
  }

  _onOpenPerson(event) {
    this.selected = event.detail.person;
    this.view = 'person';
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
        ${this._tab('map', 'Mapa')}
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
        return html`<team-people
          .persistence=${this.persistence}
          .isAdmin=${this.isAdmin}
          @open-person=${this._onOpenPerson}
        ></team-people>`;
      case 'person':
        return html`
          <button class="back" @click=${() => this._go('people')}>← Volver a personas</button>
          <team-person-detail
            .persistence=${this.persistence}
            .person=${this.selected}
            .members=${this.members}
            .currentUid=${this.uid}
            .isAdmin=${this.isAdmin}
            @person-transferred=${() => this._go('people')}
          ></team-person-detail>
        `;
      case 'map':
        return html`<team-map .persistence=${this.persistence}></team-map>`;
      case 'departures':
        return html`<team-departures .persistence=${this.persistence}></team-departures>`;
      case 'team':
        return html`<team-overview .persistence=${this.persistence}></team-overview>`;
      case 'settings':
        return html`<team-settings .persistence=${this.persistence}></team-settings>`;
      default:
        return null;
    }
  }
}

if (!customElements.get('team-app')) {
  customElements.define('team-app', TeamApp);
}
