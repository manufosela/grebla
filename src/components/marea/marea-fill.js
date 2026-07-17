/**
 * <marea-fill> — pantalla «Mi marea» (RMR-TSK-0235). El ingeniero coloca su boya
 * en la rejilla energía×ánimo, ajusta las 4 anclas (Carga, Rumbo, Tripulación,
 * Reconocimiento) y escribe una palabra. Guarda un registro por día vía
 * saveMyPulse; al cargar, precarga el de HOY si ya existe (editable hasta
 * medianoche: siempre se edita el doc del día actual).
 *
 * Props: uid (lo inyecta el glue de cliente tras resolver la sesión).
 */
import { LitElement, html, css } from 'lit';
import { saveMyPulse, getMyPulse } from '../../lib/pulse.js';
import { pulseReading } from '../../tools/pulse/domain/pulse.js';

/** Anclas: clave de estado, etiqueta y extremos (bajo↔alto). */
const ANCHORS = [
  { key: 'carga', name: 'Carga', lo: 'sostenible', hi: 'desbordado' },
  { key: 'rumbo', name: 'Rumbo', lo: 'sin rumbo', hi: 'rumbo claro' },
  { key: 'tripulacion', name: 'Tripulación', lo: 'en solitario', hi: 'buena tripulación' },
  { key: 'reconocimiento', name: 'Reconocimiento', lo: 'invisible', hi: 'valorado' },
];

