/**
 * <career-levels>: las expectativas de TODO el camino de la persona, una pestaña
 * por nivel (RMR-TSK-0706). Los inferiores se dan por superados; el actual lleva
 * el estado y el historial de cada expectativa (RMR-TSK-0712); los superiores
 * se ganan marcando, y eso lo pinta <career-expectations>, cuyos eventos suben tal
 * cual a la página.
 */
import { LitElement, html, css } from 'lit';
import './career-expectations.js';
import { levelPath, defaultLevelTab } from '../../tools/career/domain/levelPath.js';
import { expectationsForLevel, aspirationalLevels } from '../../tools/career/data/framework.js';
import { careerSuggestion } from '../../tools/career/data/assessment.js';
import { expectationState, timelineFor, entryKindsFor, visibilityNotice } from '../../tools/career/domain/evidence.js';
import { timelineTemplate, timelineStyles } from './career-timeline.js';

const STATE_NOTE = { below: 'superado', current: 'nivel actual' };
const STATE_LABEL = { meets: 'Llega', misses: 'No llega' };

export class CareerLevels extends LitElement {
  static properties = {
    person: { attribute: false },
    framework: { attribute: false },
    claims: { attribute: false },
    /** Historial de expectativas de la persona (RMR-TSK-0712). */
    entries: { attribute: false },
    viewerUid: { attribute: false },
    /** Quien mira lleva a la persona (su manager desde la ficha): pone el estado. */
    canAssess: { type: Boolean },
    _tab: { state: true },
  };

  static styles = [timelineStyles, css`
    :host { display: block; }
    .tabs { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0 0 0.9rem; border-bottom: 1px solid var(--rm-border, #e5e7eb); }
    .tab { font: inherit; font-size: 0.86rem; font-weight: 600; padding: 0.35rem 0.75rem; cursor: pointer; border: 0;
      border-bottom: 3px solid transparent; background: none; color: var(--rm-muted, #4b5563); }
    .tab.active { color: var(--rm-accent-strong, #1d6f65); border-bottom-color: var(--rm-accent, #2a9d8f); }
    .tab .here { font-weight: 400; font-size: 0.78rem; }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    h3 { margin: 0 0 0.6rem; font-size: 1rem; color: var(--rm-text, #111827); }
    .empty { color: var(--rm-muted, #4b5563); font-size: 0.88rem; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
    li { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 0.75rem 0.9rem; background: var(--rm-surface, #fff); }
    .head { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: space-between; }
    .dim { font-weight: 700; color: var(--rm-text, #111827); }
    .chip { font-size: 0.78rem; font-weight: 700; border-radius: 999px; padding: 0.1rem 0.6rem; border: 1px solid; }
    .chip.ok { color: #0b5d52; background: #dff3ef; border-color: #2a9d8f; }
    .chip.bad { color: #8a1c1c; background: #fde8e8; border-color: #d96a6a; }
    .chip.done { color: var(--rm-muted, #4b5563); border-color: var(--rm-border, #cbd5e1); }
    details { margin: 0.45rem 0 0; font-size: 0.88rem; color: var(--rm-text, #111827); }
    summary { cursor: pointer; color: var(--rm-muted, #4b5563); }
    .note { margin: 0.45rem 0 0; font-size: 0.86rem; color: var(--rm-text, #111827); }
    h3 + .note { margin: 0 0 0.8rem; }
    .actions { margin-top: 0.55rem; }
    .actions button { font: inherit; font-size: 0.85rem; font-weight: 600; border-radius: 8px; padding: 0.35rem 0.8rem;
      cursor: pointer; border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .actions button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .visibility { margin: 0 0 0.9rem; padding: 0.55rem 0.8rem; border-radius: 10px; font-size: 0.86rem;
      border: 1px solid #b45309; background: #fef3c7; color: #5c2d06; }
    .visibility button { font: inherit; font-weight: 700; padding: 0; border: 0; background: none; cursor: pointer;
      color: #5c2d06; text-decoration: underline; }
    .visibility button:focus-visible { outline: 2px solid #b45309; outline-offset: 2px; }
  `];

  willUpdate(changed) {
    if (!changed.has('person') && !changed.has('framework')) return;
    const steps = this._steps;
    // Al cambiar de persona, la pestaña vuelve a su nivel siguiente.
    if (changed.has('person') || !steps.some((s) => s.level.id === this._tab)) this._tab = defaultLevelTab(steps);
  }

  get _steps() {
    return levelPath(this.framework, this.person?.levelId);
  }

  render() {
    const steps = this._steps;
    if (steps.length === 0) return html`<p class="empty">Todavía no hay un nivel asignado.</p>`;
    const step = steps.find((s) => s.level.id === this._tab) ?? steps[0];
    return html`${this._visibility()}
      <div class="tabs" role="tablist" aria-label="Niveles del camino" @keydown=${(e) => this._keydown(e, steps)}>
        ${steps.map((s) => this._tabButton(s, s === step))}
      </div>
      <div id="lvlpanel-${step.level.id}" role="tabpanel" aria-labelledby="lvl-${step.level.id}" tabindex="0">
        ${this._panel(step)}
      </div>`;
  }

