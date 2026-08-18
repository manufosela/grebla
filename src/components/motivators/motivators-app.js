/**
 * <motivators-app> — shell de un juego de motivadores (Moving o Affective, según el
 * atributo `deck`). Pestañas según rol; en esta fase, «Jugar» (el tablero). El
 * cliente inyecta persistence, identity (jugador), round (ronda abierta) e isAdmin.
 * Las demás pestañas (Mis resultados, Resultados, Rondas) se añaden en fases
 * siguientes.
 */
import { LitElement, html, css } from 'lit';
import '../common/busy-overlay.js';
import { toolShellStyles, toolDisclaimer } from '../shared/toolShellStyles.js';
import { getDeck } from '../../tools/motivators/domain/decks.js';
import { saveSession, getMyHistory } from '../../tools/motivators/application/usecases.js';
import './motivators-board.js';
import './motivators-my-results.js';
import './motivators-aggregates.js';
import './motivators-rounds-admin.js';

export class MotivatorsApp extends LitElement {
  static properties = {
    deck: { type: String },
    persistence: { attribute: false },
    identity: { attribute: false },
    round: { attribute: false },
    isAdmin: { attribute: false },
    canManageRounds: { type: Boolean },
    uid: { type: String },
    rounds: { attribute: false },
    leaderNames: { attribute: false },
    error: { state: true },
    view: { state: true },
    _saved: { state: true },
    _busy: { state: true },
    _myRoundSession: { state: true },
    _replaying: { state: true },
    _loadingMine: { state: true },
  };

  static styles = [toolShellStyles, css`
    .state { color: var(--rm-muted, #5b6b7d); font-size: 0.95rem; padding: 1rem 0; }
    .done {
      border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--rm-success, #16a34a);
      background: var(--rm-surface-hover, #eef3f5); border-radius: 10px; padding: 0.9rem 1.1rem; margin: 0.5rem 0;
    }
    .done h3 { margin: 0 0 0.3rem; font-size: 1rem; color: var(--rm-text, #111827); }
    .done p { margin: 0; color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .again { margin-top: 0.75rem; border: 1px solid var(--rm-accent, #2a9d8f); background: transparent;
      color: var(--rm-accent, #2a9d8f); border-radius: 8px; padding: 0.4rem 0.9rem; font: inherit; font-weight: 700; cursor: pointer; }
    .round-name { font-weight: 700; color: var(--rm-text, #111827); }
    .error { color: var(--rm-danger, #dc2626); }
  `];

  constructor() {
    super();
    this.deck = 'moving_motivators';
    this.persistence = null;
    this.identity = null;
    this.round = null;
    this.isAdmin = false;
    this.uid = '';
    this.rounds = [];
    this.leaderNames = {};
    this.error = '';
    this.view = '';
    this._saved = false;
    this._busy = false;
    /** Mi sesión ya guardada de la ronda abierta (o null si no he jugado). */
    this._myRoundSession = null;
    /** ¿He pulsado «Volver a ordenar» para rehacer aunque ya jugara? */
    this._replaying = false;
    this._loadingMine = false;
    this._checkedFor = null;
  }

  updated(changed) {
    if (changed.has('round') || changed.has('uid') || changed.has('persistence') || changed.has('deck')) {
      this._loadMyRoundSession();
    }
  }

  /**
   * Comprueba si ya tengo orden guardado para la ronda ABIERTA (leyendo mi
   * histórico, que las reglas permiten filtrar por uid). Así «Jugar» puede
   * avisar en vez de mostrar el tablero vacío como si no hubiera jugado.
   */
  async _loadMyRoundSession() {
    const key = this.round && this.uid && this.persistence && this._canPlay
      ? `${this.deck}:${this.round.id}:${this.uid}`
      : '';
    if (key === this._checkedFor) return;
    this._checkedFor = key;
    // Reset al cambiar de ronda/jugador.
    this._myRoundSession = null;
    this._replaying = false;
    this._saved = false;
    if (!key) return;
    this._loadingMine = true;
    try {
      const history = await getMyHistory(this.persistence, this.uid, this.deck);
      // Si mientras cargaba cambió la ronda/jugador, esta respuesta es vieja: se
      // descarta para no pisar el estado de la ronda actual (condición de carrera).
      if (this._checkedFor !== key) return;
      this._myRoundSession = history.find((s) => s.roundId === this.round.id) ?? null;
    } catch {
      if (this._checkedFor === key) this._myRoundSession = null; // ante error, dejar jugar
    } finally {
      if (this._checkedFor === key) this._loadingMine = false;
    }
  }

  get _deck() {
    try { return getDeck(this.deck); } catch { return null; }
  }

  get _canPlay() { return !!this.identity; }

