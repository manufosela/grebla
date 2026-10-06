/**
 * <retro-actions-tracker> — seguimiento de las acciones de mis retros
 * (RMR-TSK-0644): qué se acordó, quién es responsable, en qué retro y si está
 * hecha. Se filtra, se marca hecha quien puede (el dueño o su responsable) y se
 * descarga en CSV.
 *
 * Props: retros ([{id, name}]), uid.
 */
import { LitElement, html, css } from 'lit';
import { tableStyles } from '../common/table-styles.js';
import '../common/busy-overlay.js';
import { skeletonLines } from '../app-skeleton.js';
import { ownersText, canToggle, filterByStatus, actionsCsv } from '../../tools/retro/domain/actionView.js';
import { listActionsForRetros, setActionStatus } from '../../lib/retros.js';

const FILTERS = [['pending', 'Pendientes'], ['done', 'Hechas'], ['all', 'Todas']];

export class RetroActionsTracker extends LitElement {
  static properties = {
    retros: { attribute: false },
    uid: { attribute: false },
    _actions: { state: true },
    _filter: { state: true },
    _loading: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  static styles = [tableStyles, css`
    :host { display: block; }
    .bar { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin: 0 0 0.8rem; }
    .bar button { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 999px; padding: 0.3rem 0.8rem; font: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
    .bar button[aria-pressed='true'] { border-color: var(--rm-accent, #2a9d8f); color: var(--rm-accent-700, #1f7a6f); }
    .grow { flex: 1; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    .toggle { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-field, #eef2f6); color: var(--rm-text, #1e3a5f); border-radius: 999px; padding: 0.2rem 0.6rem; font: inherit; font-size: 0.75rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .toggle:disabled { opacity: 0.6; cursor: default; }
    .empty, .error { font-size: 0.88rem; color: var(--rm-muted, #5b6b7d); }
    .error { color: var(--rm-danger, #dc2626); }
  `];

  constructor() {
    super();
    this.retros = [];
    this.uid = null;
    this._actions = [];
    this._filter = 'pending';
    this._loading = false;
    this._busy = '';
    this._error = '';
  }

  updated(changed) {
    if (changed.has('retros')) this._load();
  }

  async _load() {
    const ids = (this.retros ?? []).map((r) => r.id);
    this._loading = true;
    this._error = '';
    try {
      this._actions = ids.length ? await listActionsForRetros(ids) : [];
    } catch (err) {
      this._error = `No se pudieron cargar las acciones: ${err.message}`;
    } finally {
      this._loading = false;
    }
  }

  async _toggle(action) {
    this._busy = 'Guardando…';
    try {
      await setActionStatus(action.id, action.status === 'done' ? 'pending' : 'done');
      await this._load();
    } catch (err) {
      this._error = err.message;
    } finally {
      this._busy = '';
    }
  }

  get _retroNames() { return new Map((this.retros ?? []).map((r) => [r.id, r.name ?? r.id])); }

  _download() {
    const blob = new Blob([`﻿${actionsCsv(filterByStatus(this._actions, this._filter), this._retroNames)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'acciones-retros.csv' });
    a.click();
    URL.revokeObjectURL(url);
  }

  render() {
    const list = filterByStatus(this._actions, this._filter);
    return html`
      ${this._busy ? html`<busy-overlay message=${this._busy}></busy-overlay>` : null}
      <div class="bar">
        ${FILTERS.map(([id, label]) => html`<button aria-pressed=${this._filter === id ? 'true' : 'false'} @click=${() => { this._filter = id; }}>${label}</button>`)}
        <span class="grow"></span>
        <button ?disabled=${!list.length} @click=${() => this._download()}>Descargar CSV</button>
      </div>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      ${this._renderTable(list)}`;
  }

  _renderTable(list) {
    if (this._loading) return skeletonLines(4);
    if (!list.length) return html`<p class="empty">No hay acciones en esta vista.</p>`;
    const names = this._retroNames;
    return html`<div class="table-wrap"><table>
      <thead><tr><th>Acción</th><th>Responsable</th><th>Retro</th><th>Estado</th></tr></thead>
      <tbody>${list.map((a) => html`<tr>
        <td>${a.text}</td><td>${ownersText(a)}</td><td>${names.get(a.fromRetroId) ?? '—'}</td>
        <td><button class="toggle" ?disabled=${!canToggle(a, this.uid, a.ownerLeaderUid)} @click=${() => this._toggle(a)}>
          ${a.status === 'done' ? '✓ Hecha' : '⏳ Pendiente'}</button></td>
      </tr>`)}</tbody>
    </table></div>`;
  }
}

if (!customElements.get('retro-actions-tracker')) customElements.define('retro-actions-tracker', RetroActionsTracker);