export class MareaFill extends LitElement {
  static properties = {
    uid: { attribute: false },
    _energia: { state: true },
    _animo: { state: true },
    _carga: { state: true },
    _rumbo: { state: true },
    _tripulacion: { state: true },
    _reconocimiento: { state: true },
    _palabra: { state: true },
    _shareWord: { state: true },
    _loading: { state: true },
    _saving: { state: true },
    _savedToday: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --coral: var(--gr-coral, #f2887a); --teal: var(--gr-teal, #2a9d8f); --navy: var(--gr-navy, #1e3a5f); }
    .lead { margin: 0 0 1.2rem; color: var(--rm-muted, #5b6b7d); font-size: 0.92rem; max-width: 54ch; }
    .lead b { color: var(--rm-text, #1e3a5f); }
    .fill { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: clamp(1.1rem, 3vw, 2rem); align-items: start; }
    @media (max-width: 720px) { .fill { grid-template-columns: 1fr; } }

    .gridwrap { display: flex; flex-direction: column; gap: 0.55rem; }
    .axis { font-size: 0.62rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--rm-muted, #5b6b7d); font-weight: 700; }
    .axis.dim { opacity: 0.72; }
    .gridrow { display: flex; align-items: stretch; gap: 0.45rem; }
    .axis-side { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--rm-muted, #5b6b7d); font-weight: 700; text-align: center; }
    .grid {
      position: relative; flex: 1; aspect-ratio: 1 / 1; border-radius: 16px; border: 1px solid var(--rm-border, #dde7ec);
      background:
        linear-gradient(to right, color-mix(in srgb, var(--navy) 12%, transparent), color-mix(in srgb, var(--teal) 16%, transparent)) top / 100% 50% no-repeat,
        linear-gradient(to right, color-mix(in srgb, var(--rm-muted, #5b6b7d) 12%, transparent), color-mix(in srgb, var(--coral) 15%, transparent)) bottom / 100% 50% no-repeat;
      cursor: crosshair; touch-action: none; overflow: hidden;
    }
    .cross { position: absolute; background: var(--rm-border, #dde7ec); opacity: 0.7; }
    .cross.h { left: 0; right: 0; top: 50%; height: 1px; }
    .cross.v { top: 0; bottom: 0; left: 50%; width: 1px; }
    .q { position: absolute; font-size: 0.66rem; font-weight: 700; color: var(--rm-muted, #5b6b7d); opacity: 0.85; pointer-events: none; }
    .q.tl { top: 0.5rem; left: 0.6rem; } .q.tr { top: 0.5rem; right: 0.6rem; }
    .q.bl { bottom: 0.5rem; left: 0.6rem; } .q.br { bottom: 0.5rem; right: 0.6rem; }
    .buoy { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%;
      background: var(--coral); border: 3px solid var(--rm-surface, #fff);
      box-shadow: 0 4px 14px color-mix(in srgb, var(--coral) 55%, transparent), 0 0 0 1px color-mix(in srgb, var(--coral) 40%, transparent);
      transition: left .1s ease, top .1s ease; }
    .grid:focus-visible { outline: 2px solid var(--navy); outline-offset: 2px; }
    .reading { display: flex; align-items: baseline; gap: 0.5rem; }
    .reading .r-name { font-size: 1.05rem; font-weight: 700; color: var(--rm-accent-700, var(--teal)); }
    .reading .r-sub { font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); }

    .anchors { display: flex; flex-direction: column; gap: 1.1rem; }
    .anchor .a-name { font-size: 0.82rem; font-weight: 700; }
    .anchor .a-ends { display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--rm-muted, #5b6b7d); margin-top: 0.25rem; }
    input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 999px; background: var(--rm-track, #e9f0f2); outline: none; cursor: pointer; margin: 0.4rem 0 0; }
    input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--teal); border: 3px solid var(--rm-surface, #fff); box-shadow: 0 2px 8px color-mix(in srgb, var(--teal) 45%, transparent); }
    input[type="range"]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--teal); border: 3px solid var(--rm-surface, #fff); }
    input[type="range"]:focus-visible { outline: 2px solid var(--navy); outline-offset: 3px; }

    .word label { font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--rm-muted, #5b6b7d); font-weight: 700; }
    .word input { width: 100%; box-sizing: border-box; margin-top: 0.4rem; padding: 0.6rem 0.8rem; border-radius: 10px; border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); font: inherit; font-size: 0.9rem; }
    .word input:focus-visible { outline: 2px solid var(--navy); outline-offset: 1px; border-color: var(--teal); }
    .word .priv { font-size: 0.68rem; color: var(--rm-muted, #5b6b7d); margin-top: 0.35rem; }
    .word .share { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.55rem; font-size: 0.82rem; font-weight: 400; letter-spacing: normal; text-transform: none; color: var(--rm-text, #1e3a5f); cursor: pointer; }
    .word .share input { width: auto; margin: 0; accent-color: var(--teal); }
    .word .share b { font-weight: 700; }

    .actions { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
    .btn { border: 0; background: var(--navy); color: var(--rm-on-accent, #fff); font: inherit; font-weight: 700; font-size: 0.92rem; padding: 0.7rem 1.3rem; border-radius: 11px; cursor: pointer; }
    .btn:hover:not(:disabled) { filter: brightness(1.08); }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
    .note { font-size: 0.8rem; color: var(--rm-accent-700, var(--teal)); font-weight: 600; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .today { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 1rem; padding: 0.5rem 0.75rem; border-radius: 8px; background: var(--rm-surface-hover, #eef3f5); }
    @media (prefers-reduced-motion: reduce) { .buoy { transition: none; } }
  `;

  constructor() {
    super();
    this.uid = null;
    this._energia = 50;
    this._animo = 50;
    this._carga = 50;
    this._rumbo = 50;
    this._tripulacion = 50;
    this._reconocimiento = 50;
    this._palabra = '';
    this._shareWord = false;
    this._loading = false;
    this._saving = false;
    this._savedToday = false;
    this._error = '';
    this._loadedFor = null;
  }

  updated(changed) {
    if (changed.has('uid') && this.uid && this.uid !== this._loadedFor) {
      this._loadedFor = this.uid;
      this._loadToday();
    }
  }

  async _loadToday() {
    this._loading = true;
    this._error = '';
    try {
      const pulse = await getMyPulse(this.uid);
      if (pulse) {
        this._energia = pulse.energia ?? 50;
        this._animo = pulse.animo ?? 50;
        this._carga = pulse.carga ?? 50;
        this._rumbo = pulse.rumbo ?? 50;
        this._tripulacion = pulse.tripulacion ?? 50;
        this._reconocimiento = pulse.reconocimiento ?? 50;
        this._palabra = pulse.palabra ?? '';
        this._shareWord = pulse.shareWord === true;
        this._savedToday = true;
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar tu marea de hoy.';
    } finally {
      this._loading = false;
    }
  }

  /** Coloca la boya desde un evento de puntero (energía = vertical invertido). */
  _placeFromPointer(e) {
    const r = this.renderRoot.querySelector('.grid').getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    this._animo = Math.round(x * 100);
    this._energia = Math.round((1 - y) * 100);
  }

  _onGridKey(e) {
    const map = { ArrowLeft: ['_animo', -6], ArrowRight: ['_animo', 6], ArrowUp: ['_energia', 6], ArrowDown: ['_energia', -6] };
    const step = map[e.key];
    if (!step) return;
    e.preventDefault();
    this[step[0]] = Math.min(100, Math.max(0, this[step[0]] + step[1]));
  }

  async _save() {
    if (!this.uid) return;
    this._saving = true;
    this._error = '';
    try {
      await saveMyPulse(this.uid, {
        energia: this._energia, animo: this._animo, carga: this._carga,
        rumbo: this._rumbo, tripulacion: this._tripulacion,
        reconocimiento: this._reconocimiento, palabra: this._palabra,
        shareWord: this._shareWord,
      });
      this._savedToday = true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar tu marea.';
    } finally {
      this._saving = false;
    }
  }

  _saveLabel() {
    if (this._saving) return 'Guardando…';
    return this._savedToday ? 'Ajustar mi marea' : 'Fijar mi marea';
  }

  render() {
    const read = pulseReading(this._energia, this._animo);
    let dragging = false;
    return html`
      <p class="lead">Coloca tu boya según tu <b>energía</b> y tu <b>ánimo</b>, y ajusta las cuatro anclas. No hay respuesta correcta: una marea sube y baja.</p>
      ${this._savedToday ? html`<p class="today">Ya registraste tu marea hoy · puedes ajustarla hasta medianoche.</p>` : null}
      <div class="fill">
        <div class="gridwrap">
          <div class="axis">▲ Más energía</div>
          <div class="gridrow">
            <div class="axis-side">A la contra · Ánimo · Apacible</div>
            <div class="grid" role="slider" tabindex="0" aria-label="Energía y ánimo"
              aria-valuetext=${read.name}
              @pointerdown=${(e) => { dragging = true; e.currentTarget.setPointerCapture(e.pointerId); this._placeFromPointer(e); }}
              @pointermove=${(e) => { if (dragging) this._placeFromPointer(e); }}
              @pointerup=${() => { dragging = false; }}
              @keydown=${(e) => this._onGridKey(e)}>
              <div class="cross h"></div>
              <div class="cross v"></div>
              <span class="q tl">Mar de fondo</span>
              <span class="q tr">Viento a favor</span>
              <span class="q bl">Calma chicha</span>
              <span class="q br">Fondeado</span>
              <div class="buoy" style="left:${this._animo}%;top:${100 - this._energia}%"></div>
            </div>
          </div>
          <div class="axis dim">▼ Menos energía</div>
          <div class="reading"><span class="r-name">${read.name}</span><span class="r-sub">${read.sub}</span></div>
        </div>

        <div class="anchors">
          ${ANCHORS.map((a) => html`
            <div class="anchor">
              <span class="a-name">${a.name}</span>
              <input type="range" min="0" max="100" .value=${String(this[`_${a.key}`])}
                aria-label=${`${a.name}: de ${a.lo} a ${a.hi}`}
                @input=${(e) => { this[`_${a.key}`] = Number(e.target.value); }} />
              <div class="a-ends"><span>${a.lo}</span><span>${a.hi}</span></div>
            </div>
          `)}
          <div class="word">
            <label for="w">Una palabra para tu semana</label>
            <input id="w" type="text" maxlength="40" placeholder="p. ej. remando, en calma, a tope…"
              .value=${this._palabra} @input=${(e) => { this._palabra = e.target.value; }} />
            <label class="share">
              <input type="checkbox" .checked=${this._shareWord}
                @change=${(e) => { this._shareWord = e.target.checked; }} />
              <span>Compartir mi palabra en la nube <b>anónima</b> del equipo</span>
            </label>
            <div class="priv">
              ${this._shareWord
                ? 'Aparecerá sin tu nombre, junto a las de tu equipo (solo si responden 3 o más).'
                : 'Privada: solo para ti — puede servirte en tu próximo O2O.'}
            </div>
          </div>
          <div class="actions">
            <button class="btn" ?disabled=${this._saving || this._loading || !this.uid} @click=${() => this._save()}>
              ${this._saveLabel()}
            </button>
            ${this._savedToday && !this._saving ? html`<span class="note">✓ Marea registrada</span>` : null}
            ${this._error ? html`<span class="error">${this._error}</span>` : null}
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('marea-fill')) {
  customElements.define('marea-fill', MareaFill);
}
