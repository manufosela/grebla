/**
 * <team-admin> — la administración de la herramienta Equipo (RMR-TSK-0586).
 *
 * Dos pestañas, porque son dos cosas distintas y ninguna es uso diario:
 *  - «Bajas»: quién ha dejado el equipo. Es gestión, y estaba a la vista de
 *    cualquiera que abriera la herramienta.
 *  - «Avisos y almacenamiento»: la cadencia de los avisos de silencio, el umbral
 *    de bus factor y el estado del almacenamiento. Se toca una vez y se olvida.
 *    Se llamaba «Configuración», que no decía de QUÉ ni PARA QUÉ: un rótulo
 *    genérico obliga a abrirlo para saber si es lo que buscas (RMR-TSK-0585).
 *
 * No reimplementa nada: monta los mismos componentes que vivían en las pestañas
 * de la herramienta. Lo que cambia es dónde están, no lo que hacen.
 */
import { LitElement, html, css } from 'lit';
import './team-departures.js';
import './team-settings.js';
import { tabFromHash } from '../../lib/tabHash.js';

const TABS = [
  { id: 'departures', label: 'Bajas' },
  { id: 'settings', label: 'Avisos y almacenamiento' },
];

export class TeamAdmin extends LitElement {
  static properties = {
    persistence: { attribute: false },
    isAdmin: { attribute: false },
    currentUid: { attribute: false },
    _tab: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .tabs { display: inline-flex; gap: 0.25rem; padding: 0.28rem; margin: 0 0 1.1rem;
      background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; }
    .tab { background: none; border: 0; border-radius: 9px; padding: 0.5rem 1.15rem; font: inherit;
      font-weight: 600; font-size: 0.9rem; color: var(--rm-muted, #5b6b7d); cursor: pointer; }
    .tab:hover { color: var(--rm-accent, #2a9d8f); }
    .tab.on { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    /* La que no toca se oculta, no se destruye: volver no la recarga. */
    .panel[hidden] { display: none; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.isAdmin = false;
    this.currentUid = null;
    // El ancla de la URL manda sobre la pestana por defecto: aqui aterriza
    // quien tenia guardado un enlace a #departures o #settings de cuando esto
    // vivia dentro de la herramienta (RMR-TSK-0586). Sin esto, el enlace llevaba
    // a la pagina correcta y a la pestana equivocada (RMR-BUG-0132).
    this._tab = tabFromHash(globalThis.location?.hash ?? '', TABS, TABS[0].id);
  }

  render() {
    if (!this.persistence) return null;
    return html`
      <div class="tabs" role="tablist" aria-label="Administración de Equipo">
        ${TABS.map((t) => this._renderTab(t))}
      </div>
      <div class="panel" ?hidden=${this._tab !== 'departures'}>
        <team-departures .persistence=${this.persistence}></team-departures>
      </div>
      <div class="panel" ?hidden=${this._tab !== 'settings'}>
        <team-settings
          .persistence=${this.persistence}
          .isAdmin=${this.isAdmin}
          .currentUid=${this.currentUid}
        ></team-settings>
      </div>`;
  }

  _renderTab(tab) {
    return html`<button class="tab ${this._tab === tab.id ? 'on' : ''}" type="button" role="tab"
      aria-selected=${this._tab === tab.id ? 'true' : 'false'}
      @click=${() => { this._tab = tab.id; }}>${tab.label}</button>`;
  }
}

customElements.define('team-admin', TeamAdmin);
