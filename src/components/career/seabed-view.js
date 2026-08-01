/**
 * <seabed-view> — la vista SUBMARINA del lecho (RMR-PCS-0028 · F3a).
 *
 * El lecho es el fondo transversal que sostiene el archipiélago: aquí viven los
 * ARRECIFES, las competencias de «Orquestación y juicio». Recibe el CareerMap
 * del lecho (/careerMap/seabed) y lo pinta como una escena submarina propia
 * (fondo azul profundo, rayos de luz, partículas) con los arrecifes como nodos
 * bioluminiscentes conectados por sus prereqs. Activar un arrecife abre su
 * detalle (resumen, claves, lente era-IA y recursos) sin salir de la escena.
 *
 * Es un look COMPROMETIDO de un solo tema (submarino), no theme-aware: el lecho
 * es siempre el fondo oscuro. Emite `surface` para volver a la superficie.
 *
 * El encendido de los arrecifes según el progreso llega en F4; aquí todos lucen
 * con su brillo latente.
 */
import { LitElement, html, css, svg, nothing } from 'lit';
import { seabedScene, seabedProgress } from '../../tools/career/domain/seabed.js';

/** Rótulo accesible del estado de un arrecife (encendido/disponible/bloqueado). */
const STATUS_LABEL = { visited: 'encendido', available: 'disponible', blocked: 'bloqueado' };
/** Rótulo del tipo de arrecife (por defecto «Competencia»). */
const KIND_LABEL = { milestone: 'Hito', tech: 'Tecnología', skill: 'Competencia' };

/** Burbujas de la escena: posiciones/tiempos FIJOS (deterministas, sin random). */
const BUBBLES = [
  { left: 12, size: 6, dur: 9, delay: 0 },
  { left: 27, size: 4, dur: 12, delay: 2.5 },
  { left: 41, size: 8, dur: 8, delay: 1 },
  { left: 58, size: 5, dur: 11, delay: 3.5 },
  { left: 73, size: 7, dur: 10, delay: 0.8 },
  { left: 86, size: 4, dur: 13, delay: 2 },
  { left: 92, size: 6, dur: 9, delay: 4 },
];

