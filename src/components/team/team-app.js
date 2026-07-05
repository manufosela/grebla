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
import { listActivePeople } from '../../tools/team/application/usecases/index.js';

const TEAM_TABS = ['people', 'map', 'departures', 'team', 'settings'];

/** Prefijo del hash que enlaza directamente a la ficha de una persona. */
const PERSON_HASH = 'person=';

export class TeamApp extends LitElement {
  static properties = {
    persistence: { attribute: false },
    storage: { attribute: false },
    uid: { attribute: false },
    isAdmin: { attribute: false },
    members: { attribute: false },
    framework: { attribute: false },
    view: { state: true },
    selected: { state: true },
    selectedSubtab: { state: true },
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
    .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
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
    /** @type {import('../../tools/career/data/framework.js').CareerFramework|null} framework de carrera (disciplinas/niveles) */
    this.framework = null;
    const rawHash = location.hash.slice(1);
    /** @type {import('../../tools/team/domain/types.js').Person|null} */
    this.selected = null;
    /** @type {string|null} sub-pestaña inicial con la que abrir la ficha (p. ej. al saltar desde una dimensión del Mapa) */
    this.selectedSubtab = null;
    /** @type {string|null} id de persona pendiente de abrir cuando llegue `persistence` (deep-link) */
    this._pendingPersonId = null;
    if (rawHash.startsWith(PERSON_HASH)) {
      // Deep-link a una ficha: se resuelve cuando `persistence` esté disponible.
      /** @type {'people'|'map'|'departures'|'team'|'settings'|'person'} */
      this.view = 'people';
      this._pendingPersonId = decodeURIComponent(rawHash.slice(PERSON_HASH.length)) || null;
    } else {
      this.view = TEAM_TABS.includes(rawHash) ? rawHash : 'people';
    }
    this.error = '';
    this._onHashChange = () => this._applyHash();
    /** @param {CustomEvent<{ tab: string }>} e */
    this._onGotoTab = (e) => {
      const tab = e.detail?.tab;
      if (tab) this._go(tab);
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this._onHashChange);
    // Evento burbujeante desde componentes hijos (p. ej. la ficha) para saltar a
    // una sección; compuesto, cruza el shadow DOM hasta este host.
    this.addEventListener('goto-tab', this._onGotoTab);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this._onHashChange);
    this.removeEventListener('goto-tab', this._onGotoTab);
    super.disconnectedCallback();
  }

  /**
   * Resuelve el deep-link de ficha en cuanto `persistence` está disponible (el
   * contenedor se inyecta de forma asíncrona tras resolver el acceso).
   * @param {Map<string, unknown>} changed
   */
  updated(changed) {
    if (changed.has('persistence') && this.persistence && this._pendingPersonId) {
      const id = this._pendingPersonId;
      this._pendingPersonId = null;
      this._openPersonById(id);
    }
  }

  _go(view) {
    // Las secciones (no el detalle de persona) se reflejan en el hash para que la
    // recarga y el botón atrás/adelante conserven la pestaña.
    if (view !== 'person' && location.hash.slice(1) !== view) {
      location.hash = view;
      return; // el listener de hashchange fija this.view y limpia selected
    }
    this.view = view;
    if (view !== 'person') { this.selected = null; this.selectedSubtab = null; }
  }

  /**
   * Sincroniza el estado con el hash actual: `person=<id>` abre la ficha
   * correspondiente; cualquiera de las 5 secciones conocidas cambia de pestaña.
   * @returns {void}
   */
  _applyHash() {
    const raw = location.hash.slice(1);
    if (raw.startsWith(PERSON_HASH)) {
      const id = decodeURIComponent(raw.slice(PERSON_HASH.length));
      if (id) this._openPersonById(id);
      return;
    }
    if (TEAM_TABS.includes(raw)) {
      this.view = raw;
      this.selected = null;
      this.selectedSubtab = null;
    }
  }

  /**
   * Abre la ficha de una persona a partir de su id (deep-link / recarga). Reutiliza
   * `listActivePeople` (mismo origen que la sección Personas) para localizarla; si
   * no existe o falla, vuelve a la lista de personas.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async _openPersonById(id) {
    if (this.selected?.id === id && this.view === 'person') return;
    if (!this.persistence) { this._pendingPersonId = id; return; }
    try {
      const people = await listActivePeople(this.persistence);
      const person = people.find((p) => p.id === id);
      if (person) {
        this.selected = person;
        this.view = 'person';
      } else {
        this._go('people');
      }
    } catch {
      this._go('people');
    }
  }

  /**
   * Abre la ficha de una persona en respuesta a `open-person`. Acepta dos formas
   * de detalle: `{ person }` (objeto completo, desde la sección Personas) o
   * `{ personId, subtab }` (solo id, desde el Mapa; la persona se resuelve por id).
   * `subtab` es opcional y fija la sub-pestaña inicial de la ficha (dimensión).
   * @param {CustomEvent<{ person?: import('../../tools/team/domain/types.js').Person, personId?: string, subtab?: string }>} event
   * @returns {void}
   */
  _onOpenPerson(event) {
    const detail = event.detail ?? {};
    const person = detail.person ?? null;
    const personId = person?.id ?? detail.personId ?? null;
    if (!personId) return;
    // Sub-pestaña inicial opcional (al pulsar una dimensión concreta en el Mapa).
    this.selectedSubtab = detail.subtab ?? null;
    if (person) {
      this.selected = person;
      this.view = 'person';
    }
    // Refleja la ficha en el hash para que la recarga la conserve. Si no teníamos
    // el objeto (solo id), el hashchange dispara la resolución (_openPersonById);
    // si el hash ya coincidía, la resolvemos aquí de forma explícita.
    const target = `${PERSON_HASH}${encodeURIComponent(personId)}`;
    if (location.hash.slice(1) !== target) {
      location.hash = target;
      if (!person) return;
    } else if (!person) {
      this._openPersonById(personId);
    }
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
          .members=${this.members}
          .currentUid=${this.uid}
          .isAdmin=${this.isAdmin}
          .framework=${this.framework}
          @open-person=${this._onOpenPerson}
        ></team-people>`;
      case 'person':
        return html`
          <button class="back" @click=${() => this._go('people')}>← Volver a personas</button>
          <team-person-detail
            .persistence=${this.persistence}
            .person=${this.selected}
            .framework=${this.framework}
            .isAdmin=${this.isAdmin}
            .initialSubtab=${this.selectedSubtab}
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
