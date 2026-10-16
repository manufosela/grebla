/**
 * <rm-admin> — la administración de Role Mirror (RMR-TSK-0562).
 *
 * Lista de personas a la IZQUIERDA y, al pinchar en una, su perfil a la derecha
 * para verlo y gestionarlo: la propuesta que haya enviado, el cuestionario con
 * el que el manager fija la versión que cuenta, y el histórico de mediciones con
 * quién tocó cada una.
 *
 * Antes esto estaba repartido en tres sitios —un selector en la pantalla de uso,
 * un dashboard sin enlace y lo propio en «Mi espacio»—, así que gestionar a
 * alguien obligaba a saberse el camino. Una lista siempre visible dice además
 * algo que un desplegable esconde: cuánta gente falta por valorar.
 */
import { LitElement, html, css } from 'lit';
import { tableStyles } from './common/table-styles.js';
import './rm-person.js';
import { getPersonProfile } from '../lib/firestore.js';

export class RmAdmin extends LitElement {
  static properties = {
    people: { attribute: false },
    items: { attribute: false },
    roles: { attribute: false },
    dimensions: { attribute: false },
    orgConfig: { attribute: false },
    _selected: { state: true },
    _profiles: { state: true },
  };

  static styles = [tableStyles, css`
    :host { display: block; }
    .layout { display: grid; grid-template-columns: 17rem 1fr; gap: 1.5rem; align-items: start; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }

    .side { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; overflow: hidden; background: var(--rm-surface, #fff); }
    .side h2 { margin: 0; padding: 0.7rem 0.9rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--rm-muted, #5b6b7d); border-bottom: 1px solid var(--rm-border, #eef0f2); }
    .side ul { list-style: none; margin: 0; padding: 0; max-height: 34rem; overflow: auto; }
    .side li + li { border-top: 1px solid var(--rm-border, #eef0f2); }
    .person { width: 100%; display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start;
      padding: 0.6rem 0.9rem; background: none; border: 0; cursor: pointer; font: inherit; text-align: left; }
    .person:hover { background: var(--rm-surface-hover, #f6f9fa); }
    .person[aria-current="true"] { background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 12%, transparent);
      box-shadow: inset 3px 0 0 var(--rm-accent, #2a9d8f); }
    .person .name { font-weight: 600; font-size: 0.9rem; color: var(--rm-text, #111827); }
    .person .meta { font-size: 0.75rem; color: var(--rm-muted, #5b6b7d); }
    .person .pending { color: var(--rm-danger, #b45309); font-weight: 700; }

    .pick { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    /* Dentro de la caja de la lista, el aviso necesita su propio aire: la caja no
       tiene relleno porque sus filas llegan de lado a lado. */
    .side .empty { padding: 0.9rem; }
  `];

  constructor() {
    super();
    this.people = [];
    this.items = [];
    this.roles = [];
    this.dimensions = [];
    this.orgConfig = null;
    this._selected = null;
    /** @type {Map<string, {dominantRole?: string|null, completion?: number, updatedAt?: unknown}|null>} */
    this._profiles = new Map();
  }

  updated(changed) {
    if (changed.has('people')) this._loadProfiles();
  }

  /**
   * El estado de cada persona, para que la lista diga de un vistazo a quién le
   * falta perfil. Una lectura por persona, tolerante: la que falle sale «sin
   * perfil», que es justo lo que se quiere ver.
   */
  async _loadProfiles() {
    const entradas = await Promise.all((this.people ?? []).map(async (p) => {
      try { return [p.id, await getPersonProfile(p.id)]; } catch { return [p.id, null]; }
    }));
    this._profiles = new Map(entradas);
  }

  _select(person) {
    this._selected = person;
  }

  /** <rm-person> releyó el perfil: la lista lo refleja sin otra lectura. */
  _onProfileLoaded(e) {
    this._profiles = new Map(this._profiles).set(e.detail.personId, e.detail.profile);
  }

  render() {
    return html`
      <div class="layout">
        ${this._renderSide()}
        <section class="main">${this._renderDetail()}</section>
      </div>`;
  }

  _renderSide() {
    const gente = this.people ?? [];
    return html`
      <aside class="side">
        <h2>Ingeniería · ${gente.length}</h2>
        ${gente.length === 0 ? this._renderNobody() : this._renderList(gente)}
      </aside>`;
  }

  _renderNobody() {
    return html`<p class="empty">No hay nadie en tu ámbito.</p>`;
  }

  _renderList(gente) {
    // Las filas se arman fuera de la plantilla: anidar `html` dentro de `html`
    // se lee mal y lo marca el análisis estático.
    const filas = gente.map((p) => this._renderRow(p));
    return html`<ul>${filas}</ul>`;
  }

  _renderRow(p) {
    return html`<li>${this._renderPerson(p)}</li>`;
  }

  _renderPerson(p) {
    const meta = this._renderMeta(this._profiles.get(p.id));
    return html`
      <button class="person" aria-current=${this._selected?.id === p.id ? 'true' : 'false'}
        @click=${() => this._select(p)}>
        <span class="name">${p.name}</span>
        ${meta}
      </button>`;
  }

  /** Lo que la lista dice de cada persona: su rol dominante, o que le falta perfil. */
  _renderMeta(perfil) {
    if (!perfil?.dominantRole) return html`<span class="meta pending">sin perfil</span>`;
    const rol = this._roleLabel(perfil.dominantRole);
    return html`<span class="meta">${rol} · ${perfil.completion ?? 0} %</span>`;
  }

  _roleLabel(key) {
    return (this.roles ?? []).find((r) => r.key === key)?.label ?? key;
  }

  _renderDetail() {
    if (!this._selected) return html`<p class="pick">Elige a una persona de la lista para ver y gestionar su perfil.</p>`;
    return html`<rm-person .person=${this._selected} .items=${this.items} .roles=${this.roles}
      .dimensions=${this.dimensions} .orgConfig=${this.orgConfig}
      @profile-loaded=${this._onProfileLoaded}></rm-person>`;
  }
}

customElements.define('rm-admin', RmAdmin);
