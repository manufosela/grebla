/**
 * <career-island>
 * Render 2.5D ISOMÉTRICO de la isla de carrera en SVG (evolución jugable de
 * <career-map>). Reutiliza el dominio puro (progress.js + iso.js): NO reimplementa
 * reglas de estado ni de proyección.
 *
 * Es intercambiable con <career-map>: mismas propiedades y el mismo evento.
 *
 * Propiedades (todas attribute: false):
 *  - map: CareerMap  { areas, cities, startPort }
 *  - journey: { visitedCities:string[], currentCity:string|null, plannedRoute:string[] }
 *  - reachable: string[]  ids alcanzables (siguiente paso)
 *  - selected: string|null
 *
 * Evento:
 *  - `select-city` con detail `{ cityId }` (mismo contrato que <career-map>).
 *
 * Interacción: paneo (arrastrar), zoom (rueda), zoom-a-comarca (activar una
 * plataforma) y "isla completa" para reencuadrar. Cada ciudad y cada comarca es
 * un elemento SVG enfocable por teclado (Enter/Espacio).
 *
 * Es un componente presentacional: no escribe en Firestore.
 */
import { LitElement, html, css, svg } from 'lit';
import { cityStatus } from '../../tools/career/domain/progress.js';
import { isoProject, depthSort, isoBounds, areaCentroid, TILE_W, TILE_H } from '../../tools/career/domain/iso.js';

/** Altura lógica (z) del pilar de cada ciudad → sensación 2.5D. */
const PILLAR_Z = 5;
/** Margen (en unidades lógicas del mapa) que rodea a las ciudades de una comarca. */
const PLATFORM_PAD = 7;
/** Radio del marcador de ciudad (px proyectados). */
const NODE_R = TILE_W * 1.5;
/** Semiejes de la sombra elíptica en la base del pilar. */
const BASE_RX = TILE_W * 1.4;
const BASE_RY = TILE_H * 1.4;
/** Radio de los anillos overlay (actual / ruta). */
const RING_R = TILE_W * 2.3;
/** Tamaño de fuente de las etiquetas de ciudad. */
const LABEL_FS = TILE_W * 1.4;
/** Grosor del pilar. */
const STEM_W = TILE_W * 0.5;
/** Margen del viewBox alrededor del contenido, en px proyectados. */
const VIEW_PAD = TILE_W * 4;
/** Umbral (px de cliente) para distinguir un arrastre de un clic. */
const DRAG_THRESHOLD = 4;
/** Límites de zoom relativos al ancho de la isla completa. */
const MIN_VIEW_W = TILE_W * 6;
const MAX_VIEW_W_FACTOR = 2.5;

/** Etiqueta legible del estado para el aria-label. */
const STATUS_LABEL = {
  visited: 'visitada',
  available: 'disponible',
  blocked: 'bloqueada',
  deprecated: 'en desuso',
};

