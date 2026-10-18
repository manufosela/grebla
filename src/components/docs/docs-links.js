/**
 * <docs-links> — enlaces de Documentación (RMR-TSK-0778): Notion, la wiki de
 * TRIBBU y wikis abiertas, agrupados. Se abren en otra pestaña y sin darles
 * acceso a la nuestra (`noopener`). La gestión va aparte (RMR-TSK-0779).
 */
import { LitElement, html, css } from 'lit';
import { listDocLinks, addDocLink, updateDocLink, removeDocLink } from '../../lib/docLinks.js';
import { groupDocLinks, DOC_LINK_GROUPS } from '../../tools/docs/domain/docLinks.js';
import { skeletonLines } from '../app-skeleton.js';
import '../common/busy-overlay.js';

const EMPTY = { group: 'tribbu', title: '', url: '', description: '', order: 0 };

export class DocsLinks extends LitElement {
  static properties = {
    canManage: { type: Boolean },
    _links: { state: true },
    _loading: { state: true },
    _error: { state: true },
    /** Gestión (RMR-TSK-0780): el borrador, qué se edita y qué se va a quitar. */
    _draft: { state: true },
    _editingId: { state: true },
    _confirmId: { state: true },
    _busy: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .group { margin-bottom: 1.6rem; }
    .group h2 { margin: 0 0 0.6rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rm-muted, #5b6b7d); }
    .links { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 0.8rem; }
    .link { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.9rem 1rem; border-radius: 12px; text-decoration: none;
      border: 1px solid var(--rm-border, #d7dee2); background: var(--rm-surface, #fff); color: inherit; }
    .link:hover { border-color: var(--rm-accent, #2a9d8f); }
    .link:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .link strong { font-size: 0.95rem; color: var(--rm-text, #111827); }
    .link span { font-size: 0.84rem; color: var(--rm-muted, #5b6b7d); line-height: 1.45; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .card { display: flex; flex-direction: column; gap: 0.35rem; }
    .acts { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .acts.top { margin-bottom: 1rem; }
    .acts button { font: inherit; font-size: 0.8rem; font-weight: 600; border-radius: 8px; padding: 0.25rem 0.65rem; cursor: pointer;
      border: 1px solid var(--rm-border, #cbd5e1); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    .acts button.primary { border-color: var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .acts button.danger { border-color: var(--rm-danger, #b91c1c); color: var(--rm-danger, #b91c1c); }
    .acts button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .form { display: grid; gap: 0.6rem; max-width: 34rem; margin-bottom: 1.4rem; padding: 0.9rem 1rem; border-radius: 12px;
      border: 1px solid var(--rm-border, #d7dee2); background: var(--rm-surface, #fff); }
    .form label { display: grid; gap: 0.25rem; font-size: 0.84rem; font-weight: 600; color: var(--rm-text, #111827); }
    .form input, .form select { font: inherit; font-weight: 400; padding: 0.4rem 0.55rem; border-radius: 8px;
      border: 1px solid var(--rm-border, #cbd5e1); background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #111827); }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.canManage = false;
    this._links = [];
    this._loading = true;
    this._error = '';
    this._draft = null;
    this._editingId = null;
    this._confirmId = null;
    this._busy = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  async _load() {
    this._loading = true;
    try {
      this._links = await listDocLinks();
      this._error = '';
    } catch (err) {
      this._error = `No se han podido leer los enlaces: ${err.message}`;
    } finally {
      this._loading = false;
    }
  }

  render() {
    if (this._loading) return skeletonLines(4);
    const groups = groupDocLinks(this._links);
    const list = groups.length ? groups.map((g) => this._renderGroup(g)) : html`<p class="empty">Todavía no hay enlaces.</p>`;
    return html`
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      ${this.canManage ? this._renderManage() : null}
      ${list}
      ${this._busy ? html`<busy-overlay message="Guardando…"></busy-overlay>` : null}`;
  }

  _renderGroup(g) {
    return html`<section class="group" aria-label=${g.label}>
      <h2>${g.label}</h2>
      <div class="links">${g.links.map((l) => html`<div class="card">
        <a class="link" href=${l.url} target="_blank" rel="noopener noreferrer">
          <strong>${l.title} ↗</strong>${l.description ? html`<span>${l.description}</span>` : null}
        </a>
        ${this.canManage ? this._renderLinkActions(l) : null}
      </div>`)}</div>
    </section>`;
  }

  _renderLinkActions(l) {
    const confirming = this._confirmId === l.id;
    return html`<div class="acts">
      <button type="button" @click=${() => this._edit(l)}>Editar</button>
      ${confirming
        ? html`<button type="button" class="danger" @click=${() => this._remove(l.id)}>Confirmar</button>
          <button type="button" @click=${() => { this._confirmId = null; }}>Cancelar</button>`
        : html`<button type="button" @click=${() => { this._confirmId = l.id; }}>Quitar</button>`}
    </div>`;
  }

  /** Alta o edición, en el mismo formulario: lo que no se ve no se puede corregir. */
  _renderManage() {
    if (!this._draft) {
      return html`<div class="acts top"><button type="button" class="primary" @click=${() => { this._draft = { ...EMPTY }; }}>
        Añadir enlace</button></div>`;
    }
    const d = this._draft;
    const set = (k) => (e) => { this._draft = { ...this._draft, [k]: k === 'order' ? Number(e.target.value) : e.target.value }; };
    return html`<form class="form" @submit=${(e) => { e.preventDefault(); this._save(); }}>
      <label>Grupo <select @change=${set('group')}>
        ${DOC_LINK_GROUPS.map((g) => html`<option value=${g.id} ?selected=${g.id === d.group}>${g.label}</option>`)}
      </select></label>
      <label>Título <input maxlength="120" .value=${d.title} @input=${set('title')} /></label>
      <label>Dirección (https://…) <input type="url" .value=${d.url} @input=${set('url')} /></label>
      <label>Descripción <input maxlength="300" .value=${d.description} @input=${set('description')} /></label>
      <label>Orden <input type="number" .value=${String(d.order)} @input=${set('order')} /></label>
      <div class="acts">
        <button type="submit" class="primary">${this._editingId ? 'Guardar cambios' : 'Añadir'}</button>
        <button type="button" @click=${() => { this._draft = null; this._editingId = null; }}>Cancelar</button>
      </div>
    </form>`;
  }

  _edit(l) {
    this._editingId = l.id;
    this._draft = { group: l.group, title: l.title, url: l.url, description: l.description ?? '', order: l.order ?? 0 };
  }

  async _write(fn) {
    this._busy = true;
    this._error = '';
    try {
      await fn();
      this._draft = null;
      this._editingId = null;
      this._confirmId = null;
      await this._load();
    } catch (err) {
      this._error = err.message;
    } finally {
      this._busy = false;
    }
  }

  _save() {
    return this._write(() => (this._editingId ? updateDocLink(this._editingId, this._draft) : addDocLink(this._draft)));
  }

  _remove(id) {
    return this._write(() => removeDocLink(id));
  }
}

customElements.define('docs-links', DocsLinks);
