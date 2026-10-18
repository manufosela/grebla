/**
 * <docs-links> — enlaces de Documentación (RMR-TSK-0778): Notion, la wiki de
 * TRIBBU y wikis abiertas, agrupados. Se abren en otra pestaña y sin darles
 * acceso a la nuestra (`noopener`). La gestión va aparte (RMR-TSK-0779).
 */
import { LitElement, html, css } from 'lit';
import { listDocLinks } from '../../lib/docLinks.js';
import { groupDocLinks } from '../../tools/docs/domain/docLinks.js';
import { skeletonLines } from '../app-skeleton.js';

export class DocsLinks extends LitElement {
  static properties = {
    canManage: { type: Boolean },
    _links: { state: true },
    _loading: { state: true },
    _error: { state: true },
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
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.canManage = false;
    this._links = [];
    this._loading = true;
    this._error = '';
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
    if (this._error) return html`<p class="error" role="alert">${this._error}</p>`;
    const groups = groupDocLinks(this._links);
    if (!groups.length) return html`<p class="empty">Todavía no hay enlaces.</p>`;
    return groups.map((g) => html`<section class="group" aria-label=${g.label}>
      <h2>${g.label}</h2>
      <div class="links">${g.links.map((l) => html`<a class="link" href=${l.url} target="_blank" rel="noopener noreferrer">
        <strong>${l.title} ↗</strong>${l.description ? html`<span>${l.description}</span>` : null}
      </a>`)}</div>
    </section>`);
  }
}

customElements.define('docs-links', DocsLinks);
