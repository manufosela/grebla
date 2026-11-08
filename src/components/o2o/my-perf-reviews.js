/**
 * <my-perf-reviews> — las performance reviews de la propia persona, en solo
 * lectura (RMR-TSK-0544). Es la pestaña «Mi performance review» de Mi espacio;
 * las escribe su manager desde la ficha (<manager-notes>). Las notas de
 * contexto no llegan aquí: las reglas solo le dejan leer las de tipo perf-review.
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import { listOwnPerfReviews } from '../../lib/managerNotes.js';

export class MyPerfReviews extends LitElement {
  static properties = {
    personId: { attribute: 'person-id' },
    _reviews: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; margin: 0 0 0.8rem; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    details { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.55rem 0.85rem; }
    summary { cursor: pointer; font-weight: 600; }
    .meta { font-weight: 400; color: var(--rm-muted, #5b6b7d); font-size: 0.85rem; }
    .content { white-space: pre-wrap; margin: 0.6rem 0; font-size: 0.92rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
  `;

  constructor() {
    super();
    this.personId = '';
    this._reviews = [];
    this._loading = true;
    this._error = '';
  }

  updated(changed) {
    if (changed.has('personId') && this.personId) this._load(this.personId);
  }

  async _load(personId) {
    this._reviews = [];
    this._loading = true;
    this._error = '';
    try {
      const reviews = await listOwnPerfReviews(personId);
      if (personId === this.personId) this._reviews = reviews;
    } catch (err) {
      if (personId === this.personId) this._error = `No se pudieron cargar tus performance reviews: ${err.message}`;
    } finally {
      if (personId === this.personId) this._loading = false;
    }
  }

  render() {
    return html`
      <p class="lead">Las performance reviews que te ha hecho tu manager. Solo puedes leerlas: si quieres comentar algo, hazlo en tu próximo O2O.</p>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : this._renderList()}
    `;
  }

  _renderList() {
    if (this._loading) return skeletonLines(3);
    if (!this._reviews.length) return html`<p class="empty">Aún no tienes ninguna performance review.</p>`;
    return html`<ul class="list">${this._reviews.map((r, i) => html`<li><details ?open=${i === 0}>
      <summary>${r.title} <span class="meta">· ${r.date}</span></summary>
      <p class="content">${r.content}</p>
    </details></li>`)}</ul>`;
  }
}

if (!customElements.get('my-perf-reviews')) customElements.define('my-perf-reviews', MyPerfReviews);
