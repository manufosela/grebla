/**
 * <survey-flow-canvas> — lienzo visual del flujo de una encuesta (RMR-TSK-0344).
 *
 * Piel sobre el modelo de grafo (`flow.js`): un nodo por pregunta (más un nodo
 * «Fin»), y flechas SVG para el salto por defecto y las reglas condicionales.
 * Los nodos se arrastran (pointer events) y al soltar emite `layout-change` con
 * las posiciones, que el editor persiste con la encuesta. MVP: ver + mover.
 */
import { LitElement, html, css, svg } from 'lit';
import { flowEdges, resolveLayout, edgePath } from '../../tools/survey/domain/flowLayout.js';
import { END } from '../../tools/survey/domain/flow.js';

const NODE_W = 180;
const NODE_H = 62;
const KIND = { scale: 'Escala', text: 'Texto', choice: 'Opción única' };

export class SurveyFlowCanvas extends LitElement {
  static properties = {
    questions: { attribute: false },
    layout: { attribute: false },
    selectedId: { attribute: false },
    _pos: { state: true },
    _drag: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); }
    .canvas { position: relative; min-width: 100%; min-height: 320px; background:
      radial-gradient(var(--rm-border, #e3ebef) 1px, transparent 1px) 0 0 / 22px 22px;
      border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; overflow: hidden; touch-action: none; }
    svg.edges { position: absolute; inset: 0; pointer-events: none; }
    .edge { fill: none; stroke: var(--rm-muted, #90a4b0); stroke-width: 2; }
    .edge.cond { stroke: var(--teal); stroke-dasharray: 5 4; }
    .elabel { fill: var(--rm-accent-700, #1f7a6e); font-size: 11px; font-weight: 700; paint-order: stroke;
      stroke: var(--rm-surface, #fff); stroke-width: 3px; }
    .node { position: absolute; width: ${NODE_W}px; min-height: ${NODE_H}px; box-sizing: border-box;
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #dde7ec); border-radius: 10px;
      padding: 0.45rem 0.6rem; cursor: grab; user-select: none; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      display: flex; flex-direction: column; gap: 0.15rem; }
    .node:active { cursor: grabbing; border-color: var(--teal); }
    .node.sel { border-color: var(--teal); box-shadow: 0 0 0 2px var(--teal), 0 3px 8px rgba(20,50,80,0.16); }
    .node.choice { border-left: 3px solid var(--teal); }
    .node.scale { border-left: 3px solid #4c86c6; }
    .node.text { border-left: 3px solid var(--rm-muted, #90a4b0); }
    .node.end { background: var(--rm-surface-hover, #eef3f5); align-items: center; justify-content: center;
      width: 120px; min-height: 40px; border-radius: 999px; font-weight: 700; color: var(--rm-muted, #5b6b7d); }
    .ntype { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;
      color: var(--rm-muted, #5b6b7d); }
    .nlabel { font-size: 0.82rem; color: var(--rm-text, #1e3a5f); line-height: 1.25; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  `;

  constructor() {
    super();
    this.questions = [];
    this.layout = {};
    this._pos = {};
    this._drag = null;
  }

  willUpdate(changed) {
    if (changed.has('questions') || changed.has('layout')) {
      this._pos = resolveLayout(this.questions ?? [], this.layout ?? {});
    }
  }

  /** Punto de conexión de un nodo (centro-arriba o centro-abajo). */
  _port(id, side) {
    const p = this._pos[id] ?? { x: 0, y: 0 };
    return { x: p.x + NODE_W / 2, y: side === 'bottom' ? p.y + NODE_H : p.y };
  }

  _onDown(e, id) {
    const p = this._pos[id];
    this._drag = { id, x0: p.x, y0: p.y, px: e.clientX, py: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  _onMove(e) {
    if (!this._drag) return;
    const { id, x0, y0, px, py } = this._drag;
    this._pos = { ...this._pos, [id]: { x: Math.max(0, x0 + e.clientX - px), y: Math.max(0, y0 + e.clientY - py) } };
  }

  _onUp(e) {
    if (!this._drag) return;
    const { id, px, py } = this._drag;
    // Poco movimiento = clic (seleccionar); movimiento = arrastre (reposicionar).
    const moved = Math.abs(e.clientX - px) > 4 || Math.abs(e.clientY - py) > 4;
    this._drag = null;
    const type = moved ? 'layout-change' : 'node-select';
    const detail = moved ? { ...this._pos } : { id };
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  render() {
    const qById = new Map((this.questions ?? []).map((q) => [q.id, q]));
    const edges = flowEdges(this.questions ?? []);
    const ids = Object.keys(this._pos);
    if (!ids.length) return html`<div class="canvas"></div>`;
    const width = Math.max(...ids.map((id) => this._pos[id].x)) + NODE_W + 60;
    const height = Math.max(...ids.map((id) => this._pos[id].y)) + NODE_H + 60;
    return html`
      <div class="canvas" style="width:${width}px;height:${height}px"
        @pointermove=${this._onMove} @pointerup=${this._onUp} @pointercancel=${this._onUp}>
        <svg class="edges" width=${width} height=${height}>
          <defs>
            <marker id="fc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--rm-muted, #90a4b0)"></path>
            </marker>
          </defs>
          ${edges.map((edge) => {
            const from = this._port(edge.from, 'bottom');
            const to = this._port(edge.to, 'top');
            const label = edge.label
              ? svg`<text class="elabel" x=${(from.x + to.x) / 2} y=${(from.y + to.y) / 2} text-anchor="middle">${edge.label}</text>`
              : '';
            return svg`<path class="edge ${edge.label ? 'cond' : ''}" d=${edgePath(from, to)} marker-end="url(#fc-arrow)"></path>${label}`;
          })}
        </svg>
        ${ids.map((id) => {
          const p = this._pos[id];
          const sel = id === this.selectedId ? ' sel' : '';
          if (id === END) {
            return html`<div class="node end${sel}" style="left:${p.x}px;top:${p.y}px" @pointerdown=${(e) => this._onDown(e, id)}>Fin</div>`;
          }
          const q = qById.get(id);
          return html`<div class="node ${q?.type ?? 'text'}${sel}" style="left:${p.x}px;top:${p.y}px" @pointerdown=${(e) => this._onDown(e, id)}>
            <span class="ntype">${KIND[q?.type] ?? 'Pregunta'}</span>
            <span class="nlabel">${q?.label || '(sin enunciado)'}</span>
          </div>`;
        })}
      </div>`;
  }
}

if (!customElements.get('survey-flow-canvas')) {
  customElements.define('survey-flow-canvas', SurveyFlowCanvas);
}
