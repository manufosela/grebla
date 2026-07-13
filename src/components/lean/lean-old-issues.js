/**
 * <lean-old-issues> — pestaña «Atascos» de LEAN: por equipo/gremio, las issues en
 * curso MÁS ANTIGUAS (metrics.oldestWip) con enlace a Linear, para ir a
 * desatascarlas. Va en su propia pestaña (no bajo las métricas) para no alargar
 * esa vista. Reutiliza el summary de LEAN; puede recalcular desde aquí mismo.
 */
import { html, css } from 'lit';
import { recalcBarStyles } from './recalc-bar.js';
import { LeanView } from './lean-view.js';

export class LeanOldIssues extends LeanView {
  static styles = [recalcBarStyles, css`
    :host { display: block; }
    h3 { font-size: 1.05rem; margin: 1.25rem 0 0.5rem; color: var(--rm-navy, #1e3a5f); }
    h3:first-of-type { margin-top: 0; }
    .unit { margin: 0 0 0.9rem; }
    .unit-name { font-weight: 700; font-size: 0.9rem; color: var(--rm-text, #1a1a1a); }
    ul { list-style: none; margin: 0.3rem 0 0; padding: 0; display: grid; gap: 0.3rem; }
    li { font-size: 0.85rem; line-height: 1.35; }
    .link { color: var(--rm-text, #1a1a1a); text-decoration: none; display: inline-flex; gap: 0.4rem; align-items: baseline; flex-wrap: wrap; }
    .link:hover .id, .link:hover .title { text-decoration: underline; }
    .link:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
    .id { font-weight: 700; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; }
    .title { color: var(--rm-text, #1a1a1a); }
    .days { font-weight: 700; color: var(--rm-coral-600, #e26d5e); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .empty { color: var(--rm-muted, #6b7280); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .note { font-size: 0.78rem; color: var(--rm-muted, #6b7280); margin: 0.75rem 0 0; }
  `];

  get _loadError() {
    return 'No se pudieron cargar las issues.';
  }

  _issueLink(i) {
    const body = html`<span class="id">${i.identifier}</span> <span class="title">${i.title}</span> <span class="days">${i.agingDays} d</span>`;
    return i.url
      ? html`<a class="link" href=${i.url} target="_blank" rel="noopener noreferrer">${body}</a>`
      : html`<span class="link">${body}</span>`;
  }

  _renderLi(i) {
    return html`<li>${this._issueLink(i)}</li>`;
  }

  _renderUnit(u) {
    return html`<div class="unit">
      <span class="unit-name">${u.name}</span>
      <ul>${(u.metrics.oldestWip ?? []).map((i) => this._renderLi(i))}</ul>
    </div>`;
  }

  _renderSection(title, units) {
    const withWip = (units ?? []).filter((u) => (u.metrics?.oldestWip ?? []).length > 0);
    if (withWip.length === 0) return null;
    return html`<h3>${title}</h3>${withWip.map((u) => this._renderUnit(u))}`;
  }

  /** Estado vacío: sin WIP que mostrar, con la pista de recalcular si se puede. */
  _renderEmpty() {
    const hint = this.refresh
      ? html`Pulsa <strong>«↻ Recalcular desde Linear»</strong> para traer los datos.`
      : null;
    return html`<p class="empty">No hay issues en curso que mostrar. ${hint}</p>`;
  }

  render() {
    if (this._loading && !this._summary) return html`<p class="empty">Cargando…</p>`;
    const squads = this._summary?.squads?.units ?? [];
    const chapters = this._summary?.chapters?.units ?? [];
    const hasAny = squads.some((u) => (u.metrics?.oldestWip ?? []).length)
      || chapters.some((u) => (u.metrics?.oldestWip ?? []).length);
    return html`
      ${this._renderBar()}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${hasAny ? this._renderReport(squads, chapters) : this._renderEmpty()}
    `;
  }

  _renderReport(squads, chapters) {
    return html`
      ${this._renderSection('Equipos', squads)}
      ${this._renderSection('Gremios', chapters)}
      <p class="note">Las 3 issues en curso más antiguas de cada unidad, para ir a desatascarlas. Métrica de equipo, nunca individual.</p>`;
  }
}

if (!customElements.get('lean-old-issues')) {
  customElements.define('lean-old-issues', LeanOldIssues);
}
