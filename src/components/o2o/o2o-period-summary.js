/**
 * <o2o-period-summary> — Resumen de un PERIODO de O2O: cobertura (cuántas
 * personas del equipo tienen su O2O hecho), acciones abiertas/hechas del periodo
 * y la lista del equipo (hecho/pendiente) con drill-down a las sesiones de cada
 * persona. Solo lectura.
 *
 * Props: persistence, people, periodId.
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import { listAllSessions } from '../../tools/o2o/application/usecases/sessions.js';
import { listActions } from '../../tools/o2o/application/usecases/actions.js';
import { coverageOf } from '../../tools/o2o/application/usecases/periodStats.js';

export class O2OPeriodSummary extends LitElement {
  static properties = {
    persistence: { attribute: false },
    people: { attribute: false },
    periodId: { attribute: false },
    _sessions: { state: true },
    _actions: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _expanded: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin: 0 0 1.25rem; }
    .stat { background: var(--rm-chip, #eef2f7); border-radius: 10px; padding: 0.6rem 1rem; min-width: 8rem; }
    .stat .n { font-size: 1.4rem; font-weight: 800; color: var(--rm-navy, #1e3a5f); }
    .stat .l { font-size: 0.75rem; color: var(--rm-muted, #6b7280); }
    .bar { height: 8px; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; margin: 0.35rem 0 0; }
    .bar span { display: block; height: 100%; background: var(--rm-accent, #2a9d8f); }
    h3 { font-size: 0.95rem; margin: 1rem 0 0.5rem; color: var(--rm-navy, #1e3a5f); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    li.person { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.5rem 0.8rem; }
    .prow { display: flex; align-items: center; gap: 0.6rem; }
    .prow .name { flex: 1; font-size: 0.92rem; }
    .dot { font-size: 0.9rem; }
    .dot.done { color: var(--rm-accent, #2a9d8f); }
    .dot.pending { color: var(--rm-muted, #9ca3af); }
    .cnt { font-size: 0.78rem; color: var(--rm-muted, #6b7280); }
    .link { border: 0; background: none; color: var(--rm-accent, #2a9d8f); font-weight: 700; font-size: 0.8rem; cursor: pointer; }
    .drill { margin: 0.5rem 0 0; padding: 0.5rem 0 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .sess { font-size: 0.85rem; margin: 0 0 0.35rem; }
    .sess .date { font-weight: 700; }
    .tag { font-size: 0.7rem; border-radius: 999px; padding: 0.05rem 0.45rem; background: var(--rm-chip, #eef2f7); color: var(--rm-navy, #1e3a5f); }
    .body { font-size: 0.85rem; color: var(--rm-text, #111827); margin: 0.15rem 0 0; white-space: pre-wrap; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.people = [];
    this.periodId = null;
    this._sessions = [];
    this._actions = [];
    this._loading = false;
    this._error = '';
    this._expanded = null;
    this._loadedFor = null;
  }

  updated(changed) {
    if ((changed.has('persistence') || changed.has('periodId')) && this.persistence && this.periodId !== this._loadedFor) {
      this._loadedFor = this.periodId;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      const [sessions, actionsByPerson] = await Promise.all([
        listAllSessions(this.persistence, this.periodId),
        Promise.all((this.people ?? []).map((p) => listActions(this.persistence, p.id))),
      ]);
      this._sessions = sessions;
      this._actions = actionsByPerson.flat().filter((a) => a.periodId === this.periodId);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el resumen.';
    } finally {
      this._loading = false;
    }
  }

  render() {
    if (this._loading) return skeletonLines(4);
    if (this._error) return html`<p class="error">${this._error}</p>`;
    const cov = coverageOf(this._sessions, this.people);
    const openActions = this._actions.filter((a) => a.status !== 'done').length;
    const doneActions = this._actions.length - openActions;
    return html`
      <div class="stats">
        <div class="stat">
          <div class="n">${cov.done}/${cov.total}</div>
          <div class="l">del equipo con O2O (${cov.pct}%)</div>
          <div class="bar"><span style=${`width:${cov.pct}%`}></span></div>
        </div>
        <div class="stat"><div class="n">${openActions}</div><div class="l">acciones abiertas</div></div>
        <div class="stat"><div class="n">${doneActions}</div><div class="l">acciones hechas</div></div>
      </div>
      <h3>Equipo</h3>
      ${this.people.length
        ? html`<ul>${this.people.map((p) => this._renderPerson(p, cov.doneIds.has(p.id)))}</ul>`
        : html`<p class="empty">No hay personas en tu equipo.</p>`}
    `;
  }

  _renderPerson(person, done) {
    const sessions = this._sessions.filter((s) => s.personId === person.id);
    const expanded = this._expanded === person.id;
    const label = expanded ? 'Ocultar' : 'Ver';
    const toggle = sessions.length
      ? html`<button class="link" @click=${() => { this._expanded = expanded ? null : person.id; }}>${label}</button>`
      : null;
    return html`<li class="person">
      <div class="prow">
        <span class="dot ${done ? 'done' : 'pending'}">${done ? '✓' : '○'}</span>
        <span class="name">${person.name}</span>
        <span class="cnt">${sessions.length} O2O</span>
        ${toggle}
      </div>
      ${expanded ? html`<div class="drill">${sessions.map((s) => this._renderSession(s))}</div>` : null}
    </li>`;
  }

  _renderSession(s) {
    const shared = s.sharedWithPerson ? html`<span class="tag">Compartido</span>` : null;
    return html`<div class="sess">
      <span class="date">${s.date?.slice(0, 10)}</span> ${shared}
      ${s.summary ? html`<p class="body">${s.summary}</p>` : null}
    </div>`;
  }
}

if (!customElements.get('o2o-period-summary')) {
  customElements.define('o2o-period-summary', O2OPeriodSummary);
}
