/**
 * <career-map> — el PLANO del archipiélago (JG-11): una carta náutica limpia
 * con un CÍRCULO grande por isla y un círculo pequeño por TEMA (casa) dentro
 * del suyo. Sin aristas de prerequisitos: el «grafo» solo lo dibujan las
 * RUTAS — la del reto activo (badges numerados navy/coral/teal, los mismos
 * colores que en la isla 3D) o la ruta libre (ámbar a guiones con tinta
 * navy). Con reto activo la ruta libre NO se pinta: los números del reto
 * mandan (misma regla que en 3D, JG-5/JG-9). Las rutas cruzan islas y, si el
 * mapa de una isla aún no está cargado, su tramo cae al CENTRO del círculo y
 * se refina cuando el mapa llega (routePolyline).
 *
 * Interacción: clic en un tema emite `select-city` ({cityId}, bubbles +
 * composed — el contrato de siempre); clic en el círculo de una isla la
 * EXPANDE (zoom animado por transform; los temas ganan etiqueta visible);
 * Escape o el botón «Archipiélago» vuelven. Islas y temas son focusables
 * (Enter/Espacio activan) y llevan aria-label con su estado.
 *
 * Propiedades:
 *  - archipelago: { islands: IslandRef[] } índice del archipiélago.
 *  - islandMaps: Map<string, CareerMap> mapas por isla YA cargados. Render
 *    PARCIAL: una isla sin mapa se pinta con su contador «n temas».
 *  - journey: Journey global (visitedCities, currentCity, plannedRoute, challenge).
 *  - selected: string|null cityId seleccionado.
 *  - map: CareerMap — modo de UNA isla (compat: mi-espacio pasa solo la suya);
 *    sin archipiélago se sintetiza un plano de un único círculo ya expandido.
 */
import { LitElement, html, css, svg, nothing } from 'lit';
import { cityStatus } from '../../tools/career/domain/progress.js';
import { stopNumberByCity } from '../../tools/career/domain/challenge.js';
import { routeNumberByCity } from '../../tools/career/domain/route.js';
import {
  islandCircles,
  themeSpots,
  routePolyline,
  prefixIslandIndex,
  islandZoom,
} from '../../tools/career/domain/planoLayout.js';

/** Radio (viewBox) del círculo de isla en modo de UNA isla (mi-espacio). */
const SINGLE_ISLAND_R = 44;
/** Texto de estado para los aria-label / tooltips de los temas. */
const STATUS_LABELS = Object.freeze({
  visited: 'certificada',
  available: 'disponible',
  blocked: 'bloqueada',
  deprecated: 'en desuso',
});

