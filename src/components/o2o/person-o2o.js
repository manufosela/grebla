/**
 * <person-o2o> — los O2O hechos de una persona, en su ficha (RMR-TSK-0649). Son
 * los MISMOS datos que la herramienta O2O (/leaders/{manager}/o2o): lo que se
 * registra allí aparece aquí, sin copias que sincronizar. Cada O2O separa lo que
 * es solo del manager de lo que ve la persona.
 *
 * Props: personId, leaderUid (su manager, dueño de los O2O), personName.
 */
import { LitElement, html, css } from 'lit';
import './o2o-session-view.js';
import { skeletonLines } from '../app-skeleton.js';
import { createO2OContainer } from '../../tools/o2o/composition/container.js';
import { listSessions } from '../../tools/o2o/application/usecases/sessions.js';

const SHARED_TAG = html`<span class="tag">Compartido</span>`;

export class PersonO2O extends LitElement {
  static properties = {
    personId: { attribute: false },
    leaderUid: { attribute: false },
    personName: { attribute: false },
    _sessions: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .bar { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin: 0 0 0.8rem; }
    .lead { margin: 0; color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; }
    .new { font-weight: 700; color: var(--rm-accent-700, #1f7a6f); text-decoration: none; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; padding: 0.4rem 0.8rem; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    details { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.55rem 0.85rem; }
    summary { cursor: pointer; font-weight: 600; }
    .tag { font-size: 0.72rem; font-weight: 700; padding: 0.05rem 0.45rem; border-radius: 999px; margin-left: 0.4rem; background: var(--rm-surface-hover, #eef3f5); color: var(--rm-accent-700, #1f7a6f); }
    .empty, .error { font-size: 0.88rem; color: var(--rm-muted, #5b6b7d); }
    .error { color: var(--rm-danger, #dc2626); }
  `;

  constructor() {
    super();
    this.personId = null;
    this.leaderUid = null;
    this.personName = '';
    this._sessions = [];
    this._loading = true;
    this._error = '';
  }

  willUpdate(changed) {
    if (changed.has('personId') || changed.has('leaderUid')) { this._sessions = []; this._error = ''; this._loading = true; }
  }

  updated(changed) {
    if ((changed.has('personId') || changed.has('leaderUid')) && this.personId) this._load();
  }

  async _load() {
    // Solo pinta la ÚLTIMA petición: si cambia la persona o su manager a medias, la anterior se descarta.
    const req = (this._req = (this._req ?? 0) + 1);
    const { personId, leaderUid } = this;
    this._loading = true;
    this._error = '';
    let sessions = [];
    let error = '';
    try {
      if (leaderUid) sessions = await listSessions((await createO2OContainer({ mode: 'firestore', leaderUid })).persistence, personId);
      else error = 'Esta persona no tiene manager: no hay O2O suyos.';
    } catch (err) {
      error = err?.code === 'permission-denied' ? 'Los O2O son de dos: solo los ve su manager.' : `No se pudieron cargar los O2O: ${err.message}`;
    }
    if (req !== this._req) return;
    this._sessions = sessions;
    this._error = error;
    this._loading = false;
  }

  render() {
    return html`
      <div class="bar">
        <p class="lead">Los O2O registrados con ${this.personName || 'esta persona'}, los mismos que en la herramienta O2O.</p>
        <a class="new" href="/tools/o2o">Registrar un O2O</a>
      </div>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      ${this._renderList()}`;
  }

  _renderList() {
    if (this._loading) return skeletonLines(3);
    if (!this._sessions.length) return this._error ? null : html`<p class="empty">Aún no hay O2O registrados.</p>`;
    return html`<ul class="list">${this._sessions.map((s, i) => this._renderSession(s, i === 0))}</ul>`;
  }

  /** Un O2O; el más reciente, abierto. */
  _renderSession(s, open) {
    const tag = s.sharedWithPerson ? SHARED_TAG : null;
    return html`<li><details ?open=${open}>
      <summary>${s.date?.slice(0, 10) ?? 'Sin fecha'}${tag}</summary>
      <o2o-session-view .session=${s} .personName=${this.personName}></o2o-session-view>
    </details></li>`;
  }
}

if (!customElements.get('person-o2o')) customElements.define('person-o2o', PersonO2O);