  /** Clave del borrador local del tablero: única por juego, ronda y usuario. */
  get _draftKey() {
    if (!this.round || !this.uid) return '';
    return `motiv-draft:${this.deck}:${this.round.id}:${this.uid}`;
  }

  get _tabs() {
    const tabs = [];
    if (this._canPlay) tabs.push({ id: 'play', label: 'Jugar' }, { id: 'mine', label: 'Mis resultados' });
    tabs.push({ id: 'results', label: 'Resultados' });
    // Rondas: superadmin o gestor por política de la herramienta (RMR-TSK-0388).
    if (this.isAdmin || this.canManageRounds) tabs.push({ id: 'rounds', label: 'Rondas' });
    return tabs;
  }

  /** Vista efectiva: la seleccionada si es válida, o la primera pestaña disponible. */
  get _view() {
    const tabs = this._tabs;
    return tabs.some((t) => t.id === this.view) ? this.view : (tabs[0]?.id ?? 'results');
  }

  get disclaimer() {
    return html`Es una <strong>reflexión personal</strong>: no hay respuestas buenas ni malas. Tu orden es privado; solo se comparten resultados <strong>agregados de equipo</strong>, nunca para evaluar a una persona.`;
  }

  async _onFinalize(e) {
    if (this._busy || !this.persistence || !this.round || !this.identity) return;
    this._busy = true;
    this.error = '';
    try {
      await saveSession(this.persistence, { round: this.round, identity: this.identity, orden: e.detail.orden });
      this._saved = true;
      this._replaying = false;
      // Deja constancia de que ya hay orden de esta ronda (por si luego rehace y cancela).
      this._myRoundSession = { roundId: this.round.id };
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar tu orden.';
    } finally {
      this._busy = false;
    }
  }

  _renderPlay() {
    const deck = this._deck;
    if (!deck) return html`<p class="state error">Juego no válido.</p>`;
    if (!this._canPlay) return html`<p class="state">Este juego lo juegan ingenieros y managers del equipo.</p>`;
    if (!this.round) return html`<p class="state">No hay ninguna ronda abierta ahora mismo. Vuelve cuando se active la próxima.</p>`;
    if (this._loadingMine) return html`<p class="state">Cargando…</p>`;
    // Ya jugada esta ronda (guardada ahora o en una sesión anterior): en vez del
    // tablero vacío, se avisa y se ofrece rehacer (sobrescribe al guardar).
    if ((this._saved || this._myRoundSession) && !this._replaying) {
      const justSaved = this._saved;
      return html`<div class="done">
        <h3>${justSaved ? '¡Guardado! 🎉' : 'Ya jugaste esta ronda ✓'}</h3>
        <p>${justSaved
          ? html`Tu orden para <span class="round-name">${this.round.name}</span> se ha registrado. Puedes revisarlo cuando quieras.`
          : html`Ya registraste tu orden para <span class="round-name">${this.round.name}</span>. Puedes verlo en «Mis resultados». Si vuelves a ordenar, reemplazarás tu respuesta anterior.`}</p>
        <button class="again" @click=${() => { this._replaying = true; }}>Volver a ordenar</button>
      </div>`;
    }
    const err = this.error ? html`<p class="state error">${this.error}</p>` : null;
    return html`
      <p class="state">Ronda abierta: <span class="round-name">${this.round.name}</span></p>
      <motivators-board .deck=${deck} storageKey=${this._draftKey} @finalize=${this._onFinalize}></motivators-board>
      ${err}`;
  }

  _renderView() {
    const view = this._view;
    if (view === 'play') return this._renderPlay();
    if (view === 'mine') {
      return html`<motivators-my-results .persistence=${this.persistence} .deck=${this._deck}
        uid=${this.uid} .rounds=${this.rounds}></motivators-my-results>`;
    }
    if (view === 'rounds') {
      return html`<motivators-rounds-admin .persistence=${this.persistence} game=${this.deck}
        accent=${this._deck?.accent ?? 'teal'} createdBy=${this.uid}></motivators-rounds-admin>`;
    }
    return html`<motivators-aggregates .persistence=${this.persistence} .deck=${this._deck}
      .leaderNames=${this.leaderNames} .rounds=${this.rounds}></motivators-aggregates>`;
  }

  render() {
    if (this.error && !this.persistence) return html`<p class="error">${this.error}</p>`;
    const view = this._view;
    return html`
      ${this._busy ? html`<busy-overlay message="Guardando tu resultado…"></busy-overlay>` : null}
      <nav class="tabs">
        ${this._tabs.map((t) => html`<button class="tab ${view === t.id ? 'active' : ''}"
          @click=${() => { this.view = t.id; }}>${t.label}</button>`)}
      </nav>
      ${toolDisclaimer(this.disclaimer)}
      ${this._renderView()}
    `;
  }
}

if (!customElements.get('motivators-app')) {
  customElements.define('motivators-app', MotivatorsApp);
}
