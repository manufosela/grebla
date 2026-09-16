/**
 * <markdown-view> — pinta Markdown con nodos propios (RMR-TSK-0527). Recibe el
 * texto, lo pasa por el parser puro y construye el DOM con plantillas de Lit:
 * ni innerHTML ni HTML de terceros. Los enlaces abren aparte y sin opener.
 *
 * Props: text (string).
 */
import { LitElement, html, css } from 'lit';
import { parseMarkdown } from '../lib/markdown.js';

export class MarkdownView extends LitElement {
  static properties = { text: { type: String } };

  static styles = css`
    :host { display: block; font-size: 0.9rem; line-height: 1.5; color: var(--rm-text, #1e3a5f); overflow-wrap: anywhere; }
    h1, h2, h3, h4, h5, h6 { margin: 0.8em 0 0.3em; line-height: 1.25; color: var(--rm-text, #1e3a5f); }
    h1 { font-size: 1.25em; } h2 { font-size: 1.15em; } h3 { font-size: 1.05em; } h4, h5, h6 { font-size: 1em; }
    p { margin: 0 0 0.6em; }
    ul, ol { margin: 0 0 0.6em; padding-left: 1.4em; }
    li { margin: 0.15em 0; }
    li.task { list-style: none; margin-left: -1.2em; }
    li.task input { margin-right: 0.4em; vertical-align: middle; }
    blockquote { margin: 0 0 0.6em; padding: 0.2em 0.8em; border-left: 3px solid var(--rm-border, #dde7ec); color: var(--rm-muted, #5b6b7d); }
    pre { margin: 0 0 0.6em; padding: 0.6em 0.8em; border-radius: 8px; background: var(--rm-surface-hover, #eef3f5); overflow: auto; font-size: 0.85em; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; background: var(--rm-surface-hover, #eef3f5); padding: 0.05em 0.3em; border-radius: 4px; }
    pre code { background: none; padding: 0; }
    a { color: var(--rm-accent-700, var(--rm-accent, #2a9d8f)); }
    :host > :last-child { margin-bottom: 0; }
  `;

  constructor() {
    super();
    this.text = '';
  }

  _inlines(list) {
    return list.map((n) => {
      switch (n.t) {
        case 'br': return html`<br />`;
        case 'b': return html`<strong>${this._inlines(n.c)}</strong>`;
        case 'i': return html`<em>${this._inlines(n.c)}</em>`;
        case 's': return html`<s>${this._inlines(n.c)}</s>`;
        case 'code': return html`<code>${n.v}</code>`;
        case 'a': return html`<a href=${n.href} target="_blank" rel="noopener noreferrer">${this._inlines(n.c)}</a>`;
        default: return n.v;
      }
    });
  }

  _item(item) {
    if (item.checked === null) return html`<li>${this._inlines(item.c)}</li>`;
    return html`<li class="task"><input type="checkbox" disabled .checked=${item.checked} aria-hidden="true" />${this._inlines(item.c)}</li>`;
  }

  _block(b) {
    switch (b.type) {
      case 'h': return this._heading(b);
      case 'quote': return html`<blockquote>${this._inlines(b.c)}</blockquote>`;
      case 'code': return html`<pre><code>${b.text}</code></pre>`;
      case 'ul': return html`<ul>${b.items.map((it) => this._item(it))}</ul>`;
      case 'ol': return html`<ol>${b.items.map((it) => this._item(it))}</ol>`;
      default: return html`<p>${this._inlines(b.c)}</p>`;
    }
  }

  _heading(b) {
    const c = this._inlines(b.c);
    switch (b.level) {
      case 1: return html`<h1>${c}</h1>`;
      case 2: return html`<h2>${c}</h2>`;
      case 3: return html`<h3>${c}</h3>`;
      case 4: return html`<h4>${c}</h4>`;
      case 5: return html`<h5>${c}</h5>`;
      default: return html`<h6>${c}</h6>`;
    }
  }

  render() {
    return parseMarkdown(this.text).map((b) => this._block(b));
  }
}

if (!customElements.get('markdown-view')) {
  customElements.define('markdown-view', MarkdownView);
}