  /** Quién ve el historial, siempre a la vista (RMR-TSK-0723): nada de sustos al escribir. */
  _notice() {
    const isSelf = !!this.viewerUid && this.viewerUid === this.person?.uid;
    return visibilityNotice({ isSelf, leads: !!this.canAssess, personName: this.person?.name });
  }

  _visibility() {
    const notice = this._notice();
    return html`<p class="visibility" role="note">👁 ${notice.text} ${notice.privateNotes ? this._privateHint() : null}</p>`;
  }

  /** Lo delicado va a las notas privadas del manager, que la persona no lee. */
  _privateHint() {
    const toPrivate = () => this.dispatchEvent(new CustomEvent('private-notes-request', { bubbles: true, composed: true }));
    return html`Lo personal o delicado no va aquí: <button type="button" @click=${toPrivate}>anótalo
      en Performance Review</button>, que es privado.`;
  }

  _tabButton(s, selected) {
    const here = s.state === 'current' ? html` <span class="here">· actual</span>` : null;
    return html`<button id="lvl-${s.level.id}" class="tab ${selected ? 'active' : ''}" type="button" role="tab"
      aria-selected=${selected ? 'true' : 'false'} aria-controls="lvlpanel-${s.level.id}" tabindex=${selected ? '0' : '-1'}
      @click=${() => { this._tab = s.level.id; }}>${s.level.code}${here}</button>`;
  }

  _keydown(e, steps) {
    const ids = steps.map((s) => s.level.id);
    const i = ids.indexOf(this._tab);
    const moves = { ArrowLeft: (i - 1 + ids.length) % ids.length, ArrowRight: (i + 1) % ids.length, Home: 0, End: ids.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    this._tab = ids[moves[e.key]];
    this.updateComplete.then(() => this.renderRoot.querySelector(`#lvl-${this._tab}`)?.focus());
  }

  _panel({ level, state }) {
    if (state === 'above') {
      return html`<career-expectations .person=${this.person} .framework=${this.framework} .claims=${this.claims ?? []}
        .viewerUid=${this.viewerUid} .levelId=${level.id}></career-expectations>`;
    }
    const title = html`<h3>${level.code} · ${level.title} <span class="here">(${STATE_NOTE[state]})</span></h3>`;
    if (state === 'below') {
      const rows = expectationsForLevel(this.framework, level.id).filter((r) => r.text);
      return html`${title}<ul>${rows.map((r) => this._row(r.dimension.name, r.text, html`<span class="chip done">Superado</span>`))}</ul>`;
    }
    // Nivel actual (RMR-TSK-0712): cada expectativa con su estado y su historial.
    const isSelf = !!this.viewerUid && this.viewerUid === this.person?.uid;
    const kinds = entryKindsFor({ isSelf, leads: !!this.canAssess });
    const entries = this.entries ?? [];
    const rows = expectationsForLevel(this.framework, level.id).filter((r) => r.text)
      .map((r) => ({ ...r, state: expectationState(entries, level.id, r.dimension.id, 'meets') }));
    return html`${title}${kinds.length > 1 ? this._suggestion(rows, level.id) : null}
      <ul>${rows.map((r) => this._row(r.dimension.name, r.text,
        html`<span class="chip ${r.state === 'meets' ? 'ok' : 'bad'}">${STATE_LABEL[r.state]}</span>`,
        html`${timelineTemplate(timelineFor(entries, level.id, r.dimension.id))}
          ${kinds.length ? html`<div class="actions"><button type="button"
            @click=${() => this._requestEntry(level.id, r, kinds)}>Añadir</button></div>` : null}`))}</ul>`;
  }

  /** La sugerencia de rol que sale de los «no llega» (antes, en «Nivel»). */
  _suggestion(rows, levelId) {
    const reds = rows.filter((r) => r.state === 'misses').length;
    const aspirationalCodes = aspirationalLevels(this.framework, levelId).map((l) => l.code);
    const text = careerSuggestion({ reds, total: rows.length, aspirationalCodes });
    return text ? html`<p class="note">${text}</p>` : null;
  }

  _requestEntry(levelId, row, kinds) {
    this.dispatchEvent(new CustomEvent('evidence-request', {
      detail: { mode: 'entry', kinds, levelId, dimensionId: row.dimension.id, text: row.text, notice: this._notice().text },
      bubbles: true, composed: true,
    }));
  }

  _row(name, text, chip, extra = null) {
    return html`<li>
      <div class="head"><span class="dim">${name}</span>${chip}</div>
      <details><summary>Qué se espera</summary><p>${text}</p></details>
      ${extra}
    </li>`;
  }
}

customElements.define('career-levels', CareerLevels);
