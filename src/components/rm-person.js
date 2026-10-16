/**
 * <rm-person> — el Role Mirror de UNA persona, para quien la gestiona
 * (RMR-TSK-0733): su resumen, la propuesta que haya enviado, el cuestionario con
 * el que el manager fija la versión que cuenta y el histórico de mediciones.
 * Lo montan la administración de Role Mirror y la ficha de la persona: el mismo
 * componente, para que no digan cosas distintas.
 *
 * Emite `profile-loaded` con el perfil leído, para quien lleve una lista.
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

export class RmPerson extends LitElement {
  static properties = {
    person: { attribute: false },
    items: { attribute: false },
    roles: { attribute: false },
    dimensions: { attribute: false },
    orgConfig: { attribute: false },
    _tab: { state: true },
    _profile: { state: true },
    _sessions: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = [tableStyles, css`
    :host { display: block; }
    h2 { margin: 0 0 0.2rem; font-size: 1.05rem; color: var(--rm-text, #111827); }
    .tabs { display: inline-flex; gap: 0.25rem; padding: 0.28rem; margin: 1rem 0 1.1rem;
      background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; }
    .tab { background: none; border: 0; border-radius: 9px; padding: 0.45rem 1rem; font: inherit;
      font-weight: 600; font-size: 0.88rem; color: var(--rm-muted, #5b6b7d); cursor: pointer; }
    .tab:hover { color: var(--rm-accent, #2a9d8f); }
    .tab.on { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .pick, .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
  `];

  constructor() {
    super();
    this.person = null;
    this.items = [];
    this.roles = [];
    this.dimensions = [];
    this.orgConfig = null;
    this._tab = 'perfil';
    this._profile = null;
    this._sessions = [];
    this._loading = false;
    this._error = '';
  }

  updated(changed) {
    if (changed.has('person') && this.person?.id) this._load();
  }

  async _load() {
    const person = this.person;
    // Al cambiar de persona se vuelve a su perfil: quedarse en el histórico de
    // la anterior es empezar por el final.
    Object.assign(this, { _tab: 'perfil', _error: '', _loading: true });
    try {
      const [perfil, sesiones] = await Promise.all([
        getPersonProfile(person.id).catch(() => null),
        listSessions(person.id).catch(() => []),
      ]);
      if (person !== this.person) return;
      this._profile = perfil;
      // Las mediciones sin respuestas no cuentan: son sesiones abiertas y nunca rellenadas.
      this._sessions = sesiones.filter((s) => Object.keys(s.answers ?? {}).length > 0);
      this.dispatchEvent(new CustomEvent('profile-loaded', { detail: { personId: person.id, profile: perfil } }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el perfil.';
    } finally {
      if (person === this.person) this._loading = false;
    }
  }

  render() {
    if (this._loading) return skeletonLines(6);
    const p = this.person;
    const rotuloHistorico = `Histórico (${this._sessions.length})`;
    return html`
      <h2>${p?.name ?? ''}</h2>
      <p class="pick">${this._renderSummary(this._profile)}</p>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}

      <!-- La propuesta va ARRIBA y fuera de las pestañas: solo aparece cuando hay
           una esperando, y esconderla sería dejarla sin contestar. -->
      <rm-proposal-review .items=${this.items} .roles=${this.roles} .personId=${p?.id}></rm-proposal-review>

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

  _roleLabel(key) {
    return (this.roles ?? []).find((r) => r.key === key)?.label ?? key;
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
        .orgConfig=${this.orgConfig} .personId=${p?.id}
        editorKind="leader"></role-questionnaire>`;
  }

  _renderHistory() {
    if (this._sessions.length === 0) return html`<p class="empty">Sin mediciones todavía.</p>`;
    // Cinco columnas no caben en un hueco estrecho: la caja las hace alcanzables
    // en vez de dejar «Editado por» fuera de la pantalla.
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

if (!customElements.get('rm-person')) customElements.define('rm-person', RmPerson);