export class CareerMapView extends LitElement {
  static properties = {
    archipelago: { attribute: false },
    islandMaps: { attribute: false },
    map: { attribute: false },
    journey: { attribute: false },
    selected: { attribute: false },
    expanded: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .wrap {
      background: var(--rm-track, #e9f0f2);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 0.5rem;
      overflow: hidden;
    }
    svg { width: 100%; height: auto; display: block; }
    .world { transition: transform 0.45s ease; }
    @media (prefers-reduced-motion: reduce) {
      .world { transition: none; }
    }

    .zoombar { display: flex; align-items: baseline; gap: 0.6rem; margin: 0 0 0.4rem; }
    .zoombar button {
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      border-radius: 999px;
      padding: 0.2rem 0.7rem;
      font: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .zoombar button:hover { border-color: var(--rm-accent, #2a9d8f); }
    .zoombar strong { color: var(--rm-text, #111827); font-size: 0.9rem; }
    .zoombar .esc { color: var(--rm-muted, #9ca3af); font-size: 0.75rem; }

    .island .land {
      fill: var(--rm-surface, #fff);
      stroke: var(--rm-border, #d1d5db);
      stroke-width: 0.4;
    }
    .island.expandable .land { cursor: pointer; }
    .island.expandable:hover .land,
    .island.expandable:focus-visible .land { stroke: var(--rm-accent, #2a9d8f); stroke-width: 0.7; }
    .island:focus-visible { outline: none; }
    .iname {
      font-size: 3px;
      font-weight: 700;
      fill: var(--rm-muted, #6b7280);
      pointer-events: none;
    }
    .count { font-size: 2.4px; fill: var(--rm-muted, #9ca3af); pointer-events: none; }

    .node .dot { stroke: var(--rm-dot-border, rgba(0, 0, 0, 0.15)); stroke-width: 0.15; cursor: pointer; }
    .node:focus-visible { outline: none; }
    .node:focus-visible .dot { stroke: var(--rm-navy, #1e3a5f); stroke-width: 0.45; }
    .node.blocked .dot { fill: var(--rm-track, #d7dee2); stroke: var(--rm-border, #c9d6dd); stroke-width: 0.25; }
    .node.available .dot { fill: var(--rm-coral, #f2887a); }
    .node.visited .dot { fill: var(--rm-accent, #2a9d8f); }
    .node.deprecated .dot { fill: var(--rm-danger, #dc2626); opacity: 0.5; }
    .node.sel .dot { stroke: var(--rm-navy, #1e3a5f); stroke-width: 0.5; }
    .tlabel { fill: var(--rm-text, #111827); pointer-events: none; text-anchor: middle; }
    .ring { fill: none; stroke-width: 0.35; }
    .ring.current { stroke: var(--rm-coral-600, #e26d5e); }

    .route polyline { fill: none; stroke-linejoin: round; stroke-linecap: round; }
    .route .casing { stroke: var(--rm-surface, #fff); opacity: 0.85; }
    .route.challenge .line { stroke: #1e3a5f; }
    .route.free .line { stroke: #f2b632; }
    .stopbadge circle { stroke: var(--rm-surface, #fff); stroke-width: 0.18; pointer-events: none; }
    .stopbadge text {
      fill: #fff;
      font-weight: 700;
      text-anchor: middle;
      dominant-baseline: central;
      pointer-events: none;
    }
    .stopbadge.challenge.next circle { fill: #e26d5e; }
    .stopbadge.challenge.pending circle { fill: #1e3a5f; }
    .stopbadge.challenge.done circle { fill: #2a9d8f; }
    .stopbadge.free circle { fill: #f2b632; }
    .stopbadge.free.done circle { fill: #f8e3b0; }
    .stopbadge.free text { fill: #1e3a5f; }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.9rem;
      margin-top: 0.45rem;
      font-size: 0.75rem;
      color: var(--rm-muted, #6b7280);
    }
    .legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .legend i { width: 0.65rem; height: 0.65rem; border-radius: 50%; display: inline-block; }
    .legend i.visited { background: var(--rm-accent, #2a9d8f); }
    .legend i.available { background: var(--rm-coral, #f2887a); }
    .legend i.blocked { background: var(--rm-track, #d7dee2); border: 1px solid var(--rm-border, #d1d5db); }
    .legend i.rchallenge { background: #1e3a5f; height: 0.2rem; border-radius: 2px; width: 1rem; }
    .legend i.rfree {
      background: repeating-linear-gradient(90deg, #f2b632 0 4px, transparent 4px 7px);
      height: 0.2rem;
      border-radius: 2px;
      width: 1rem;
    }
    .empty { color: var(--rm-muted, #6b7280); margin: 0.4rem; }
  `;

  constructor() {
    super();
    this.archipelago = null;
    this.islandMaps = null;
    this.map = null;
    this.journey = { visitedCities: [], currentCity: null, plannedRoute: [], challenge: null };
    this.selected = null;
    /** Isla expandida (zoom) en modo archipiélago, o null (vista general). */
    this.expanded = null;
    /** Layout memoizado (círculos, spots, índices) — ver _computeLayout. */
    this._layout = null;
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    if (changed.has('archipelago') || changed.has('islandMaps') || changed.has('map')) {
      this._layout = this._computeLayout();
      // La isla expandida puede haber desaparecido del índice: vista general.
      if (this.expanded && !this._layout.circlesById.has(this.expanded)) this.expanded = null;
    }
  }

  /**
   * Geometría del plano a partir de las propiedades: círculos de isla, spots
   * de tema (solo de las islas con mapa cargado), índices por id y el modo
   * `single` (compat mi-espacio: sin archipiélago, una isla que ocupa todo el
   * plano y se comporta como ya expandida).
   */
  _computeLayout() {
    const single = !this.archipelago && Boolean(this.map);
    const islands = this.archipelago
      ? (this.archipelago.islands ?? [])
      : this.map
        ? [
            {
              id: this.map.id ?? 'island',
              name: this.map.name ?? '',
              x: 50,
              y: 50,
              citiesTotal: (this.map.cities ?? []).length,
            },
          ]
        : [];
    const mapsById = this.archipelago
      ? (this.islandMaps ?? new Map())
      : new Map(this.map ? [[this.map.id ?? 'island', this.map]] : []);
    const circles = islandCircles(
      islands,
      single ? { rMin: SINGLE_ISLAND_R, rMax: SINGLE_ISLAND_R } : {},
    );
    const circlesById = new Map(circles.map((c) => [c.id, c]));
    const metaById = new Map(islands.map((isle) => [isle.id, isle]));
    /** @type {Map<string, import('../../tools/career/domain/planoLayout.js').ThemeSpot[]>} */
    const spotsByIsland = new Map();
    /** @type {Map<string, import('../../tools/career/domain/planoLayout.js').ThemeSpot>} */
    const spotsById = new Map();
    for (const circle of circles) {
      const islandMap = mapsById.get(circle.id);
      if (!islandMap) continue;
      const spots = themeSpots(circle, islandMap.cities ?? []);
      spotsByIsland.set(circle.id, spots);
      for (const spot of spots) spotsById.set(spot.id, spot);
    }
    return {
      single,
      circles,
      circlesById,
      metaById,
      mapsById,
      spotsByIsland,
      spotsById,
      islandIdByPrefix: prefixIslandIndex(islands),
    };
  }

  _select(id) {
    this.dispatchEvent(
      new CustomEvent('select-city', { detail: { cityId: id }, bubbles: true, composed: true }),
    );
  }

  /** Expande la isla (zoom) o vuelve a la vista general si ya lo estaba. */
  _toggleIsland(islandId) {
    this.expanded = this.expanded === islandId ? null : islandId;
  }

  /** Enter/Espacio activan el elemento enfocado (islas y temas). */
  _onKeyActivate(event, action) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  /** Escape vuelve de la isla expandida a la vista general del archipiélago. */
  _onWrapKeydown(event) {
    if (event.key === 'Escape' && this.expanded) {
      event.stopPropagation();
      this.expanded = null;
    }
  }

  /**
   * Radio de los círculos de TEMA de una isla: proporcional a su círculo,
   * acotado para leerse tanto a escala archipiélago como en modo single.
   */
  _spotRadius(circle) {
    return Math.min(Math.max(circle.r * 0.08, 0.8), 3.4);
  }

  /** Una isla del plano: su círculo de «arena», etiqueta y temas (o contador). */
  _renderIsland(circle, lay, labeled, ui) {
    const islandMap = lay.mapsById.get(circle.id);
    const spots = lay.spotsByIsland.get(circle.id);
    const expandable = !lay.single;
    const expandedHere = this.expanded === circle.id;
    const total = lay.metaById.get(circle.id)?.citiesTotal ?? 0;
    return svg`
      <g
        class="island ${expandable ? 'expandable' : ''}"
        role=${expandable ? 'button' : nothing}
        tabindex=${expandable ? 0 : nothing}
        aria-expanded=${expandable ? String(expandedHere) : nothing}
        aria-label=${expandable
          ? `${circle.name}: ${expandedHere ? 'volver al archipiélago' : 'ampliar la isla'}`
          : circle.name}
        @click=${expandable ? () => this._toggleIsland(circle.id) : nothing}
        @keydown=${expandable
          ? (e) => this._onKeyActivate(e, () => this._toggleIsland(circle.id))
          : nothing}
      >
        <circle class="land" cx=${circle.cx} cy=${circle.cy} r=${circle.r} />
        ${expandedHere && !lay.single
          ? nothing
          : svg`<text
              class="iname"
              x=${circle.cx}
              y=${circle.cy + circle.r + 3}
              text-anchor="middle"
            >${circle.name}</text>`}
        ${islandMap
          ? spots.map((spot) =>
              this._renderTheme(spot, circle, islandMap, labeled || expandedHere, ui),
            )
          : svg`<text class="count" x=${circle.cx} y=${circle.cy} text-anchor="middle" dominant-baseline="central">${total} temas</text>`}
      </g>
    `;
  }

  /** Un TEMA (casa) de una isla: círculo por estado, tooltip y etiqueta si toca. */
  _renderTheme(spot, circle, islandMap, labeled, ui) {
    const st = cityStatus(islandMap, spot.id, this.journey);
    const status = st === 'unknown' ? 'blocked' : st;
    const name = islandMap.cities.find((c) => c.id === spot.id)?.name ?? spot.id;
    const r = this._spotRadius(circle);
    const sel = this.selected === spot.id ? 'sel' : '';
    return svg`
      <g
        class="node ${status} ${sel}"
        role="button"
        tabindex="0"
        aria-label="${name} — ${STATUS_LABELS[status]}"
        @click=${(e) => {
          e.stopPropagation();
          this._select(spot.id);
        }}
        @keydown=${(e) => this._onKeyActivate(e, () => this._select(spot.id))}
      >
        <title>${name} — ${STATUS_LABELS[status]}</title>
        ${this.journey?.currentCity === spot.id
          ? svg`<circle class="ring current" cx=${spot.x} cy=${spot.y} r=${r + 0.9 * ui} />`
          : nothing}
        <circle class="dot" cx=${spot.x} cy=${spot.y} r=${r} />
        ${labeled
          ? svg`<text
              class="tlabel"
              x=${spot.x}
              y=${spot.y - (r + 1.1 * ui)}
              style="font-size:${3 * ui}px"
            >${name}</text>`
          : nothing}
      </g>
    `;
  }

  /**
   * La ruta que dibuja el «grafo»: el reto activo manda; sin reto, la ruta
   * libre. Sin ninguna de las dos, el plano queda limpio (solo círculos).
   */
  _renderRoute(lay, ui) {
    const challenge = this.journey?.challenge ?? null;
    if (challenge?.stops?.length) {
      return this._renderRouteLayer(challenge.stops, 'challenge', stopNumberByCity(challenge), lay, ui);
    }
    const planned = this.journey?.plannedRoute ?? [];
    if (planned.length) {
      return this._renderRouteLayer(planned, 'free', routeNumberByCity(planned), lay, ui);
    }
    return nothing;
  }

  /**
   * Polilínea de una ruta con badges numerados: línea con «casing» (lomo del
   * color de superficie, legible sobre el mar en claro y oscuro), guiones en
   * la ruta libre, número de parada en cada badge y ✓ en las ya certificadas.
   */
  _renderRouteLayer(stops, kind, numberByCity, lay, ui) {
    const { points } = routePolyline(stops, lay.spotsById, lay.circlesById, {
      islandIdByPrefix: lay.islandIdByPrefix,
    });
    if (points.length === 0) return nothing;
    const visited = new Set(this.journey?.visitedCities ?? []);
    const nextId = kind === 'challenge' ? stops.find((id) => !visited.has(id)) : null;
    const path = points.map((p) => `${p.x},${p.y}`).join(' ');
    const dash = kind === 'free' ? `${2 * ui} ${1.3 * ui}` : nothing;
    return svg`
      <g class="route ${kind}" aria-hidden="true">
        <polyline class="casing" points=${path} stroke-width=${1.2 * ui} />
        <polyline class="line" points=${path} stroke-width=${0.6 * ui} stroke-dasharray=${dash} />
        ${points.map((p) => {
          const done = visited.has(p.cityId);
          const state = done ? 'done' : p.cityId === nextId ? 'next' : 'pending';
          return svg`
            <g class="stopbadge ${kind} ${state}">
              <circle cx=${p.x} cy=${p.y} r=${1.7 * ui} />
              <text x=${p.x} y=${p.y} style="font-size:${(done ? 1.8 : 2) * ui}px">
                ${done ? '✓' : (numberByCity.get(p.cityId) ?? '·')}
              </text>
            </g>
          `;
        })}
      </g>
    `;
  }

  /** Leyenda breve del plano (estados y, si las hay, las rutas pintadas). */
  _renderLegend() {
    const challenge = Boolean(this.journey?.challenge?.stops?.length);
    const free = !challenge && (this.journey?.plannedRoute ?? []).length > 0;
    return html`<div class="legend">
      <span><i class="visited"></i>Certificada</span>
      <span><i class="available"></i>Disponible</span>
      <span><i class="blocked"></i>Bloqueada</span>
      ${challenge ? html`<span><i class="rchallenge"></i>Reto</span>` : nothing}
      ${free ? html`<span><i class="rfree"></i>Tu ruta</span>` : nothing}
    </div>`;
  }

  render() {
    const lay = this._layout;
    if (!lay || lay.circles.length === 0) {
      return html`<div class="wrap"><p class="empty">Cargando el plano del archipiélago…</p></div>`;
    }
    const expandedCircle =
      !lay.single && this.expanded ? (lay.circlesById.get(this.expanded) ?? null) : null;
    const scale = expandedCircle ? islandZoom(expandedCircle).scale : 1;
    // Los trazos y badges de ruta se pintan a tamaño de PANTALLA constante:
    // divididos por la escala del zoom para no engordar al expandir.
    const ui = 1 / scale;
    const transform = expandedCircle
      ? `translate(50px, 50px) scale(${scale}) translate(${-expandedCircle.cx}px, ${-expandedCircle.cy}px)`
      : 'none';
    return html`<div class="wrap" @keydown=${this._onWrapKeydown}>
      ${expandedCircle
        ? html`<div class="zoombar">
            <button @click=${() => (this.expanded = null)}>⟵ Archipiélago</button>
            <strong>${expandedCircle.name}</strong>
            <span class="esc">(Esc para volver)</span>
          </div>`
        : nothing}
      <svg viewBox="0 0 100 100" aria-label="Plano del archipiélago de carrera">
        <g class="world" style="transform: ${transform}">
          ${lay.circles.map((circle) => this._renderIsland(circle, lay, lay.single, ui))}
          ${this._renderRoute(lay, ui)}
        </g>
      </svg>
      ${this._renderLegend()}
    </div>`;
  }
}

if (!customElements.get('career-map')) {
  customElements.define('career-map', CareerMapView);
}
