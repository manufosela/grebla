/**
 * <zoom-port> — visor de un lienzo grande (RMR-BUG-0126): zoom con la rueda y
 * con botones, arrastre para mover, «Ver todo» que encaja el lienzo, «100 %»
 * y pantalla completa. El contenido va en el slot y se mueve entero.
 *
 * Props: width, height (tamaño natural del lienzo, px). Al cambiar, se vuelve
 * a encajar. La pantalla completa se pide sobre el propio elemento para que
 * el visor y sus botones sigan a mano (mismo criterio que el mapa de carrera).
 */
import { LitElement, html, css } from 'lit';

export class ZoomPort extends LitElement {
  static properties = {
    width: { type: Number },
    height: { type: Number },
    _zoom: { state: true },
    _pan: { state: true },
    _fullscreen: { state: true },
    _portHeight: { state: true },
  };

  static styles = css`
    :host { display: block; }
    :host(:fullscreen) { background: var(--rm-bg, #fff); padding: 0.75rem; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.4rem; }
    .tools { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
    .tools button { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; height: 2rem; min-width: 2rem; padding: 0 0.55rem; font: inherit; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
    .tools button:hover { border-color: var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f); }
    .tools .hint { color: var(--rm-muted, #5b6b7d); font-size: 0.75rem; margin-left: 0.35rem; }
    .tools .grow { flex: 1; }
    .port { position: relative; overflow: hidden; height: min(78vh, 900px); border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; background: color-mix(in srgb, var(--rm-text, #111827) 3%, transparent); cursor: grab; touch-action: none; }
    :host(:fullscreen) .port { flex: 1 1 auto; height: auto; }
    .port.grabbing { cursor: grabbing; }
    .canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
  `;

  constructor() {
    super();
    this.width = 0;
    this.height = 0;
    this._zoom = 1;
    this._pan = { x: 0, y: 0 };
    this._drag = null;
    this._fullscreen = false;
    /** Altura del visor ajustada al contenido (px), o 0 = la del CSS. */
    this._portHeight = 0;
    this._onFullscreenChange = () => { this._fullscreen = document.fullscreenElement === this; this.updateComplete.then(() => this.fit()); };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('fullscreenchange', this._onFullscreenChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('fullscreenchange', this._onFullscreenChange);
  }

  updated(changed) {
    if (changed.has('width') || changed.has('height')) this.fit();
  }

  render() {
    return html`
      <div class="tools">
        <button type="button" title="Alejar" aria-label="Alejar" @click=${() => this.zoomBy(1 / 1.2)}>−</button>
        <button type="button" title="Acercar" aria-label="Acercar" @click=${() => this.zoomBy(1.2)}>+</button>
        <button type="button" @click=${() => this.fit()}>Ver todo</button>
        <button type="button" @click=${() => this.reset()}>100 %</button>
        <span class="hint">arrastra para mover · rueda para zoom</span>
        <span class="grow"></span>
        <button type="button" aria-pressed=${this._fullscreen} @click=${() => this.toggleFullscreen()}
          title=${this._fullscreen ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa'}
        >${this._fullscreen ? '⤡ Restaurar' : '⛶ Pantalla completa'}</button>
      </div>
      <div class="port" style=${this._portHeight && !this._fullscreen ? `height:${this._portHeight}px` : ''}
        @wheel=${this._onWheel} @pointerdown=${this._onPanStart}
        @pointermove=${this._onPanMove} @pointerup=${this._onPanEnd} @pointercancel=${this._onPanEnd}>
        <div class="canvas" style="width:${this.width}px;height:${this.height}px;transform:translate(${this._pan.x}px,${this._pan.y}px) scale(${this._zoom})">
          <slot></slot>
        </div>
      </div>`;
  }

  /** Zoom relativo, acotado para no perder el dibujo de vista. */
  zoomBy(factor) {
    this._zoom = Math.min(2.5, Math.max(0.15, this._zoom * factor));
  }

  /**
   * «Ver todo»: encaja el lienzo en el visor y lo centra. Fuera de pantalla
   * completa, el visor se acorta hasta el contenido (con un mínimo) para no
   * dejar un vacío enorme bajo un árbol pequeño.
   */
  fit() {
    const port = this.renderRoot.querySelector('.port');
    if (!port || !this.width || !this.height) return;
    const maxH = this._fullscreen ? port.clientHeight : Math.min(globalThis.innerHeight * 0.78, 900);
    const scale = Math.min(1, (port.clientWidth - 24) / this.width, (maxH - 24) / this.height);
    this._zoom = Math.max(0.15, scale);
    this._portHeight = this._fullscreen ? 0 : Math.round(Math.max(320, Math.min(maxH, this.height * this._zoom + 24)));
    this._pan = { x: (port.clientWidth - this.width * this._zoom) / 2, y: 12 };
  }

  /** Tamaño real, arriba a la izquierda. */
  reset() {
    this._zoom = 1;
    this._pan = { x: 12, y: 12 };
  }

  async toggleFullscreen() {
    if (!this.requestFullscreen) return;
    try {
      if (document.fullscreenElement === this) await document.exitFullscreen();
      else await this.requestFullscreen();
    } catch { /* el navegador no la concede: se queda como está */ }
  }

  _onWheel(e) {
    e.preventDefault();
    this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  _onPanStart(e) {
    if (e.button !== 0) return;
    this._drag = { x: e.clientX - this._pan.x, y: e.clientY - this._pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add('grabbing');
  }

  _onPanMove(e) {
    if (!this._drag) return;
    this._pan = { x: e.clientX - this._drag.x, y: e.clientY - this._drag.y };
  }

  _onPanEnd(e) {
    this._drag = null;
    e.currentTarget.classList.remove('grabbing');
  }
}

if (!customElements.get('zoom-port')) customElements.define('zoom-port', ZoomPort);
