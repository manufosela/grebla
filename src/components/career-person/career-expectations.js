/**
 * <career-expectations>: lo que se espera para un nivel (por defecto el siguiente) y el
 * estado de cada marca (RMR-TSK-0679). Solo pinta; las acciones salen como eventos
 * `claim-request` (el ingeniero marca), `review-request` (le toca revisar en `slot`) y
 * `mark-request` (un revisor marca directamente, RMR-TSK-0705); las resuelve la página.
 */
import { LitElement, html, css } from 'lit';
import { getLevel } from '../../tools/career/data/framework.js';
import { nextLevelFor } from '../../tools/career/domain/subLevel.js';
import { expectationRows, STATUS_LABEL, rowActions } from '../../tools/career/domain/careerExpectations.js';
import { claimTimeline } from '../../tools/career/domain/evidence.js';
import { timelineTemplate, timelineStyles } from './career-timeline.js';

export class CareerExpectations extends LitElement {
  static properties = {
    person: { attribute: false },
    framework: { attribute: false },
    claims: { attribute: false },
    viewerUid: { attribute: false },
    /** Nivel que se pinta; sin él, el siguiente al de la persona. */
    levelId: { attribute: false },
  };

  static styles = [timelineStyles, css`
    :host { display: block; }
    h3 { margin: 0 0 0.3rem; font-size: 1rem; color: var(--rm-text, #111827); }
    .intro, .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; margin: 0 0 0.9rem; max-width: 62ch; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
    li { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 0.75rem 0.9rem; background: var(--rm-surface, #fff); }
    .head { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: space-between; }
    .dim { font-weight: 700; color: var(--rm-text, #111827); }
    .meta { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); font-weight: 400; }
    .chip { font-size: 0.78rem; font-weight: 700; border-radius: 999px; padding: 0.1rem 0.6rem; border: 1px solid; }
    .chip.open { color: var(--rm-muted, #4b5563); border-color: var(--rm-border, #cbd5e1); }
    .chip.pending { color: #1e3a5f; background: #e6eef8; border-color: #9fb6d6; }
    .chip.tie { color: #5c3d00; background: #fdf0d5; border-color: #d9a441; }
    .chip.accepted { color: #0b5d52; background: #dff3ef; border-color: #2a9d8f; }
    .chip.rejected { color: #8a1c1c; background: #fde8e8; border-color: #d96a6a; }
    details { margin: 0.45rem 0 0; font-size: 0.88rem; color: var(--rm-text, #111827); }
    summary { cursor: pointer; color: var(--rm-muted, #5b6b7d); }
    .actions { margin-top: 0.55rem; display: flex; gap: 0.5rem; }
    button { font: inherit; font-size: 0.85rem; font-weight: 600; border-radius: 8px; padding: 0.35rem 0.8rem; cursor: pointer;
      border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
  `];

  get _level() {
    if (this.levelId) return getLevel(this.framework, this.levelId);
    return nextLevelFor(this.framework?.levels ?? [], this.person?.levelId);
  }

  get _isSelf() {
    return !!this.viewerUid && this.person?.uid === this.viewerUid;
  }

  render() {
    const next = this._level;
    const current = getLevel(this.framework, this.person?.levelId);
    if (!current) return html`<p class="empty">Todavía no hay un nivel asignado.</p>`;
    if (!next) return html`<p class="empty">${current.code} es el último nivel de su itinerario.</p>`;
    const rows = expectationRows({
      framework: this.framework, levelId: next.id, claims: this.claims ?? [],
      reviewers: this.person?.careerReviewers ?? {}, viewerUid: this.viewerUid ?? null,
    });
    if (rows.length === 0) return html`<p class="empty">${next.code} todavía no tiene expectativas escritas.</p>`;
    return html`
      <h3>Hacia ${next.code} · ${next.title}</h3>
      <p class="intro">Cada expectativa se marca con evidencia, o la marca directamente quien revisa con su motivo.
        Cuenta cuando la aceptan quienes revisan (si son dos, los dos).</p>
      <ul>${rows.map((row) => this._row(row))}</ul>`;
  }

  _row(row) {
    return html`
      <li>
        <div class="head">
          <span class="dim">${row.dimension.name}
            <span class="meta">peso ${row.weight}${row.core ? ' · imprescindible' : ''}</span></span>
          <span class="chip ${row.status}">${STATUS_LABEL[row.status]}</span>
        </div>
        <details><summary>Qué se espera</summary><p>${row.text}</p></details>
        ${timelineTemplate(claimTimeline(row.claim))}
        ${this._actions(row)}
      </li>`;
  }

  _actions(row) {
    const { claim, review, markSlot } = rowActions(row, {
      isSelf: this._isSelf, viewerUid: this.viewerUid ?? null, reviewers: this.person?.careerReviewers ?? {},
    });
    if (!claim && !review && !markSlot) return null;
    return html`<div class="actions">
      ${claim ? html`<button type="button" @click=${() => this._emit('claim-request', row)}>${claim}</button>` : null}
      ${review ? html`<button type="button" @click=${() => this._emit('review-request', row)}>${review}</button>` : null}
      ${markSlot ? html`<button type="button" @click=${() => this._emit('mark-request', row, markSlot)}>Marcar</button>` : null}
    </div>`;
  }

  _emit(type, row, slot = row.slot) {
    this.dispatchEvent(new CustomEvent(type, {
      detail: { dimensionId: row.dimension.id, levelId: this._level?.id, claim: row.claim, slot, text: row.text },
      bubbles: true, composed: true,
    }));
  }
}

customElements.define('career-expectations', CareerExpectations);
