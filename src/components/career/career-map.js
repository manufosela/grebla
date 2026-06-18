/**
 * <career-map>
 * Visualización SVG del mapa: ciudades como nodos posicionados (x,y), rutas como
 * líneas de prerequisito. Color por estado (visitada / disponible / bloqueada) y
 * anillos para la ciudad actual (coral) y el objetivo (navy). Emite `select-city`.
 *
 * Propiedades:
 *  - map: CareerMap
 *  - journey: { visited:string[], current:string|null, target:string|null }
 *  - reachable: string[]  ids alcanzables (siguiente paso)
 *  - selected: string|null
 */
import { LitElement, html, css, svg } from 'lit';

export class CareerMapView extends LitElement {
  static properties = {
    map: { attribute: false },
    journey: { attribute: false },
    reachable: { attribute: false },
    selected: { attribute: false },
  };

  static styles = css`
    :host { display: block; }
    .wrap { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb); border-radius: var(--rm-radius, 12px); padding: 0.5rem; }
    svg { width: 100%; height: auto; display: block; }
    .edge { stroke: var(--rm-border, #d1d5db); stroke-width: 0.5; }
    .dot { stroke: rgba(0,0,0,0.12); stroke-width: 0.4; cursor: pointer; transition: r 0.1s ease; }
    .node .label { font-size: 3px; fill: var(--rm-text, #111827); pointer-events: none; }
    .node.locked .dot { fill: var(--rm-track, #d7dee2); }
    .node.locked .label { fill: var(--rm-muted, #9ca3af); }
    .node.reachable .dot { fill: var(--rm-coral, #f2887a); }
    .node.visited .dot { fill: var(--rm-accent, #2a9d8f); }
    .node.sel .dot { stroke: var(--rm-navy, #1e3a5f); stroke-width: 1; }
    .ring { fill: none; stroke-width: 0.7; }
    .ring.current { stroke: var(--rm-coral-600, #e26d5e); }
    .ring.target { stroke: var(--rm-navy, #1e3a5f); stroke-dasharray: 1.5 1; }
  `;

  constructor() {
    super();
    this.map = null;
    this.journey = { visited: [], current: null, target: null };
    this.reachable = [];
    this.selected = null;
  }

  _state(cityId) {
    if ((this.journey.visited ?? []).includes(cityId)) return 'visited';
    if ((this.reachable ?? []).includes(cityId)) return 'reachable';
    return 'locked';
  }

  _select(id) {
    this.dispatchEvent(new CustomEvent('select-city', { detail: { cityId: id }, bubbles: true, composed: true }));
  }

  _renderSvg() {
    const map = this.map;
    if (!map) return null;
    const byId = new Map(map.cities.map((c) => [c.id, c]));
    return svg`
      <svg viewBox="0 0 100 100" role="img" aria-label="Mapa de carrera">
        ${map.cities.flatMap((c) =>
          (c.prereqs ?? []).map((p) => {
            const a = byId.get(p);
            return a ? svg`<line class="edge" x1=${a.x} y1=${a.y} x2=${c.x} y2=${c.y} />` : null;
          }),
        )}
        ${map.cities.map((c) => {
          const st = this._state(c.id);
          const sel = this.selected === c.id ? 'sel' : '';
          return svg`
            <g class="node ${st} ${sel}" @click=${() => this._select(c.id)} role="button" tabindex="0" aria-label=${c.name}>
              ${this.journey.target === c.id ? svg`<circle class="ring target" cx=${c.x} cy=${c.y} r="5.2" />` : null}
              ${this.journey.current === c.id ? svg`<circle class="ring current" cx=${c.x} cy=${c.y} r="5.2" />` : null}
              <circle class="dot" cx=${c.x} cy=${c.y} r="3.2" />
              <text class="label" x=${c.x} y=${c.y - 4.4} text-anchor="middle">${c.name}</text>
            </g>
          `;
        })}
      </svg>
    `;
  }

  render() {
    return html`<div class="wrap">${this._renderSvg()}</div>`;
  }
}

if (!customElements.get('career-map')) {
  customElements.define('career-map', CareerMapView);
}
