/**
 * <motivators-app> — shell de un juego de motivadores (Moving o Affective, según el
 * atributo `deck`). Pestañas según rol; en esta fase, «Jugar» (el tablero). El
 * cliente inyecta persistence, identity (jugador), round (ronda abierta) y role.
 * Las demás pestañas (Mis resultados, Resultados, Rondas) se añaden en fases
 * siguientes.
 */
import { LitElement, html, css } from 'lit';
import { toolShellStyles, toolDisclaimer } from '../shared/toolShellStyles.js';
import { getDeck } from '../../tools/motivators/domain/decks.js';
import { saveSession } from '../../tools/motivators/application/usecases.js';
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
    role: { type: String },
    uid: { type: String },
    rounds: { attribute: false },
    leaderNames: { attribute: false },
    error: { state: true },
    view: { state: true },
    _saved: { state: true },
    _busy: { state: true },
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
    this.role = '';
    this.uid = '';
    this.rounds = [];
    this.leaderNames = {};
    this.error = '';
    this.view = '';
    this._saved = false;
    this._busy = false;
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
    if (this.role === 'superadmin') tabs.push({ id: 'rounds', label: 'Rondas' });
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
    if (this._saved) {
      return html`<div class="done">
        <h3>¡Guardado! 🎉</h3>
        <p>Tu orden para <span class="round-name">${this.round.name}</span> se ha registrado. Puedes revisarlo cuando quieras.</p>
        <button class="again" @click=${() => { this._saved = false; }}>Volver a ordenar</button>
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
