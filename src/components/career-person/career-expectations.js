/**
 * <career-expectations>: lo que se espera para el nivel siguiente y el estado de cada marca
 * (RMR-TSK-0679). Solo pinta; las acciones salen como eventos `claim-request` (el
 * ingeniero marca) y `review-request` (le toca revisar en `slot`), y las resuelve la página.
 */
import { LitElement, html, css } from 'lit';
import { getLevel } from '../../tools/career/data/framework.js';
import { nextLevelFor } from '../../tools/career/domain/subLevel.js';
import { expectationRows, STATUS_LABEL } from '../../tools/career/domain/careerExpectations.js';

const DECISION = { accept: 'aceptó', reject: 'rechazó' };

/** Solo se enlaza lo que es http(s): la evidencia la escribe una persona. */
const isWebUrl = (url) => typeof url === 'string' && /^https?:\/\/\S+$/i.test(url);
const linkTpl = (l) => (isWebUrl(l.url)
  ? html` · <a href=${l.url} target="_blank" rel="noopener noreferrer">${String(l.kind).toUpperCase()}</a>`
  : null);
const reviewLine = (r) => {
  const why = r.reason ? `: ${r.reason}` : '';
  return `${r.by?.name ?? 'Alguien'} ${DECISION[r.decision] ?? ''}${why}`;
};
const SLOT_ACTION = { first: 'Revisar', second: 'Revisar', arbiter: 'Desempatar' };

export class CareerExpectations extends LitElement {
  static properties = {
    person: { attribute: false },
    framework: { attribute: false },
    claims: { attribute: false },
    viewerUid: { attribute: false },
  };

  static styles = css`
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
    .evidence { margin: 0.55rem 0 0; font-size: 0.86rem; color: var(--rm-text, #111827); }
    .evidence a { color: var(--rm-accent-strong, #1d6f65); }
    .reviews { margin: 0.4rem 0 0; padding: 0; list-style: none; display: grid; gap: 0.2rem; font-size: 0.82rem; }
    .reviews li { border: 0; padding: 0; background: none; color: var(--rm-muted, #4b5563); }
    .actions { margin-top: 0.55rem; display: flex; gap: 0.5rem; }
    button { font: inherit; font-size: 0.85rem; font-weight: 600; border-radius: 8px; padding: 0.35rem 0.8rem; cursor: pointer;
      border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
  `;

  get _next() {
    return nextLevelFor(this.framework?.levels ?? [], this.person?.levelId);
  }

  get _isSelf() {
    return !!this.viewerUid && this.person?.uid === this.viewerUid;
  }

  render() {
    const next = this._next;
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
      <p class="intro">Cada expectativa se marca con evidencia y cuenta cuando la acepta quien revisa (si son dos, las dos).</p>
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
        ${row.claim && row.status !== 'open' ? this._claim(row.claim) : null}
        ${this._actions(row)}
      </li>`;
  }

  _claim(claim) {
    const links = claim.evidence?.links ?? [];
    const reviews = ['first', 'second', 'arbiter'].map((s) => claim.reviews?.[s]).filter(Boolean);
    const items = reviews.map((r) => html`<li>${reviewLine(r)}</li>`);
    const list = reviews.length ? html`<ul class="reviews">${items}</ul>` : null;
    return html`
      <p class="evidence"><strong>Evidencia:</strong> ${claim.evidence?.text}
        ${links.map(linkTpl)}</p>
      ${list}`;
  }

  _actions(row) {
    const canClaim = this._isSelf && (row.status === 'open' || row.status === 'rejected');
    const label = row.status === 'rejected' ? 'Volver a marcar' : 'Marcar como cumplida';
    const review = row.slot && !row.claim?.reviews?.[row.slot];
    if (!canClaim && !review) return null;
    return html`<div class="actions">
      ${canClaim ? html`<button type="button" @click=${() => this._emit('claim-request', row)}>${label}</button>` : null}
      ${review ? html`<button type="button" @click=${() => this._emit('review-request', row)}>${SLOT_ACTION[row.slot]}</button>` : null}
    </div>`;
  }

  _emit(type, row) {
    this.dispatchEvent(new CustomEvent(type, {
      detail: { dimensionId: row.dimension.id, levelId: this._next?.id, claim: row.claim, slot: row.slot, text: row.text },
      bubbles: true, composed: true,
    }));
  }
}

customElements.define('career-expectations', CareerExpectations);