export class CareerIslandView extends LitElement {
  static properties = {
    map: { attribute: false },
    journey: { attribute: false },
    reachable: { attribute: false },
    selected: { attribute: false },
    _view: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .wrap {
      position: relative;
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 0.5rem;
      overflow: hidden;
    }
    svg { width: 100%; height: auto; display: block; touch-action: none; cursor: grab; }
    svg.panning { cursor: grabbing; }

    /* Comarcas (plataformas isométricas) */
    .platform { stroke: rgba(0, 0, 0, 0.08); stroke-width: 1; cursor: zoom-in; transition: filter 0.15s ease; }
    .platform:hover, .area:focus-visible .platform { filter: brightness(0.96); }
    .area:focus-visible { outline: none; }
    .area:focus-visible .platform { stroke: var(--rm-navy, #1e3a5f); stroke-width: 2.5; }
    .area-label { font-weight: 700; fill: var(--rm-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.5px; pointer-events: none; }

    /* Puerto de inicio (nodo neutro) */
    .port-body { fill: var(--rm-navy, #1e3a5f); }
    .port-cap { fill: var(--rm-navy, #1e3a5f); opacity: 0.85; }
    .port-label { fill: var(--rm-muted, #6b7280); pointer-events: none; }

    /* Camino recorrido / ruta planificada */
    .trail { fill: none; stroke: var(--rm-accent, #2a9d8f); stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; opacity: 0.85; animation: trail-draw 1.2s ease forwards; }
    .route-plan { fill: none; stroke: var(--rm-navy, #1e3a5f); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 10 8; opacity: 0.7; }
    @keyframes trail-draw { to { stroke-dashoffset: 0; } }

    /* Ciudades (pilares) */
    .city { cursor: pointer; }
    .city:focus-visible { outline: none; }
    .shadow { fill: rgba(0, 0, 0, 0.14); }
    .stem { stroke-linecap: round; }
    .dot { stroke: rgba(0, 0, 0, 0.18); stroke-width: 1.5; transition: filter 0.1s ease; }
    .label { fill: var(--rm-text, #111827); text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: var(--rm-surface, #fff); stroke-width: 3; stroke-linejoin: round; }
    .city:hover .dot, .city:focus-visible .dot { filter: brightness(1.08); }
    .city:focus-visible .dot { stroke: var(--rm-navy, #1e3a5f); stroke-width: 3; }

    /* Colores por estado (misma paleta que <career-map>) */
    .blocked .dot { fill: var(--rm-track, #d7dee2); }
    .blocked .stem { stroke: var(--rm-track, #b9c4ca); }
    .blocked .label { fill: var(--rm-muted, #9ca3af); }
    .available .dot { fill: var(--rm-coral, #f2887a); }
    .available .stem { stroke: var(--rm-coral-600, #e26d5e); }
    .visited .dot { fill: var(--rm-accent, #2a9d8f); }
    .visited .stem { stroke: var(--rm-accent, #23867a); }
    .deprecated .dot { fill: var(--rm-danger, #dc2626); opacity: 0.5; }
    .deprecated .stem { stroke: var(--rm-danger, #dc2626); opacity: 0.4; }
    .deprecated .label { fill: var(--rm-muted, #9ca3af); text-decoration: line-through; }
    .sel .dot { stroke: var(--rm-navy, #1e3a5f); stroke-width: 3.5; }

    /* Anillos overlay */
    .ring { fill: none; stroke-width: 4; }
    .ring.current { stroke: var(--rm-coral-600, #e26d5e); }
    .ring.route { stroke: var(--rm-navy, #1e3a5f); stroke-dasharray: 8 5; }

    /* Controles de encuadre */
    .toolbar { position: absolute; top: 0.75rem; right: 0.75rem; display: flex; gap: 0.35rem; }
    .toolbar button {
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      border-radius: 8px;
      width: 2rem; height: 2rem;
      font-size: 1rem; font-weight: 700; line-height: 1;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    }
    .toolbar button:hover { background: var(--rm-track, #eef2f4); }
    .toolbar button:focus-visible { outline: 2px solid var(--rm-navy, #1e3a5f); outline-offset: 1px; }
    @media (prefers-reduced-motion: reduce) {
      .trail { animation: none; stroke-dashoffset: 0 !important; }
    }
  `;

  constructor() {
    super();
    this.map = null;
    this.journey = { visitedCities: [], currentCity: null, plannedRoute: [] };
    this.reachable = [];
    this.selected = null;
    /** @type {{x:number,y:number,w:number,h:number}|null} viewBox actual (null → isla completa). */
    this._view = null;
    this._dragging = false;
    this._dragged = false;
    this._dragStart = null;
    this._rafId = 0;
    this._lastMapId = null;
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    // Al cambiar de mapa (isla) reencuadramos a la isla completa.
    if (changed.has('map') && this.map?.id !== this._lastMapId) {
      this._lastMapId = this.map?.id ?? null;
      this._cancelAnim();
      this._view = null;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._cancelAnim();
  }

  // ---- Estado de ciudad (fuente de verdad: dominio) -------------------------

  /** @param {string} cityId @returns {'visited'|'available'|'blocked'|'deprecated'} */
  _state(cityId) {
    const st = cityStatus(this.map, cityId, this.journey);
    return st === 'unknown' ? 'blocked' : st;
  }

  // ---- Geometría / proyección ----------------------------------------------

  /** Proyección al suelo (z = 0) de una ciudad. @param {import('../../tools/career/domain/types.js').City} c */
  _base(c) {
    return isoProject(c.x, c.y, 0);
  }

  /** Proyección a la cima del pilar de una ciudad. @param {import('../../tools/career/domain/types.js').City} c */
  _top(c) {
    return isoProject(c.x, c.y, PILLAR_Z);
  }

  /** Datos de plataforma isométrica por comarca (bounding box lógico → rombo proyectado). */
  _platforms() {
    const map = this.map;
    const groups = Object.groupBy(map.cities ?? [], (c) => c.area);
    return (map.areas ?? [])
      .map((area, i) => {
        const cities = groups[area.id] ?? [];
        if (cities.length === 0) return null;
        const xs = cities.map((c) => c.x);
        const ys = cities.map((c) => c.y);
        const minX = Math.min(...xs) - PLATFORM_PAD;
        const maxX = Math.max(...xs) + PLATFORM_PAD;
        const minY = Math.min(...ys) - PLATFORM_PAD;
        const maxY = Math.max(...ys) + PLATFORM_PAD;
        const corners = [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
        ].map(([x, y]) => isoProject(x, y));
        const poly = corners.map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ');
        const centroid = areaCentroid(map, area.id) ?? { sx: 0, sy: 0 };
        const label = isoProject((minX + maxX) / 2, minY); // borde trasero
        const hue = Math.round((i * 360) / Math.max(map.areas.length, 1));
        return { area, poly, label, centroid, hue, depth: (minX + maxX) / 2 + (minY + maxY) / 2 };
      })
      .filter((p) => p !== null)
      .toSorted((a, b) => a.depth - b.depth);
  }

  /** Puntos { sx, sy } de la polilínea del camino recorrido (puerto + visitadas en orden). */
  _trailPoints() {
    const map = this.map;
    const byId = new Map(map.cities.map((c) => [c.id, c]));
    const pts = [];
    if (map.startPort) pts.push(isoProject(map.startPort.x, map.startPort.y, PILLAR_Z));
    for (const id of this.journey.visitedCities ?? []) {
      const c = byId.get(id);
      if (c) pts.push(this._top(c));
    }
    return pts;
  }

  /** Puntos de la ruta planificada (ciudad actual → plannedRoute). */
  _routePoints() {
    const map = this.map;
    const byId = new Map(map.cities.map((c) => [c.id, c]));
    const ids = [];
    if (this.journey.currentCity) ids.push(this.journey.currentCity);
    for (const id of this.journey.plannedRoute ?? []) if (!ids.includes(id)) ids.push(id);
    return ids.map((id) => byId.get(id)).filter((c) => c != null).map((c) => this._top(c));
  }

  /** Longitud total (px) de una polilínea para animar el dibujado. @param {{sx:number,sy:number}[]} pts */
  static _polyLen(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i += 1) {
      len += Math.hypot(pts[i].sx - pts[i - 1].sx, pts[i].sy - pts[i - 1].sy);
    }
    return len;
  }

  // ---- viewBox: encuadre, paneo y zoom -------------------------------------

  /** Todos los puntos relevantes proyectados (para encuadrar la isla completa). */
  _allPoints() {
    const map = this.map;
    const pts = [];
    for (const c of map.cities ?? []) {
      pts.push(this._base(c), this._top(c));
    }
    if (map.startPort) pts.push(isoProject(map.startPort.x, map.startPort.y, 0));
    // Esquinas de las plataformas para no recortar las comarcas.
    for (const p of this._platforms()) {
      for (const pair of p.poly.split(' ')) {
        const [sx, sy] = pair.split(',').map(Number);
        pts.push({ sx, sy });
      }
    }
    return pts;
  }

  /** viewBox que encuadra la isla completa. @returns {{x:number,y:number,w:number,h:number}} */
  _fullBox() {
    const b = isoBounds(this._allPoints());
    if (!b) return { x: -100, y: -100, w: 200, h: 200 };
    return this._boxFromBounds(b, VIEW_PAD);
  }

  /** Convierte un IsoBox (+padding) en un viewBox. */
  _boxFromBounds(b, pad) {
    return {
      x: b.minX - pad,
      y: b.minY - pad,
      w: b.maxX - b.minX + pad * 2,
      h: b.maxY - b.minY + pad * 2,
    };
  }

  /** viewBox efectivo: el del usuario o, si no hay, la isla completa. */
  _effectiveView() {
    return this._view ?? this._fullBox();
  }

  /** Zoom animado al bounding box de una comarca. @param {string} areaId */
  _zoomToArea(areaId) {
    const cities = (this.map.cities ?? []).filter((c) => c.area === areaId);
    if (cities.length === 0) return;
    const pts = cities.flatMap((c) => [this._base(c), this._top(c)]);
    const b = isoBounds(pts);
    if (!b) return;
    this._animateTo(this._boxFromBounds(b, VIEW_PAD));
  }

  /** Reencuadra a la isla completa. */
  _resetView() {
    this._animateTo(this._fullBox());
  }

  /** Zoom centrado (rueda) o por botón. @param {number} factor @param {number} [cx] @param {number} [cy] centro en coords de vista */
  _zoomBy(factor, cx, cy) {
    const v = this._effectiveView();
    const full = this._fullBox();
    const minW = MIN_VIEW_W;
    const maxW = full.w * MAX_VIEW_W_FACTOR;
    const nextW = Math.min(Math.max(v.w * factor, minW), maxW);
    const scale = nextW / v.w;
    const nextH = v.h * scale;
    const centerX = cx ?? v.x + v.w / 2;
    const centerY = cy ?? v.y + v.h / 2;
    // Mantén el punto (centerX, centerY) fijo bajo el cursor.
    this._cancelAnim();
    this._view = {
      x: centerX - (centerX - v.x) * scale,
      y: centerY - (centerY - v.y) * scale,
      w: nextW,
      h: nextH,
    };
  }

  /** Interpola el viewBox hacia un destino con requestAnimationFrame. */
  _animateTo(target, dur = 420) {
    this._cancelAnim();
    if (typeof requestAnimationFrame === 'undefined') {
      this._view = target;
      return;
    }
    const from = this._effectiveView();
    const start = performance.now();
    const ease = (t) => 1 - (1 - t) ** 3; // easeOutCubic
    const step = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const k = ease(t);
      this._view = {
        x: from.x + (target.x - from.x) * k,
        y: from.y + (target.y - from.y) * k,
        w: from.w + (target.w - from.w) * k,
        h: from.h + (target.h - from.h) * k,
      };
      if (t < 1) this._rafId = requestAnimationFrame(step);
      else this._rafId = 0;
    };
    this._rafId = requestAnimationFrame(step);
  }

  _cancelAnim() {
    if (this._rafId && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  // ---- Paneo (arrastrar) ----------------------------------------------------

  _onPointerDown(e) {
    if (e.button !== 0) return;
    this._cancelAnim();
    this._dragging = true;
    this._dragged = false;
    const v = this._effectiveView();
    this._dragStart = { cx: e.clientX, cy: e.clientY, view: { ...v } };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  _onPointerMove(e) {
    if (!this._dragging || !this._dragStart) return;
    const svgEl = e.currentTarget;
    const rect = svgEl.getBoundingClientRect();
    const dxClient = e.clientX - this._dragStart.cx;
    const dyClient = e.clientY - this._dragStart.cy;
    if (Math.hypot(dxClient, dyClient) > DRAG_THRESHOLD) this._dragged = true;
    const v = this._dragStart.view;
    // px de cliente → unidades de vista.
    this._view = {
      x: v.x - (dxClient * v.w) / rect.width,
      y: v.y - (dyClient * v.h) / rect.height,
      w: v.w,
      h: v.h,
    };
  }

  _onPointerUp(e) {
    this._dragging = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  _onWheel(e) {
    e.preventDefault();
    const svgEl = e.currentTarget;
    const rect = svgEl.getBoundingClientRect();
    const v = this._effectiveView();
    // Coordenada de vista bajo el cursor.
    const cx = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
    const cy = v.y + ((e.clientY - rect.top) / rect.height) * v.h;
    this._zoomBy(e.deltaY > 0 ? 1.12 : 0.89, cx, cy);
  }

  // ---- Selección / teclado --------------------------------------------------

  _select(id) {
    if (this._dragged) return; // fue un arrastre, no un clic
    this.dispatchEvent(new CustomEvent('select-city', { detail: { cityId: id }, bubbles: true, composed: true }));
  }

  _onCityKey(e, id) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._select(id);
    }
  }

  _onAreaKey(e, areaId) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._zoomToArea(areaId);
    }
  }

  // ---- Render ---------------------------------------------------------------

  _renderSvg() {
    const map = this.map;
    if (!map) return null;
    const view = this._effectiveView();
    const route = new Set(this.journey.plannedRoute ?? []);
    const current = this.journey.currentCity ?? null;

    const trail = this._trailPoints();
    const trailLen = CareerIslandView._polyLen(trail);
    const routePts = this._routePoints();

    return svg`
      <svg
        viewBox=${`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
        class=${this._dragging ? 'panning' : ''}
        role="group"
        aria-label="Isla de carrera en vista isométrica 2.5D"
        @pointerdown=${this._onPointerDown}
        @pointermove=${this._onPointerMove}
        @pointerup=${this._onPointerUp}
        @pointercancel=${this._onPointerUp}
        @wheel=${this._onWheel}
      >
        <!-- Comarcas: plataformas isométricas (fondo → frente) -->
        ${this._platforms().map(
          (p) => svg`
            <g class="area" role="button" tabindex="0"
               aria-label=${`Comarca ${p.area.name}. Activar para acercar.`}
               @click=${() => this._zoomToArea(p.area.id)}
               @keydown=${(e) => this._onAreaKey(e, p.area.id)}>
              <polygon class="platform" points=${p.poly}
                       fill=${`hsl(${p.hue} 45% 92%)`} stroke=${`hsl(${p.hue} 35% 78%)`} />
              <text class="area-label" x=${p.label.sx.toFixed(1)} y=${(p.label.sy - TILE_H).toFixed(1)}
                    text-anchor="middle" font-size=${LABEL_FS}>${p.area.name}</text>
            </g>`,
        )}

        <!-- Camino recorrido (animado) y ruta planificada -->
        ${trail.length >= 2
          ? svg`<polyline class="trail" points=${trail.map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ')}
                 style=${`stroke-dasharray:${trailLen.toFixed(1)};stroke-dashoffset:${trailLen.toFixed(1)}`} />`
          : null}
        ${routePts.length >= 2
          ? svg`<polyline class="route-plan" points=${routePts.map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ')} />`
          : null}

        <!-- Puerto de inicio (nodo neutro) -->
        ${map.startPort ? this._renderPort(map.startPort) : null}

        <!-- Ciudades como pilares, en orden de profundidad -->
        ${depthSort(map.cities ?? []).map((c) => this._renderCity(c, { route, current }))}
      </svg>
    `;
  }

  _renderPort(port) {
    const base = isoProject(port.x, port.y, 0);
    const top = isoProject(port.x, port.y, PILLAR_Z * 0.5);
    return svg`
      <g aria-label="Puerto de inicio">
        <ellipse class="shadow" cx=${base.sx.toFixed(1)} cy=${base.sy.toFixed(1)} rx=${BASE_RX} ry=${BASE_RY} />
        <line class="port-body" x1=${base.sx.toFixed(1)} y1=${base.sy.toFixed(1)} x2=${top.sx.toFixed(1)} y2=${top.sy.toFixed(1)}
              stroke="var(--rm-navy, #1e3a5f)" stroke-width=${STEM_W} stroke-linecap="round" />
        <circle class="port-cap" cx=${top.sx.toFixed(1)} cy=${top.sy.toFixed(1)} r=${NODE_R * 0.7} />
        <text class="port-label" x=${top.sx.toFixed(1)} y=${(top.sy - NODE_R).toFixed(1)} text-anchor="middle" font-size=${LABEL_FS * 0.8}>Puerto</text>
      </g>`;
  }

  _renderCity(c, { route, current }) {
    const st = this._state(c.id);
    const sel = this.selected === c.id ? 'sel' : '';
    const base = this._base(c);
    const top = this._top(c);
    const label = `${c.name} — ${STATUS_LABEL[st] ?? st}`;
    return svg`
      <g class=${`city ${st} ${sel}`} role="button" tabindex="0" aria-label=${label}
         @click=${() => this._select(c.id)} @keydown=${(e) => this._onCityKey(e, c.id)}>
        <ellipse class="shadow" cx=${base.sx.toFixed(1)} cy=${base.sy.toFixed(1)} rx=${BASE_RX} ry=${BASE_RY} />
        <line class="stem" x1=${base.sx.toFixed(1)} y1=${base.sy.toFixed(1)} x2=${top.sx.toFixed(1)} y2=${top.sy.toFixed(1)} stroke-width=${STEM_W} />
        ${route.has(c.id) ? svg`<circle class="ring route" cx=${top.sx.toFixed(1)} cy=${top.sy.toFixed(1)} r=${RING_R} />` : null}
        ${current === c.id ? svg`<circle class="ring current" cx=${top.sx.toFixed(1)} cy=${top.sy.toFixed(1)} r=${RING_R} />` : null}
        <circle class="dot" cx=${top.sx.toFixed(1)} cy=${top.sy.toFixed(1)} r=${NODE_R} />
        <text class="label" x=${top.sx.toFixed(1)} y=${(top.sy - NODE_R - 4).toFixed(1)} font-size=${LABEL_FS}>${c.name}</text>
      </g>`;
  }

  render() {
    if (!this.map) return html`<div class="wrap"></div>`;
    return html`
      <div class="wrap">
        <div class="toolbar">
          <button type="button" title="Acercar" aria-label="Acercar" @click=${() => this._zoomBy(0.8)}>+</button>
          <button type="button" title="Alejar" aria-label="Alejar" @click=${() => this._zoomBy(1.25)}>−</button>
          <button type="button" title="Isla completa" aria-label="Ver la isla completa" @click=${() => this._resetView()}>⤢</button>
        </div>
        ${this._renderSvg()}
      </div>
    `;
  }
}

if (!customElements.get('career-island')) {
  customElements.define('career-island', CareerIslandView);
}
