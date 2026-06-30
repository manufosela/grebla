/**
 * <career-map>
 * Visualización SVG de la isla: comarcas (áreas) etiquetadas, puerto de inicio,
 * ciudades como nodos posicionados (x,y) y rutas como líneas de prerequisito.
 * Color por estado (visitada / disponible / bloqueada / en desuso) y anillos para
 * la ciudad actual (coral) y las ciudades en ruta (navy). Emite `select-city`.
 *
 * Propiedades:
 *  - map: CareerMap  { areas, cities, startPort }
 *  - journey: { visitedCities:string[], currentCity:string|null, plannedRoute:string[] }
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
    .node.deprecated .dot { fill: var(--rm-danger, #dc2626); opacity: 0.5; }
    .node.deprecated .label { fill: var(--rm-muted, #9ca3af); text-decoration: line-through; }
    .node.sel .dot { stroke: var(--rm-navy, #1e3a5f); stroke-width: 1; }
    .ring { fill: none; stroke-width: 0.7; }
    .ring.current { stroke: var(--rm-coral-600, #e26d5e); }
    .ring.route { stroke: var(--rm-navy, #1e3a5f); stroke-dasharray: 1.5 1; }
    .area-label { font-size: 3.2px; font-weight: 700; fill: var(--rm-muted, #9ca3af); text-transform: uppercase; letter-spacing: 0.15px; pointer-events: none; }
    .port { fill: var(--rm-navy, #1e3a5f); }
    .port-label { font-size: 2.6px; fill: var(--rm-muted, #6b7280); pointer-events: none; }
  `;

  constructor() {
    super();
    this.map = null;
    this.journey = { visitedCities: [], currentCity: null, plannedRoute: [] };
    this.reachable = [];
    this.selected = null;
  }

  _state(cityId) {
    const city = (this.map?.cities ?? []).find((c) => c.id === cityId);
    if (city?.deprecated) return 'deprecated';
    if ((this.journey.visitedCities ?? []).includes(cityId)) return 'visited';
    if ((this.reachable ?? []).includes(cityId)) return 'reachable';
    return 'locked';
  }

  /** Centro aproximado de una comarca (media de las posiciones de sus ciudades). */
  _areaCenters() {
    const groups = Object.groupBy(this.map?.cities ?? [], (c) => c.area);
    return (this.map?.areas ?? []).map((area) => {
      const cities = groups[area.id] ?? [];
      const minY = Math.min(...cities.map((c) => c.y));
      const avgX = cities.reduce((s, c) => s + c.x, 0) / (cities.length || 1);
      return { id: area.id, name: area.name, x: avgX, y: Math.max(minY - 6, 4) };
    });
  }

  _select(id) {
    this.dispatchEvent(new CustomEvent('select-city', { detail: { cityId: id }, bubbles: true, composed: true }));
  }

  _renderSvg() {
    const map = this.map;
    if (!map) return null;
    const byId = new Map(map.cities.map((c) => [c.id, c]));
    const route = new Set(this.journey.plannedRoute ?? []);
    return svg`
      <svg viewBox="0 0 100 100" role="img" aria-label="Mapa de carrera (isla)">
        ${this._areaCenters().map(
          (a) => svg`<text class="area-label" x=${a.x} y=${a.y} text-anchor="middle">${a.name}</text>`,
        )}
        ${map.startPort
          ? svg`<g aria-label="Puerto de inicio">
              <circle class="port" cx=${map.startPort.x} cy=${map.startPort.y} r="1.8" />
              <text class="port-label" x=${map.startPort.x} y=${map.startPort.y + 4} text-anchor="middle">Puerto</text>
            </g>`
          : null}
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
              ${route.has(c.id) ? svg`<circle class="ring route" cx=${c.x} cy=${c.y} r="5.2" />` : null}
              ${this.journey.currentCity === c.id ? svg`<circle class="ring current" cx=${c.x} cy=${c.y} r="5.2" />` : null}
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
