/**
 * <motivators-card> — carta presentacional: ilustración original + nombre + botón
 * de info. Es operable por teclado (Enter/Espacio → «coger/soltar»). El arrastre lo
 * gestiona el tablero (escucha pointerdown que burbujea). Emite:
 *  - `card-pick` {id}  al activarla (click/Enter) — el tablero la selecciona/mueve.
 *  - `card-info` {id}  al pulsar el icono de info — abre el modal sin mover la carta.
 */
import { LitElement, html, css } from 'lit';
import { illustrationFor } from './illustrations.js';

export class MotivatorsCard extends LitElement {
  static properties = {
    card: { attribute: false },
    accent: { type: String },
    selected: { type: Boolean, reflect: true },
    dragging: { type: Boolean, reflect: true },
    position: { type: Number }, // nº de posición si está colocada (badge), o 0/undefined
  };

  static styles = css`
    :host { display: block; touch-action: none; }
    .card {
      position: relative; display: flex; align-items: center; gap: 0.6rem;
      background: var(--rm-surface, #fff); border: 2px solid var(--rm-border, #e5e7eb);
      border-radius: 12px; padding: 0.5rem 0.6rem; cursor: grab; user-select: none;
      transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s;
    }
    .card:hover { border-color: var(--accent); }
    .card:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
    :host([selected]) .card { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    :host([dragging]) .card { opacity: 0.35; }
    .ill {
      flex: 0 0 auto; width: 40px; height: 40px; border-radius: 10px;
      display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-ink);
    }
    .ill svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .name { flex: 1 1 auto; font-size: 0.9rem; font-weight: 700; color: var(--rm-text, #111827); line-height: 1.2; }
    .pos {
      position: absolute; top: -8px; left: -8px; width: 22px; height: 22px; border-radius: 50%;
      background: var(--accent); color: var(--accent-on); font-size: 0.75rem; font-weight: 800;
      display: grid; place-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .info {
      flex: 0 0 auto; width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d); font-weight: 800; font-size: 0.85rem;
      cursor: help; display: grid; place-items: center;
    }
    .info:hover { color: var(--accent); border-color: var(--accent); }
    .info:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  `;

  constructor() {
    super();
    this.card = null;
    this.accent = 'teal';
    this.selected = false;
    this.dragging = false;
    this.position = 0;
  }

  /** Paleta por acento del juego (colores fijos → contraste AA en claro y oscuro). */
  _accentVars() {
    const teal = { '--accent': '#2a9d8f', '--accent-ink': '#14544c', '--accent-soft': '#d7efec', '--accent-on': '#ffffff' };
    const coral = { '--accent': '#e26d5e', '--accent-ink': '#7a3227', '--accent-soft': '#fbe3df', '--accent-on': '#ffffff' };
    const p = this.accent === 'coral' ? coral : teal;
    return Object.entries(p).map(([k, v]) => `${k}:${v}`).join(';');
  }

  _pick(e) {
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('card-pick', { detail: { id: this.card?.id }, bubbles: true, composed: true }));
  }

  _info(e) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('card-info', { detail: { id: this.card?.id }, bubbles: true, composed: true }));
  }

  _onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') this._pick(e);
  }

  render() {
    if (!this.card) return null;
    return html`
      <div class="card" style=${this._accentVars()} role="button" tabindex="0"
           aria-pressed=${this.selected} aria-label=${`${this.card.name}. ${this.selected ? 'Seleccionada' : 'Pulsa para seleccionar'}`}
           @click=${this._pick} @keydown=${this._onKey}>
        ${this.position ? html`<span class="pos" aria-hidden="true">${this.position}</span>` : null}
        <span class="ill" aria-hidden="true"><svg viewBox="0 0 48 48">${illustrationFor(this.card.id)}</svg></span>
        <span class="name">${this.card.name}</span>
        <button class="info" type="button" aria-label=${`Qué significa ${this.card.name}`}
                @click=${this._info} @pointerdown=${(e) => e.stopPropagation()}>i</button>
      </div>
    `;
  }
}

if (!customElements.get('motivators-card')) {
  customElements.define('motivators-card', MotivatorsCard);
}