export class SeabedView extends LitElement {
  static properties = {
    map: { attribute: false },
    journey: { attribute: false },
    /** ¿El usuario JUEGA su propio recorrido? Habilita certificar arrecifes (F4). */
    canPlay: { attribute: false },
    /** Callback async del contenedor para encender/apagar un arrecife (F4):
     *  `(cityId) => Promise`. Se espera para bloquear el botón mientras está en
     *  vuelo y liberarlo al terminar (éxito o error). */
    onToggle: { attribute: false },
    _selected: { state: true },
    /** Certificado en vuelo: bloquea el botón para evitar dobles toggles (F4). */
    _pending: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      position: relative;
      color: #e8f4f8;
      /* Fondo submarino: de la penumbra azulada de arriba al negro del fondo. */
      background:
        radial-gradient(120% 80% at 50% -10%, #123c56 0%, #0a2536 35%, #061826 65%, #030d16 100%);
      overflow: hidden;
      min-height: 30rem;
      border-radius: 14px;
    }
    /* Rayos de luz que bajan desde la superficie. */
    .rays { position: absolute; inset: 0; pointer-events: none; opacity: 0.5; mix-blend-mode: screen; }
    .ray {
      position: absolute; top: -10%; width: 16%; height: 130%;
      background: linear-gradient(180deg, rgba(120, 210, 255, 0.28), rgba(120, 210, 255, 0));
      filter: blur(6px); transform: skewX(-8deg); transform-origin: top center;
    }
    .bubbles { position: absolute; inset: 0; pointer-events: none; }
    .bubble {
      position: absolute; bottom: -4%; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.7), rgba(160,220,255,0.15) 60%, transparent 70%);
      box-shadow: 0 0 8px rgba(150, 220, 255, 0.3);
      animation: rise linear infinite;
    }
    @keyframes rise {
      0% { transform: translateY(0) translateX(0); opacity: 0; }
      12% { opacity: 0.9; }
      100% { transform: translateY(-115vh) translateX(1.5rem); opacity: 0; }
    }
    header.deep {
      position: relative; z-index: 3;
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      padding: 1.1rem 1.3rem 0.4rem;
    }
    .titles h3 { margin: 0; font-size: 1.25rem; letter-spacing: 0.01em; text-shadow: 0 0 14px rgba(77, 208, 225, 0.45); }
    .titles p { margin: 0.2rem 0 0; font-size: 0.85rem; color: #9fc6d6; max-width: 42ch; }
    .surface {
      flex: none; border: 1.5px solid rgba(120, 210, 255, 0.5); background: rgba(10, 40, 60, 0.6);
      color: #cdeefb; border-radius: 999px; padding: 0.45rem 0.95rem; font: inherit; font-size: 0.85rem;
      font-weight: 600; cursor: pointer; backdrop-filter: blur(2px);
    }
    .surface:hover, .surface:focus-visible { border-color: #7fdfff; color: #fff; outline: none; box-shadow: 0 0 0 3px rgba(77, 208, 225, 0.3); }
    /* Escena con los arrecifes posicionados por x/y (0..100). */
    .scene { position: relative; z-index: 2; width: 100%; aspect-ratio: 4 / 3; }
    .edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .edge { stroke: rgba(77, 208, 225, 0.28); stroke-width: 1.5; stroke-linecap: round; }
    .reef {
      position: absolute; transform: translate(-50%, -50%);
      display: inline-flex; flex-direction: column; align-items: center; gap: 0.35rem;
      border: 0; background: none; padding: 0; cursor: pointer; color: #eaf7fc; font: inherit;
      width: max-content; max-width: 9rem;
    }
    .reef .dot {
      width: 1.5rem; height: 1.5rem; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #d9fbff, #4dd0e1 55%, #1f7f96 100%);
      box-shadow: 0 0 10px 2px rgba(77, 208, 225, 0.6), 0 0 22px 6px rgba(77, 208, 225, 0.25);
      animation: pulse 3.2s ease-in-out infinite;
    }
    .reef.milestone .dot {
      width: 2rem; height: 2rem;
      background: radial-gradient(circle at 35% 30%, #fff2cf, #ffcf6b 55%, #b9781f 100%);
      box-shadow: 0 0 12px 3px rgba(255, 207, 107, 0.65), 0 0 26px 8px rgba(255, 207, 107, 0.3);
    }
    .reef .label {
      font-size: 0.72rem; line-height: 1.15; text-align: center; color: #cdeafa;
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8); padding: 0.05rem 0.3rem;
    }
    .reef .dot { position: relative; }
    .reef:hover .dot, .reef:focus-visible .dot { transform: scale(1.12); }
    .reef:focus-visible { outline: none; }
    .reef:focus-visible .label { text-decoration: underline; }
    @keyframes pulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.35); } }
    /* Estados del arrecife (F4): encendido (visited), latente (available), apagado (blocked). */
    .reef .tick { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 900; color: #0a3324; }
    .reef.visited .dot { background: radial-gradient(circle at 35% 30%, #fffef0, #a9f5cf 45%, #2aa578 100%); box-shadow: 0 0 14px 3px rgba(126, 255, 196, 0.7), 0 0 30px 10px rgba(126, 255, 196, 0.28); }
    .reef.milestone.visited .dot { background: radial-gradient(circle at 35% 30%, #fffdf0, #ffd24d 50%, #b9781f 100%); box-shadow: 0 0 16px 4px rgba(255, 210, 77, 0.8), 0 0 34px 12px rgba(255, 210, 77, 0.38); }
    .reef.blocked .dot { background: radial-gradient(circle at 35% 30%, #6b8794, #33505e 60%, #16242c 100%); box-shadow: 0 0 6px rgba(80, 120, 140, 0.3); animation: none; filter: saturate(0.5); }
    .reef.blocked .label { color: #85a0ad; }
    .count { margin: 0.4rem 0 0; font-size: 0.8rem; color: #8fd3e6; display: inline-flex; align-items: center; gap: 0.4rem; }
    .lit-dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fffef0, #a9f5cf 45%, #2aa578); box-shadow: 0 0 8px rgba(126, 255, 196, 0.7); }
    .sheet .st { text-transform: none; letter-spacing: 0; color: #8fd3e6; }
    .sheet .st.visited { color: #8fe0b8; }
    .sheet .st.blocked { color: #9fb4c0; }
    .sheet .act { margin-top: 1.2rem; }
    .sheet .certify { border: 1.5px solid #4dd0e1; background: rgba(77, 208, 225, 0.14); color: #eaf7fc; border-radius: 999px; padding: 0.5rem 1.05rem; font: inherit; font-weight: 700; cursor: pointer; }
    .sheet .certify:hover:not(:disabled), .sheet .certify:focus-visible { background: rgba(77, 208, 225, 0.26); outline: none; box-shadow: 0 0 0 3px rgba(77, 208, 225, 0.3); }
    .sheet .certify.on { border-color: #7fe0b8; color: #cdfbe6; background: rgba(126, 224, 184, 0.16); }
    .sheet .certify:disabled { opacity: 0.5; cursor: not-allowed; }
    /* Panel de detalle del arrecife (hoja que sube desde el fondo). */
    .sheet-backdrop { position: absolute; inset: 0; z-index: 4; background: rgba(2, 10, 18, 0.55); backdrop-filter: blur(2px); }
    .sheet {
      position: absolute; z-index: 5; left: 50%; bottom: 0; transform: translateX(-50%);
      width: min(92%, 40rem); max-height: 88%; overflow-y: auto;
      background: linear-gradient(180deg, #0c2c40, #071a28); color: #e8f4f8;
      border: 1px solid rgba(120, 210, 255, 0.35); border-bottom: 0;
      border-radius: 16px 16px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
      padding: 1.1rem 1.3rem 1.5rem; animation: surface-up 0.28s ease-out;
    }
    @keyframes surface-up { from { transform: translate(-50%, 30%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
    .sheet .close { float: right; border: 0; background: none; color: #9fc6d6; font-size: 1.4rem; line-height: 1; cursor: pointer; }
    .sheet .close:hover, .sheet .close:focus-visible { color: #fff; outline: none; }
    .sheet .kind { display: inline-block; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: #7fdfff; margin-bottom: 0.2rem; }
    .sheet h4 { margin: 0 0 0.5rem; font-size: 1.3rem; text-shadow: 0 0 12px rgba(77, 208, 225, 0.4); }
    .sheet .summary { margin: 0 0 0.9rem; color: #d6ecf5; line-height: 1.5; }
    .sheet h5 { margin: 1rem 0 0.4rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #8fd3e6; }
    .sheet ul { margin: 0; padding-left: 1.1rem; }
    .sheet li { margin: 0.2rem 0; line-height: 1.4; }
    .sheet .aifocus { background: rgba(77, 208, 225, 0.1); border-left: 3px solid #4dd0e1; padding: 0.55rem 0.8rem; border-radius: 0 8px 8px 0; color: #dff3fa; line-height: 1.5; }
    .sheet .res { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .sheet .res a, .sheet .res span {
      display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.82rem;
      border: 1px solid rgba(120, 210, 255, 0.35); border-radius: 999px; padding: 0.3rem 0.7rem;
      color: #cdeefb; text-decoration: none;
    }
    .sheet .res a:hover, .sheet .res a:focus-visible { border-color: #7fdfff; color: #fff; outline: none; }
    .sheet .res .rk { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.04em; color: #7fbdd2; }
    .empty { position: relative; z-index: 2; padding: 3rem 1.5rem; text-align: center; color: #9fc6d6; }
    @media (prefers-reduced-motion: reduce) {
      .bubble { animation: none; display: none; }
      .reef .dot { animation: none; }
      .sheet { animation: none; }
    }
  `;

  constructor() {
    super();
    /** @type {import('../../tools/career/domain/types.js').CareerMap|null} */
    this.map = null;
    /** @type {import('../../tools/career/domain/types.js').Journey|null} */
    this.journey = null;
    this.canPlay = false;
    /** @type {((cityId: string) => Promise<unknown>)|null} */
    this.onToggle = null;
    /** @type {string|null} */
    this._selected = null;
    this._pending = false;
  }

  /** Escape: cierra el detalle si está abierto; si no, vuelve a la superficie. */
  connectedCallback() {
    super.connectedCallback();
    this._onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (this._selected) this._selected = null;
      else this._surface();
    };
    globalThis.addEventListener('keydown', this._onKey);
  }

  disconnectedCallback() {
    globalThis.removeEventListener('keydown', this._onKey);
    super.disconnectedCallback();
  }

  _surface() {
    this.dispatchEvent(new CustomEvent('surface', { bubbles: true, composed: true }));
  }

  _city(id) {
    return (this.map?.cities ?? []).find((c) => c.id === id) ?? null;
  }

  render() {
    const { nodes, edges } = seabedScene(this.map);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const { statusById, lit, total } = seabedProgress(this.map, this.journey);
    return html`
      <div class="rays" aria-hidden="true">
        <div class="ray" style="left:8%"></div>
        <div class="ray" style="left:38%"></div>
        <div class="ray" style="left:66%"></div>
      </div>
      <div class="bubbles" aria-hidden="true">
        ${BUBBLES.map((b) => html`<span class="bubble" style="left:${b.left}%;width:${b.size}px;height:${b.size}px;animation-duration:${b.dur}s;animation-delay:${b.delay}s"></span>`)}
      </div>
      <header class="deep">
        <div class="titles">
          <h3>${this.map?.name ?? 'El lecho que sostiene'}</h3>
          <p>El fondo que sostiene el archipiélago: los arrecifes del juicio y la orquestación. Acércate a uno para explorarlo.</p>
          ${total > 0 ? html`<p class="count"><span class="lit-dot" aria-hidden="true"></span> ${lit}/${total} arrecifes encendidos</p>` : nothing}
        </div>
        <button type="button" class="surface" @click=${this._surface}>🌊 Volver a la superficie</button>
      </header>
      ${nodes.length === 0
        ? html`<p class="empty">El lecho aún no tiene arrecifes.</p>`
        : html`
            <div class="scene">
              <svg class="edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                ${edges.map((e) => {
                  const a = byId.get(e.from);
                  const b = byId.get(e.to);
                  if (!a || !b) return nothing;
                  return svg`<line class="edge" x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y} vector-effect="non-scaling-stroke"></line>`;
                })}
              </svg>
              ${nodes.map((n) => {
                const status = statusById.get(n.id) ?? 'available';
                return html`
                <button
                  type="button"
                  class="reef ${n.kind === 'milestone' ? 'milestone' : ''} ${status}"
                  style="left:${n.x}%;top:${n.y}%"
                  aria-label="Arrecife: ${n.name} — ${STATUS_LABEL[status] ?? ''}"
                  @click=${() => { this._selected = n.id; }}
                >
                  <span class="dot" aria-hidden="true">${status === 'visited' ? html`<span class="tick">✓</span>` : nothing}</span>
                  <span class="label">${n.name}</span>
                </button>`;
              })}
            </div>`}
      ${this._renderSheet()}
    `;
  }

  _renderSheet() {
    const city = this._selected ? this._city(this._selected) : null;
    if (!city) return nothing;
    const { statusById } = seabedProgress(this.map, this.journey);
    const status = statusById.get(city.id) ?? 'available';
    const visited = status === 'visited';
    const blocked = status === 'blocked';
    let certifyLabel = '✦ Encender el arrecife';
    if (visited) certifyLabel = 'Apagar el arrecife (retirar)';
    else if (blocked) certifyLabel = 'Alcanza antes los arrecifes previos';
    return html`
      <div class="sheet-backdrop" @click=${() => { this._selected = null; }}></div>
      <div class="sheet" role="dialog" aria-label="${city.name}">
        <button type="button" class="close" aria-label="Cerrar" @click=${() => { this._selected = null; }}>×</button>
        <span class="kind">${KIND_LABEL[city.kind] ?? 'Competencia'} · <span class="st ${status}">${STATUS_LABEL[status] ?? ''}</span></span>
        <h4>${city.name}</h4>
        ${city.summary ? html`<p class="summary">${city.summary}</p>` : nothing}
        ${city.keyPoints?.length ? html`<h5>Claves</h5><ul>${city.keyPoints.map((p) => html`<li>${p}</li>`)}</ul>` : nothing}
        ${city.aiFocus ? html`<h5>En la era de la IA</h5><p class="aifocus">${city.aiFocus}</p>` : nothing}
        ${city.resources?.length ? html`<h5>Recursos</h5><div class="res">${city.resources.map((r) => this._resource(r))}</div>` : nothing}
        ${this.canPlay
          ? html`<div class="act">
              <button
                type="button"
                class="certify ${visited ? 'on' : ''}"
                ?disabled=${(blocked && !visited) || this._pending}
                @click=${() => this._toggle(city.id)}
              >${certifyLabel}</button>
            </div>`
          : nothing}
      </div>
    `;
  }

  async _toggle(cityId) {
    if (this._pending || typeof this.onToggle !== 'function') return; // anti doble-clic
    this._pending = true;
    try {
      await this.onToggle(cityId);
    } finally {
      this._pending = false; // se libera siempre: éxito o error
    }
  }

  _resource(r) {
    const inner = html`<span class="rk">${r.kind}</span>${r.label}`;
    return r.url
      ? html`<a href=${r.url} target="_blank" rel="noopener noreferrer">${inner}</a>`
      : html`<span>${inner}</span>`;
  }
}

customElements.define('seabed-view', SeabedView);
