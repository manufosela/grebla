/**
 * <person-o2o-panel> — Ficha › O2O (RMR-TSK-0728): lo que la persona ve en Mi
 * espacio, para sus managers, en tres sub-pestañas.
 *  - Próximo: el O2O que viene, con los temas que ella tiene para pensar.
 *  - Hechos: tus O2O con ella enteros y, de los demás managers, solo lo compartido.
 *  - Acciones: sus compromisos, que se gestionan aquí mismo.
 * Lo compartido sale de getPersonO2O: nunca las notas de otro manager.
 *
 * Props: person, viewerUid, nameOf (uid → nombre visible).
 */
import { LitElement, html, css } from 'lit';
import './person-o2o.js';
import './o2o-actions.js';
import { skeletonLines } from '../app-skeleton.js';
import { getPersonO2O } from '../../lib/o2o.js';
import { createO2OContainer } from '../../tools/o2o/composition/container.js';

const TABS = [
  { id: 'proximo', label: 'Próximo' },
  { id: 'hechos', label: 'Hechos' },
  { id: 'acciones', label: 'Acciones' },
];

export class PersonO2OPanel extends LitElement {
  static properties = {
    person: { attribute: false },
    viewerUid: { attribute: false },
    nameOf: { attribute: false },
    _tab: { state: true },
    _data: { state: true },
    _persistence: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .tabs { display: flex; gap: 0.3rem; margin: 0 0 1rem; border-bottom: 1px solid var(--rm-border, #e5e7eb); }
    .tab { font: inherit; font-size: 0.86rem; font-weight: 600; padding: 0.35rem 0.75rem; cursor: pointer; border: 0;
      border-bottom: 3px solid transparent; background: none; color: var(--rm-muted, #4b5563); }
    .tab.active { color: var(--rm-accent-strong, #1d6f65); border-bottom-color: var(--rm-accent, #2a9d8f); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    h4 { margin: 0 0 0.4rem; color: var(--rm-text, #111827); }
    h5 { margin: 0.6rem 0 0.25rem; font-size: 0.88rem; color: var(--rm-text, #111827); }
    .card { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.7rem 0.9rem; margin: 0 0 0.7rem; }
    .meta { font-size: 0.8rem; font-weight: 600; color: var(--rm-muted, #4b5563); }
    p, li { font-size: 0.9rem; color: var(--rm-text, #111827); }
    .sub { margin: 1.2rem 0 0.5rem; font-weight: 700; color: var(--rm-text, #111827); }
    .empty { color: var(--rm-muted, #4b5563); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.88rem; }
    a { color: var(--rm-accent-strong, #1d6f65); }
  `;

  constructor() {
    super();
    this._tab = 'proximo';
    this._data = null;
    this._persistence = null;
    this._error = '';
  }

  willUpdate(changed) {
    if (changed.has('person')) Object.assign(this, { _data: null, _error: '' });
  }

  updated(changed) {
    if ((changed.has('person') || changed.has('viewerUid')) && this.person?.id) this._load();
  }

  async _load() {
    const req = (this._req = (this._req ?? 0) + 1);
    const personId = this.person.id;
    try {
      const [data, container] = await Promise.all([
        getPersonO2O(personId),
        createO2OContainer({ mode: 'firestore', leaderUid: this.viewerUid }),
      ]);
      if (req !== this._req) return;
      Object.assign(this, { _data: data, _persistence: container.persistence, _error: '' });
    } catch (err) {
      if (req !== this._req) return;
      Object.assign(this, { _data: { sessions: [], actions: [], upcoming: [] }, _error: `No se pudo cargar su O2O: ${err.message}` });
    }
  }

  render() {
    return html`
      <div class="tabs" role="tablist" aria-label="O2O">
        ${TABS.map((t) => html`<button class="tab ${t.id === this._tab ? 'active' : ''}" type="button" role="tab"
          aria-selected=${t.id === this._tab ? 'true' : 'false'} @click=${() => { this._tab = t.id; }}>${t.label}</button>`)}
      </div>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      <div role="tabpanel">${this._panel()}</div>`;
  }

  _panel() {
    const name = this.person?.name ?? 'esta persona';
    if (this._tab === 'hechos') return this._done(name);
    if (!this._data) return skeletonLines(3);
    if (this._tab === 'acciones') {
      return html`<o2o-actions .persistence=${this._persistence} .personId=${this.person.id}
        .people=${[{ id: this.person.id, name }]}></o2o-actions>`;
    }
    const upcoming = this._data.upcoming ?? [];
    if (!upcoming.length) {
      return html`<p class="empty">No hay ningún O2O preparado para ${name}. Se prepara en la <a href="/tools/o2o">herramienta O2O</a>.</p>`;
    }
    return upcoming.map((u) => this._upcoming(u));
  }

  _upcoming(u) {
    const by = u.leaderUid === this.viewerUid ? 'Lo preparas tú' : 'Lo prepara ' + this._who(u.leaderUid);
    return html`<div class="card">
      <h4>${u.name}</h4>
      <span class="meta">${by} ·
        ${this.person?.name ?? 'La persona'} ve estos temas para pensar antes</span>
      ${u.form.intro ? html`<p>${u.form.intro}</p>` : null}
      ${u.form.sections.map((s) => html`<h5>${s.title}</h5><ul>${s.questions.map((q) => html`<li>${q.text}</li>`)}</ul>`)}
    </div>`;
  }

  _done(name) {
    // getPersonO2O ya solo devuelve lo compartido (sharedSessions en el servidor):
    // aquí no llega nada más que filtrar. De otros managers, porque lo tuyo va entero arriba.
    const others = (this._data?.sessions ?? []).filter((s) => s.leaderUid !== this.viewerUid);
    return html`
      <person-o2o .personId=${this.person.id} .leaderUid=${this.viewerUid ?? null} .personName=${name}></person-o2o>
      ${others.length ? html`<p class="sub">De otros managers (solo lo compartido con ${name})</p>
        ${others.map((s) => html`<div class="card"><span class="meta">${s.date?.slice(0, 10) ?? 'Sin fecha'} · ${this._who(s.leaderUid)}</span>
          <p>${s.sharedSummary}</p></div>`)}` : null}`;
  }

  _who(uid) {
    return uid === this.viewerUid ? 'tú' : (this.nameOf?.(uid) ?? 'otro manager');
  }
}

if (!customElements.get('person-o2o-panel')) customElements.define('person-o2o-panel', PersonO2OPanel);
