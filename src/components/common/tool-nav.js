/**
 * <tool-nav> — barra superior reutilizable de una herramienta: enlace «← Volver»
 * + nombre (con icono opcional). Reemplaza el `<nav class="tool-nav">` duplicado
 * en cada layout de tool; se puede reusar en cualquier página.
 *
 * Atributos: href (destino de Volver, por defecto "/"), name, icon (emoji opcional).
 * Ej.: <tool-nav href="/" name="Marea" icon="🌊"></tool-nav>
 */
import { LitElement, html, css } from 'lit';

export class ToolNav extends LitElement {
  static properties = {
    href: { type: String },
    name: { type: String },
    icon: { type: String },
  };

  static styles = css`
    :host { display: block; }
    .bar {
      display: flex; align-items: center; gap: 1.25rem;
      margin-bottom: 1.25rem; padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--rm-border, #dde7ec);
    }
    .back { text-decoration: none; color: var(--rm-muted, #5b6b7d); font-weight: 600; font-size: 0.9rem; }
    .back:hover { color: var(--rm-accent, #2a9d8f); }
    .back:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
    .name { font-weight: 800; color: var(--rm-accent, #2a9d8f); }
  `;

  constructor() {
    super();
    this.href = '/';
    this.name = '';
    this.icon = '';
  }

  render() {
    const label = this.icon ? `${this.icon} ${this.name}` : this.name;
    return html`
      <nav class="bar" aria-label=${this.name || 'Herramienta'}>
        <a class="back" href=${this.href || '/'}>← Volver</a>
        ${this.name ? html`<span class="name">${label}</span>` : null}
      </nav>
    `;
  }
}

if (!customElements.get('tool-nav')) {
  customElements.define('tool-nav', ToolNav);
}
