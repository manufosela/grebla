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
import { skeletonLines } from './app-skeleton.js';
import './role-questionnaire.js';
import './rm-proposal-review.js';
import { getPersonProfile, listSessions } from '../lib/firestore.js';

/** Fecha corta y legible; sirve tanto para Timestamp de Firestore como para ISO. */
function fecha(valor) {
  const d = valor?.toDate?.() ?? (valor ? new Date(valor) : null);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Quién tocó por última vez esa medición: importa si fue el manager o la propia persona. */
function editor(updatedBy) {
  if (!updatedBy?.kind) return '—';
  const quien = updatedBy.kind === 'engineer' ? 'la propia persona' : 'el manager';
  return updatedBy.name ? `${quien} (${updatedBy.name})` : quien;
}

export class RmAdmin extends LitElement {
  static properties = {
    people: { attribute: false },
    items: { attribute: false },
    roles: { attribute: false },
    dimensions: { attribute: false },
    orgConfig: { attribute: false },
    _selected: { state: true },
    _tab: { state: true },
    _profiles: { state: true },
    _sessions: { state: true },
    _loading: { state: true },
    _error: { state: true },
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

    .main h2 { margin: 0 0 0.2rem; font-size: 1.05rem; color: var(--rm-text, #111827); }

    .tabs { display: inline-flex; gap: 0.25rem; padding: 0.28rem; margin: 1rem 0 1.1rem;
      background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; }
    .tab { background: none; border: 0; border-radius: 9px; padding: 0.45rem 1rem; font: inherit;
      font-weight: 600; font-size: 0.88rem; color: var(--rm-muted, #5b6b7d); cursor: pointer; }
    .tab:hover { color: var(--rm-accent, #2a9d8f); }
    .tab.on { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .pick { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    /* Dentro de la caja de la lista, el aviso necesita su propio aire: la caja no
       tiene relleno porque sus filas llegan de lado a lado. */
    .side .empty { padding: 0.9rem; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
  `];

  constructor() {
    super();
    this.people = [];
    this.items = [];
    this.roles = [];
    this.dimensions = [];
    this.orgConfig = null;
    this._selected = null;
    this._tab = 'perfil';
    /** @type {Map<string, {dominantRole?: string|null, completion?: number, updatedAt?: unknown}|null>} */
    this._profiles = new Map();
    this._sessions = [];
    this._loading = false;
    this._error = '';
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

  async _select(person) {
    this._selected = person;
    // Al cambiar de persona se vuelve a su perfil: quedarse en el histórico de
    // la anterior es empezar por el final.
    this._tab = 'perfil';
    this._error = '';
    this._loading = true;
    try {
      const [perfil, sesiones] = await Promise.all([
        getPersonProfile(person.id).catch(() => null),
        listSessions(person.id).catch(() => []),
      ]);
      this._profiles = new Map(this._profiles).set(person.id, perfil);
      // Las mediciones sin respuestas no cuentan: son sesiones abiertas y nunca rellenadas.
      this._sessions = sesiones.filter((s) => Object.keys(s.answers ?? {}).length > 0);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el perfil.';
    } finally {
      this._loading = false;
    }
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
    if (this._loading) return skeletonLines(6);
    const p = this._selected;
    const resumen = this._renderSummary(this._profiles.get(p.id));
    const rotuloHistorico = `Histórico (${this._sessions.length})`;
    return html`
      <h2>${p.name}</h2>
      <p class="pick">${resumen}</p>
      ${this._error ? this._renderError() : null}

      <!-- La propuesta va ARRIBA y fuera de las pestañas: solo aparece cuando hay
           una esperando, y esconderla sería dejarla sin contestar. -->
      <rm-proposal-review .items=${this.items} .roles=${this.roles} .personId=${p.id}></rm-proposal-review>

      <!-- Dos pestañas, no dos bloques apilados: el cuestionario es largo, y el
           histórico debajo quedaba a un scroll de distancia que nadie recorre. -->
      <div class="tabs" role="tablist" aria-label="Perfil de la persona">
        ${this._renderTab('perfil', 'Perfil que cuenta')}
        ${this._renderTab('historico', rotuloHistorico)}
      </div>
      ${this._tab === 'perfil' ? this._renderQuestionnaire(p) : this._renderHistory()}`;
  }

  /** Lo que ya se sabe de esa persona, en una línea; o que todavía no hay nada. */
  _renderSummary(perfil) {
    if (!perfil?.dominantRole) return html`Todavía sin perfil definido.`;
    const rol = this._roleLabel(perfil.dominantRole);
    return html`Rol dominante: <strong>${rol}</strong> · ${perfil.completion ?? 0} % completado ·
      última medición ${fecha(perfil.updatedAt)}`;
  }

  _renderError() {
    return html`<p class="error">${this._error}</p>`;
  }

  _renderTab(id, label) {
    return html`<button class="tab ${this._tab === id ? 'on' : ''}" type="button" role="tab"
      aria-selected=${this._tab === id ? 'true' : 'false'}
      @click=${() => { this._tab = id; }}>${label}</button>`;
  }

  _renderQuestionnaire(p) {
    return html`
      <role-questionnaire
        .items=${this.items} .roles=${this.roles} .dimensions=${this.dimensions}
        .orgConfig=${this.orgConfig} .personId=${p.id}
        editorKind="leader"></role-questionnaire>`;
  }

  _renderHistory() {
    if (this._sessions.length === 0) return html`<p class="empty">Sin mediciones todavía.</p>`;
    // Cinco columnas no caben en el hueco de la derecha: la caja las hace
    // alcanzables en vez de dejar «Editado por» fuera de la pantalla.
    const filas = this._sessions.map((s) => this._renderSession(s));
    return html`
      <div class="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Rol dominante</th><th>Completitud</th><th>Objetivo</th><th>Editado por</th></tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`;
  }

  _renderSession(s) {
    return html`
      <tr>
        <td>${fecha(s.updatedAt)}</td>
        <td>${s.dominantRole ? this._roleLabel(s.dominantRole) : '—'}</td>
        <td>${s.completion ?? 0} %</td>
        <td>${s.targetRole ? this._roleLabel(s.targetRole) : '—'}</td>
        <td>${editor(s.updatedBy)}</td>
      </tr>`;
  }
}

customElements.define('rm-admin', RmAdmin);
