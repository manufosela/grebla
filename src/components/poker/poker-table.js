/**
 * <poker-table> — la mesa de una sesión de Scrum Poker (RMR-TSK-0321). Juego de
 * voto simple: al entrar ves el mazo y votas en oculto; el manager o cualquiera
 * pulsa «Mostrar votos» y se ven todas las cartas con el nombre de cada persona;
 * el manager puede «Volver a votar» para reiniciar. Sin temas ni tareas.
 *
 * Todo en tiempo real: se suscribe a la sesión y a la presencia siempre, y a los
 * votos SOLO cuando la sesión está revelada (antes, las reglas no dejan leer la
 * colección entera). Limpia las suscripciones al desmontar.
 *
 * Props: sessionId, uid, authorName (nombre para la presencia), canManage (dueño).
 */
import { LitElement, html, css } from 'lit';
import { deckOf, cardLabel, SPLIT_CARD } from '../../tools/poker/domain/deck.js';
import { magnitudeCard, axesAvailable, COMPLEXITY_LEVELS, EFFORT_LEVELS } from '../../tools/poker/domain/magnitude.js';
import { normalizeLinearRef, findLinearRef } from '../../tools/poker/domain/reference.js';
import '../app-modal.js';
import { currentTask, closeTask, appendTask } from '../../tools/poker/domain/tasks.js';

/**
 * Dos formas de votar (RMR-TSK-0516): por complejidad × esfuerzo —el cuadro del
 * taller da la carta— o eligiendo la carta directamente. Los ejes van primero:
 * el cuadro está para que cada uno llegue a su número por el mismo camino que
 * los demás, y no a ojo.
 */
/** Pestañas del organizador (RMR-TSK-0523): la mesa y la lista de tareas. */
const ORG_TABS = Object.freeze([
  Object.freeze({ id: 'mesa', label: 'Mesa' }),
  Object.freeze({ id: 'tareas', label: 'Tareas' }),
]);
const VOTE_TABS = Object.freeze([
  Object.freeze({ id: 'ejes', label: 'Complejidad y esfuerzo' }),
  Object.freeze({ id: 'carta', label: 'Carta directa' }),
]);
import { isSpectator, hasSkippedRound } from '../../tools/poker/domain/tally.js';
import { cardStates, allActiveVoted } from '../../tools/poker/domain/table.js';
import {
  joinSession, castVote, reveal, revote, getMyVote, setVoteTitle, recordAgreement,
  fetchLinearIssue, setVoteRef, showIssue, setIssueOpen, getSession, setSessionTasks, closeCurrentTask, finishSession,
  watchSession, watchPlayers, watchVotes,
  setSpectator, skipRound, unskipRound,
} from '../../lib/poker.js';

export class PokerTable extends LitElement {
  static properties = {
    sessionId: { attribute: false },
    uid: { attribute: false },
    authorName: { attribute: false },
    canManage: { attribute: false },
    _session: { state: true },
    _players: { state: true },
    _votes: { state: true },
    _myVote: { state: true },
    _voteTab: { state: true },
    _axisC: { state: true },
    _axisE: { state: true },
    _refDraft: { state: true },
    _refBusy: { state: true },
    _taskDraft: { state: true },
    _orgTab: { state: true },
    _issueDismissed: { state: true },
    _titleDraft: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); }
    button { font: inherit; cursor: pointer; border-radius: 8px; border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); padding: 0.45rem 0.85rem; font-weight: 600; }
    button:hover:not(:disabled) { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    button.primary { background: var(--teal); border-color: var(--teal); color: var(--rm-on-accent, #fff); }
    button.primary:hover:not(:disabled) { color: var(--rm-on-accent, #fff); filter: brightness(1.06); }
    button:disabled { opacity: 0.5; cursor: default; }
    .deck { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.3rem 0 0.8rem; }
    .card { width: 3rem; height: 4rem; font-size: 1.05rem; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0; }
    .card.picked { background: var(--teal); border-color: var(--teal); color: var(--rm-on-accent, #fff); transform: translateY(-4px); box-shadow: 0 6px 14px color-mix(in srgb, var(--teal) 30%, transparent); }
    /* Cómo votar: pestañas (RMR-TSK-0516), mismo patrón que la lista de sesiones. */
    .tabs { display: inline-flex; gap: 0.25rem; padding: 0.28rem; background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; margin: 0.2rem 0 0.8rem; }
    .tab { background: none; border: 0; padding: 0.5rem 1.15rem; font: inherit; font-weight: 600; font-size: 0.9rem; color: var(--rm-muted, #5b6b7d); cursor: pointer; border-radius: 9px; transition: background 0.12s, color 0.12s, box-shadow 0.12s; }
    .tab:hover { color: var(--teal); }
    .tab.on { background: var(--teal); color: var(--rm-on-accent, #fff); box-shadow: 0 1px 4px rgba(42,157,143,0.4); }
    /* El hover genérico de los botones pondría el texto verde sobre verde: la activa sigue en blanco. */
    .tab.on:hover:not(:disabled) { color: var(--rm-on-accent, #fff); border-color: transparent; }
    .axis { display: grid; grid-template-columns: 6.5rem auto 1fr; gap: 0.3rem 0.8rem; align-items: center; margin: 0.3rem 0; }
    .axis-name { font-weight: 700; color: var(--rm-text, #1e3a5f); font-size: 0.9rem; }
    .levels { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .level { width: 2.4rem; height: 2.4rem; font-size: 0.95rem; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0; }
    .level.picked { background: var(--teal); border-color: var(--teal); color: var(--rm-on-accent, #fff); }
    .axis-text { color: var(--rm-muted, #5b6b7d); font-size: 0.82rem; min-height: 1.2em; }
    @media (max-width: 700px) { .axis { grid-template-columns: 6.5rem 1fr; } .axis-text { grid-column: 2; } }
    .magnitude { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; margin: 0.9rem 0 1.3rem; }
    .card.result { cursor: default; border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .card.result.split { border-style: dashed; color: var(--rm-muted, #5b6b7d); }
    .magnitude-text { color: var(--rm-text, #1e3a5f); font-size: 0.9rem; }
    .axes { font-size: 0.72rem; font-weight: 700; color: var(--rm-muted, #5b6b7d); font-variant-numeric: tabular-nums; }
    /* La mesa (RMR-TSK-0523): una carta por persona, a todo el ancho. */
    .seats { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.8rem, 1fr)); gap: 1rem 0.8rem; margin: 0.8rem 0 1rem; }
    .seat { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; min-width: 0; }
    .seat-name { font-size: 0.82rem; color: var(--rm-text, #1e3a5f); text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .flip { position: relative; width: 5.4rem; height: 7.6rem; perspective: 700px; }
    .flip .face { position: absolute; inset: 0; border-radius: 12px; border: 3px solid var(--rm-border, #dde7ec); backface-visibility: hidden; transition: transform 0.5s, border-color 0.2s, background 0.2s; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; }
    .flip .back { background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--teal) 18%, var(--rm-surface, #fff)) 0 6px, color-mix(in srgb, var(--teal) 8%, var(--rm-surface, #fff)) 6px 12px); }
    .flip .back-mark { font-size: 1.6rem; color: color-mix(in srgb, var(--teal) 55%, transparent); }
    .flip .front { background: var(--rm-surface, #fff); transform: rotateY(180deg); color: var(--rm-text, #1e3a5f); }
    .flip .value { font-size: 1.7rem; font-weight: 800; }
    .flip.voted .back { border-color: #2e9e5b; box-shadow: 0 0 0 3px color-mix(in srgb, #2e9e5b 25%, transparent); }
    .flip.up .back { transform: rotateY(180deg); }
    .flip.up .front { transform: rotateY(0); }
    .flip.tone-agree .front { background: #d9f3e3; border-color: #2e9e5b; }
    .flip.tone-low .front, .flip.tone-high .front { background: #fbe0e0; border-color: #c0392b; }
    .flip.tone-empty .front { color: var(--rm-muted, #5b6b7d); border-style: dashed; }
    .bar { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin: 0.8rem 0; }
    .verdict { border: 1px solid var(--rm-border, #dde7ec); border-radius: 10px; padding: 0.7rem 1rem; background: var(--rm-surface-hover, #f6f9fa); margin: 0.4rem 0 0.8rem; }
    .verdict.agree { border-color: #2e9e5b; background: #edf9f1; }
    .verdict .headline { font-size: 1rem; font-weight: 700; color: var(--rm-text, #1e3a5f); margin: 0; }
    .verdict .bar { margin: 0.5rem 0 0; }
    .results li.current { border-color: var(--teal); background: color-mix(in srgb, var(--teal) 8%, transparent); }
    .dist { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .dist .chip { font-size: 0.82rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px; background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #dde7ec); color: var(--rm-text, #1e3a5f); }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; margin: 0.2rem 0 0.6rem; }
    .error { color: #b42318; font-size: 0.85rem; }
    /* Lo ya estimado en esta sesión: el recorrido, no solo el último número. */
    .agreements { margin-top: 1.1rem; border-top: 1px solid var(--rm-border, #dde7ec); padding-top: 0.8rem; }
    .agreements h3 { margin: 0 0 0.5rem; font-size: 0.9rem; color: var(--rm-navy, #1e3a5f); }
    .agreements ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .agreements li { display: flex; align-items: baseline; gap: 0.6rem; font-size: 0.88rem; }
    .est-input { width: 5rem; padding: 0.4rem 0.6rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
    /* El título es texto, no un número: necesita sitio para leerse entero. */
    #vt.est-input { width: min(28rem, 100%); }
    .ref-input { width: 7.5rem; text-transform: uppercase; }
    .task-input { width: min(24rem, 100%); }
    .muted { color: var(--rm-muted, #5b6b7d); font-weight: 400; }
    .finished h3 { margin: 0.2rem 0 0.6rem; font-size: 1.05rem; color: var(--rm-text, #1e3a5f); }
    .results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .results li { display: flex; align-items: baseline; gap: 0.7rem; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #eef0f2); border-radius: 8px; font-size: 0.92rem; }
    .results .est { min-width: 2.2rem; text-align: center; font-weight: 800; color: var(--rm-accent-700, var(--teal)); }
    .results .qtitle { color: var(--rm-text, #1e3a5f); }
    /* La referencia va con su etiqueta: si la fila no cabe, saltan juntas. */
    .ref-field { display: inline-flex; align-items: center; gap: 0.6rem; white-space: nowrap; }
    .ref { font-size: 0.78rem; font-weight: 700; color: var(--rm-accent-700, var(--teal)); text-decoration: none; white-space: nowrap; }
    a.ref:hover { text-decoration: underline; }
    /* La historia de Linear va en un modal para todos (RMR-TSK-0524). */
    .issue { display: flex; flex-direction: column; gap: 0.5rem; }
    .issue-meta { margin: 0; font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); }
    .issue-desc { margin: 0.3rem 0 0; white-space: pre-wrap; word-break: break-word; font: inherit; font-size: 0.9rem; line-height: 1.5; color: var(--rm-text, #1e3a5f); max-height: 55vh; overflow: auto; }
    .title-bar { justify-content: space-between; margin: 0.2rem 0 0.4rem; }
    .title-bar .lead { margin: 0; }
    .act { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; padding: 0.25rem 0.7rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .act:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; margin: 0 0 0.9rem; font-size: 0.86rem; color: var(--rm-text, #1e3a5f); }
    .ctl { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; }
    .ctl-btn { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d); border-radius: 8px; padding: 0.3rem 0.75rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
    .ctl-btn:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .state.out { background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); font-style: italic; }
  `;

  constructor() {
    super();
    this.sessionId = null;
    this.uid = null;
    this.authorName = '';
    this.canManage = false;
    this._session = null;
    this._players = [];
    this._votes = [];
    this._myVote = null;
    // Cómo votar: null = la primera pestaña disponible. Los ejes son de la ronda.
    this._voteTab = null;
    this._axisC = null;
    this._axisE = null;
    // Referencia de Linear de la votación (RMR-TSK-0518): lo escrito y si se está cargando.
    this._refDraft = null;
    this._refBusy = false;
    this._taskDraft = '';
    this._orgTab = 'mesa';
    // La historia que YO he cerrado en mi pantalla (el organizador la cierra para todos).
    this._issueDismissed = null;
    this._titleDraft = '';
    this._error = '';
    this._subs = [];
    this._votesSub = null;
    this._joinedFor = null;
    this._lastRound = null;
  }

  updated(changed) {
    if ((changed.has('sessionId') || changed.has('uid')) && this.sessionId && this.uid) {
      this._enter();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe();
  }

  /** Se une (una vez) y arranca las suscripciones a la sesión y la presencia. */
  async _enter() {
    const key = `${this.sessionId}:${this.uid}`;
    if (key === this._joinedFor) return;
    this._joinedFor = key;
    this._unsubscribe();
    try {
      const session = await getSession(this.sessionId);
      const spectator = this.canManage && session?.ownerVotes === false;
      await joinSession(this.sessionId, this.uid, this.authorName, { spectator });
      const mine = await getMyVote(this.sessionId, this.uid);
      if (mine) this._myVote = mine;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo entrar en la sesión.';
    }
    this._subs = [
      watchSession(this.sessionId, (s, pending) => this._onSession(s, pending), (e) => this._onError(e)),
      watchPlayers(this.sessionId, (p) => { this._players = p; }, (e) => this._onError(e)),
    ];
  }

  _onSession(session, pending = false) {
    this._session = session;
    if (!session) return;
    // Al volver a votar o cambiar de tarea (nueva ronda), la carta elegida deja de valer.
    if (this._lastRound !== null && session.round !== this._lastRound) {
      this._myVote = null;
      this._axisC = null;
      this._axisE = null;
      this._issueDismissed = null;
    }
    this._lastRound = session.round;
    // Suscribirse a los votos SOLO cuando el revelado está CONFIRMADO por el
    // servidor (no en la escritura pendiente): la regla lee `revealed` del
    // servidor, así que suscribirse con el revelado aún local da permission-denied.
    if (session.revealed && !pending && !this._votesSub) {
      this._votesSub = watchVotes(this.sessionId, (v) => { this._votes = v; }, (e) => this._onVotesError(e));
    } else if (!session.revealed && this._votesSub) {
      this._votesSub();
      this._votesSub = null;
      this._votes = [];
    }
  }

  /** Error del listener de votos: un permission-denied es la carrera del revelado
   * (se reintenta con el próximo snapshot confirmado), no un fallo real. */
  _onVotesError(err) {
    if (this._votesSub) { this._votesSub(); this._votesSub = null; }
    if (String(err?.code ?? '').includes('permission-denied')) return;
    this._onError(err);
  }

  _onError(err) {
    this._error = err instanceof Error ? err.message : String(err);
  }

  _unsubscribe() {
    for (const stop of this._subs) stop();
    this._subs = [];
    if (this._votesSub) { this._votesSub(); this._votesSub = null; }
  }

  get _round() { return this._session?.round ?? 1; }
  get _revealed() { return !!this._session?.revealed; }
  get _myVoteValue() { return this._myVote?.round === this._round ? this._myVote.value : null; }
  /** Los ejes de mi voto de ESTA ronda, para rehidratarlos al recargar. */
  get _myAxes() { return this._myVote?.round === this._round ? (this._myVote.axes ?? null) : null; }
  get _axesOn() { return axesAvailable(this._session); }
  get _activeVoteTab() { return this._axesOn ? (this._voteTab ?? 'ejes') : 'carta'; }
  get _myPlayer() { return this._players.find((p) => p.uid === this.uid) ?? null; }
  get _amSpectator() { return isSpectator(this._myPlayer); }
  get _amSkipped() { return hasSkippedRound(this._myPlayer, this._round); }
  get _canIVote() { return !this._revealed && !this._amSpectator && !this._amSkipped; }

  async _toggleSpectator() {
    try { await setSpectator(this.sessionId, this.uid, !this._amSpectator); } catch (err) { this._onError(err); }
  }

  async _toggleSkip() {
    try {
      if (this._amSkipped) await unskipRound(this.sessionId, this.uid);
      else await skipRound(this.sessionId, this.uid, this._round);
    } catch (err) { this._onError(err); }
  }

  async _vote(card, axes = null) {
    if (!this._canIVote) return; // ni revelado, ni observador, ni fuera de ámbito, ni en discusión
    try {
      await castVote(this.sessionId, this.uid, this._round, card, this._session, axes);
      this._myVote = axes ? { value: card, round: this._round, axes } : { value: card, round: this._round };
    } catch (err) { this._onError(err); }
  }

  async _reveal() {
    try { await reveal(this.sessionId); } catch (err) { this._onError(err); }
  }

  async _revote() {
    try { await revote(this.sessionId); } catch (err) { this._onError(err); }
  }

  _renderControls() {
    if (this._revealed) return null;
    return html`<div class="controls">
      <label class="ctl"><input type="checkbox" .checked=${this._amSpectator}
        @change=${() => this._toggleSpectator()} /> Solo ver (no votar)</label>
      ${!this._amSpectator ? html`
        <button class="ctl-btn" @click=${() => this._toggleSkip()}>${this._amSkipped ? 'Volver a la ronda' : 'Fuera de mi ámbito'}</button>` : null}
    </div>`;
  }

  _renderDeck() {
    if (this._revealed) return null;
    if (this._amSpectator) return html`<p class="lead">Estás como observador: no votas en esta sesión.</p>`;
    if (this._amSkipped) return html`<p class="lead">Te has saltado esta ronda (fuera de tu ámbito).</p>`;
    // Sin escalera en el mazo (sesiones antiguas) solo hay carta directa, y una
    // pestaña sola no es una pestaña.
    if (!this._axesOn) return this._renderCards();
    const tab = this._activeVoteTab;
    return html`
      <div class="tabs" role="tablist" aria-label="Cómo votar">
        ${VOTE_TABS.map((t) => html`<button type="button" class="tab ${tab === t.id ? 'on' : ''}"
          role="tab" aria-selected=${tab === t.id ? 'true' : 'false'}
          @click=${() => { this._voteTab = t.id; }}>${t.label}</button>`)}
      </div>
      ${tab === 'ejes' ? this._renderAxes() : this._renderCards()}`;
  }

  _renderCards() {
    const picked = this._myVoteValue;
    return html`
      <p class="lead">Elige tu carta. Nadie ve tu voto hasta que se revele.</p>
      <div class="deck">
        ${deckOf(this._session).map((card) => html`
          <button class="card ${card === picked ? 'picked' : ''}"
            title=${card === SPLIT_CARD ? 'Partir: demasiado grande para estimarla' : ''}
            @click=${() => this._vote(card)}>${cardLabel(card)}</button>`)}
      </div>`;
  }

  /** Un eje del cuadro: cinco niveles y la descripción del elegido. */
  _renderAxis(name, levels, picked, onPick) {
    const elegido = levels.find((n) => n.level === picked);
    return html`<div class="axis" role="group" aria-label=${name}>
      <span class="axis-name">${name}</span>
      <div class="levels">
        ${levels.map((n) => html`<button type="button" class="level ${picked === n.level ? 'picked' : ''}"
          title="${n.text} (${n.example})" aria-pressed=${picked === n.level ? 'true' : 'false'}
          @click=${() => onPick(n.level)}>${n.level}</button>`)}
      </div>
      <span class="axis-text">${elegido ? `${elegido.text} (${elegido.example})` : ''}</span>
    </div>`;
  }

  _renderAxes() {
    const c = this._axisC ?? this._myAxes?.complexity ?? null;
    const e = this._axisE ?? this._myAxes?.effort ?? null;
    return html`
      <p class="lead">Decide qué complejidad y qué esfuerzo te supone; el cuadro te da la carta. Nadie ve tu voto hasta que se revele.</p>
      ${this._renderAxis('Complejidad', COMPLEXITY_LEVELS, c, (n) => { this._axisC = n; })}
      ${this._renderAxis('Esfuerzo', EFFORT_LEVELS, e, (n) => { this._axisE = n; })}
      ${this._renderMagnitude(magnitudeCard(this._session?.scale, c, e), c, e)}`;
  }

  /** La carta que dan los dos ejes, y el botón para emitirla. */
  _renderMagnitude(card, c, e) {
    if (card === null) return html`<p class="lead">Marca los dos ejes para ver tu carta.</p>`;
    const split = card === SPLIT_CARD;
    const votada = this._myVoteValue === card && this._myAxes?.complexity === c && this._myAxes?.effort === e;
    const texto = split ? 'Demasiado grande para estimarla: hay que partirla.' : `Tu carta es ${card}.`;
    const boton = split ? 'Votar «partir»' : `Votar ${card}`;
    return html`<div class="magnitude">
      <span class="card result ${split ? 'split' : ''}" aria-label=${card}>${cardLabel(card)}</span>
      <span class="magnitude-text">${texto}</span>
      <button class="primary" ?disabled=${votada} @click=${() => this._vote(card, { complexity: c, effort: e })}>
        ${votada ? `✓ Votado ${cardLabel(card)}` : boton}
      </button>
    </div>`;
  }

  /** Los asientos y el juicio de la ronda, calculados en el dominio. */
  get _table() {
    const votesByUid = Object.fromEntries(this._votes.map((v) => [v.uid, v]));
    return cardStates({ players: this._players, votesByUid, round: this._round, revealed: this._revealed, deck: deckOf(this._session) });
  }

  /**
   * La mesa (RMR-TSK-0523): una carta boca abajo por persona que vota, con su
   * nombre debajo y borde verde cuando ya ha votado. Al revelar giran y el
   * color cuenta el juicio: verde si coinciden, rojo en la más baja y la más
   * alta. Sin lista de personas ni contador: la mesa ya lo dice.
   */
  _renderSeats() {
    const { seats } = this._table;
    if (seats.length === 0) return html`<p class="lead">Aún no se ha sentado nadie a la mesa.</p>`;
    return html`<div class="seats" aria-label="Cartas de la mesa">
      ${seats.map((s) => html`<div class="seat">
        <div class="flip ${this._revealed ? 'up' : ''} ${s.voted ? 'voted' : ''} tone-${s.tone}" data-uid=${s.uid} aria-label="${s.name}: ${this._seatLabel(s)}">
          <div class="face back"><span class="back-mark" aria-hidden="true">♠</span></div>
          <div class="face front" title=${s.value ?? ''}>
            <span class="value">${s.value === null ? '—' : cardLabel(s.value)}</span>
            ${s.axes ? html`<span class="axes">C${s.axes.complexity}·E${s.axes.effort}</span>` : null}
          </div>
        </div>
        <span class="seat-name">${s.name}</span>
      </div>`)}
    </div>`;
  }

  _seatLabel(s) {
    if (!this._revealed) return s.voted ? 'ha votado' : 'pensando';
    if (s.value === null) return 'sin voto';
    return { agree: 'acuerdo', low: 'la más baja', high: 'la más alta' }[s.tone] ?? s.value;
  }

  /**
   * El juicio y lo que puede hacer el organizador: destapar cuando han votado
   * todos, volver a votar si no hay acuerdo, o cerrar la tarea si lo hay.
   */
  _renderVerdict() {
    const { seats, verdict } = this._table;
    if (!this._revealed) {
      if (!this.canManage) return null;
      const listos = allActiveVoted(this._players, this._round);
      return html`<div class="bar">
        <button class="primary" @click=${() => this._reveal()} ?disabled=${!listos}
          title=${listos ? '' : 'Cuando hayan votado todos'}>Mostrar votos</button>
      </div>`;
    }
    const conValor = seats.filter((s) => s.value !== null);
    let texto = 'Nadie ha puesto una carta que diga algo todavía.';
    if (verdict?.consensus) texto = `¡Acuerdo! Todas las cartas dicen ${verdict.agreed}.`;
    else if (verdict?.lowest !== null && conValor.length > 0) texto = `Más baja ${verdict.lowest} · más alta ${verdict.highest}. Hablad la diferencia y volved a votar.`;
    return html`<div class="verdict ${verdict?.consensus ? 'agree' : ''}">
      <p class="headline">${texto}</p>
      ${this._renderVerdictActions(verdict)}
    </div>`;
  }

  /**
   * Cerrar la votación con el valor acordado (RMR-TSK-0482). Solo con TODAS
   * las cartas iguales y con significado: sin unanimidad no se cierra por
   * mayoría ni por la media, se vuelve a votar.
   */
  _renderVerdictActions(verdict) {
    if (!this.canManage) return null;
    if (!verdict?.consensus) {
      return html`<div class="bar"><button class="primary" @click=${() => this._revote()}>Volver a votar</button></div>`;
    }
    const etiqueta = this._currentTask
      ? `Nueva votación (queda ${cardLabel(verdict.agreed)})`
      : `Guardar ${verdict.agreed}${this._voteTitle ? ` para «${this._voteTitle}»` : ''}`;
    return html`<div class="bar">
      <button class="primary" @click=${() => this._recordAgreement(verdict.agreed)}>${etiqueta}</button>
    </div>`;
  }

  get _voteTitle() { return this._session?.voteTitle ?? ''; }

  async _recordAgreement(value) {
    try {
      await recordAgreement(this.sessionId, { title: this._shownTitle, ref: this._voteRef, value, round: this._round });
      this._titleDraft = '';
      this._refDraft = null;
      const task = this._currentTask;
      if (task) {
        // La tarea queda con su valor y se pasa a la siguiente con ronda limpia (RMR-TSK-0522).
        const { tasks, nextId } = closeTask(this._tasks, task.id, value);
        await closeCurrentTask(this.sessionId, tasks, nextId);
      } else {
        await revote(this.sessionId);
      }
    } catch (err) { this._onError(err); }
  }

  /** Sin tarea actual: el organizador añade la siguiente o termina la sesión. */
  _renderNextTask() {
    return html`<div class="bar">
      <span class="lead">No queda ninguna tarea por estimar.</span>
      <input class="est-input task-input" type="text" maxlength="160" placeholder="Añadir otra tarea…"
        .value=${this._taskDraft} @input=${(e) => { this._taskDraft = e.target.value; }}
        @keydown=${(e) => { if (e.key === 'Enter') this._addTask(); }} />
      <button @click=${() => this._addTask()} ?disabled=${!this._taskDraft.trim()}>Añadir tarea</button>
      <button class="primary" @click=${() => this._finish()}>Terminar sesión</button>
    </div>`;
  }

  async _addTask() {
    const { tasks, task } = appendTask(this._tasks, this._taskDraft);
    if (!task) return;
    try {
      await setSessionTasks(this.sessionId, tasks, this._currentTask?.id ?? task.id);
      this._taskDraft = '';
    } catch (err) { this._onError(err); }
  }

  async _finish() {
    try { await finishSession(this.sessionId); } catch (err) { this._onError(err); }
  }

  /** La sesión terminada: la lista de tareas con su valor, en lugar de la mesa. */
  _renderFinished() {
    return html`<div class="finished">
      <h3>Sesión terminada</h3>
      <ol class="results">
        ${this._tasks.map((task) => html`<li>
          <span class="est">${task.value == null ? '—' : cardLabel(task.value)}</span>
          <span class="qtitle">${task.title}</span>
        </li>`)}
      </ol>
      ${this._tasks.length === 0 ? html`<p class="lead">No se estimó ninguna tarea.</p>` : null}
    </div>`;
  }

  /** Qué se está estimando ahora mismo: lo escribe quien coordina. */
  get _voteRef() { return this._session?.voteRef ?? ''; }
  get _voteIssue() { return this._session?.voteIssue ?? null; }
  get _tasks() { return this._session?.tasks ?? []; }
  get _currentTask() { return currentTask(this._session); }
  get _finished() { return this._session?.status === 'finished'; }
  /** Lo que se enseña como «qué se estima»: la tarea actual, el título, o el de la historia de Linear. */
  get _shownTitle() { return this._currentTask?.title || this._voteTitle || this._voteIssue?.title || ''; }

  _renderVoteTitle() {
    const task = this._currentTask;
    if (!this.canManage) {
      const t = this._shownTitle;
      return t ? html`<p class="lead">Estimando: <strong>${t}</strong>${this._voteRef ? html` <span class="ref">${this._voteRef}</span>` : null}</p>` : null;
    }
    // Con lista de tareas (RMR-TSK-0522) la actual es el título; sin tarea
    // actual, el organizador añade otra o termina.
    if (task) {
      return html`<div class="bar title-bar">
        <p class="lead">Estimando: <strong>${task.title}</strong> <span class="muted">(${this._tasks.filter((x) => x.value != null).length}/${this._tasks.length})</span></p>
        ${this._renderIssueButton(findLinearRef(task.title))}
      </div>`;
    }
    if (this._tasks.length) return this._renderNextTask();
    return html`<div class="bar">
      <label class="lead" for="vt">Qué se estima:</label>
      <input id="vt" class="est-input" type="text" maxlength="120"
        placeholder="p. ej. «Migrar el login a OAuth»"
        .value=${this._titleDraft || this._voteTitle}
        @input=${(e) => { this._titleDraft = e.target.value; }}
        @change=${() => this._saveTitle()} />
      <span class="ref-field">
        <label class="lead" for="vr">Ref. Linear:</label>
        <input id="vr" class="est-input ref-input" type="text" maxlength="16" placeholder="BB-1234"
          .value=${this._refDraft ?? this._voteRef}
          ?disabled=${this._refBusy}
          @input=${(e) => { this._refDraft = e.target.value; }}
          @change=${() => this._saveRef()} />
        ${this._refBusy ? html`<span class="lead">Cargando la historia…</span>` : null}
      </span>
    </div>`;
  }

  async _saveTitle() {
    const title = this._titleDraft.trim();
    if (title === this._voteTitle) return;
    try { await setVoteTitle(this.sessionId, title); } catch (err) { this._onError(err); }
  }

  /**
   * Guarda la referencia y trae su ficha (RMR-TSK-0518). Lo que no es una
   * referencia se rechaza aquí, sin llamar a nadie; una referencia que Linear
   * no conoce se dice tal cual y no se guarda: mejor sin ficha que con una
   * inventada.
   */
  async _saveRef() {
    const ref = normalizeLinearRef(this._refDraft ?? this._voteRef);
    if (ref === null) { this._error = 'La referencia debe tener la forma BB-1234.'; return; }
    if (ref === this._voteRef) return;
    this._error = '';
    if (ref === '') {
      try { await setVoteRef(this.sessionId, '', null); this._refDraft = null; } catch (err) { this._onError(err); }
      return;
    }
    this._refBusy = true;
    try {
      const issue = await fetchLinearIssue(ref);
      if (!issue) { this._error = `Linear no conoce ${ref}.`; return; }
      await setVoteRef(this.sessionId, ref, issue);
      this._refDraft = null;
    } catch (err) { this._onError(err); }
    finally { this._refBusy = false; }
  }

  /**
   * El botón de la historia (RMR-TSK-0524): solo el organizador, y solo si el
   * título lleva referencia. Cargar la trae de Linear y la abre en todas las
   * pantallas; después se puede volver a mostrar o cerrar para todos.
   */
  _renderIssueButton(ref) {
    if (!this.canManage || !ref) return null;
    if (this._refBusy) return html`<span class="lead">Cargando la historia…</span>`;
    const cargada = this._voteIssue?.identifier === ref;
    if (!cargada) return html`<button class="act" @click=${() => this._loadIssue(ref)}>Cargar historia ${ref}</button>`;
    return this._issueOpen
      ? html`<button class="act" @click=${() => this._closeIssueForAll()}>Cerrar historia</button>`
      : html`<button class="act" @click=${() => this._openIssueForAll()}>Mostrar historia ${ref}</button>`;
  }

  get _issueOpen() { return this._session?.issueOpen === true; }

  async _loadIssue(ref) {
    this._error = '';
    this._refBusy = true;
    try {
      const issue = await fetchLinearIssue(ref);
      if (!issue) { this._error = `Linear no conoce ${ref}.`; return; }
      await showIssue(this.sessionId, ref, issue);
    } catch (err) { this._onError(err); }
    finally { this._refBusy = false; }
  }

  async _openIssueForAll() {
    this._issueDismissed = null;
    try { await setIssueOpen(this.sessionId, true); } catch (err) { this._onError(err); }
  }

  async _closeIssueForAll() {
    try { await setIssueOpen(this.sessionId, false); } catch (err) { this._onError(err); }
  }

  /** Cerrar el modal: el organizador lo cierra para todos; los demás, solo el suyo. */
  _dismissIssue() {
    if (this.canManage) { this._closeIssueForAll(); return; }
    this._issueDismissed = this._voteIssue?.identifier ?? null;
  }

  /** La historia, en un modal por encima de todo, en todas las pantallas a la vez. */
  _renderIssueModal() {
    const i = this._voteIssue;
    if (!i || !this._issueOpen || this._issueDismissed === i.identifier) return null;
    const meta = [i.state, i.estimate != null ? `estimación ${i.estimate}` : null, i.priority, i.assignee, i.project]
      .filter(Boolean);
    return html`<app-modal .open=${true} size="wide" heading=${`${i.identifier} · ${i.title}`} @close=${() => this._dismissIssue()}>
      <div class="issue" aria-label="Historia de Linear">
        ${i.url ? html`<a class="ref" href=${i.url} target="_blank" rel="noopener">Abrir en Linear ↗</a>` : null}
        ${meta.length ? html`<p class="issue-meta">${meta.join(' · ')}</p>` : null}
        ${i.labels?.length ? html`<div class="dist">${i.labels.map((l) => html`<span class="chip">${l}</span>`)}</div>` : null}
        ${i.description ? html`<pre class="issue-desc">${i.description}</pre>` : html`<p class="lead">Sin descripción.</p>`}
        ${this.canManage ? html`<div class="bar"><button class="primary" @click=${() => this._closeIssueForAll()}>Cerrar para todos</button></div>` : null}
      </div>
    </app-modal>`;
  }

  /** Lo ya acordado en esta sesión: el recorrido, no solo el último número. */
  _renderAgreements() {
    const hechos = this._session?.agreements ?? [];
    if (hechos.length === 0) return null;
    return html`<div class="agreements">
      <h3>Estimado en esta sesión</h3>
      <ul>
        ${hechos.map((a) => html`<li>
          <span class="est">${a.value}</span>
          ${a.ref ? html`<span class="ref">${a.ref}</span>` : null}
          <span class="qtitle">${a.title ?? 'Sin título'}</span>
          ${a.round ? html`<span class="lead">ronda ${a.round}</span>` : null}
        </li>`)}
      </ul>
    </div>`;
  }

  _renderMesa() {
    return html`
      ${this._renderVoteTitle()}
      ${this._renderSeats()}
      ${this._renderVerdict()}
      ${this._renderControls()}
      ${this._renderDeck()}`;
  }

  /** La lista de tareas del organizador: lo estimado, lo pendiente, añadir y terminar. */
  _renderTasksTab() {
    const actual = this._currentTask?.id ?? null;
    return html`<div class="tasks">
      ${this._tasks.length ? html`<ol class="results">
        ${this._tasks.map((task) => html`<li class=${task.id === actual ? 'current' : ''}>
          <span class="est">${task.value == null ? '·' : cardLabel(task.value)}</span>
          <span class="qtitle">${task.title}</span>
          ${task.id === actual ? html`<span class="lead">estimando</span>` : null}
        </li>`)}
      </ol>` : html`<p class="lead">Sin tareas planificadas: se vota con el título de cada votación.</p>`}
      <div class="bar">
        <input class="est-input task-input" type="text" maxlength="160" placeholder="Añadir otra tarea…"
          .value=${this._taskDraft} @input=${(e) => { this._taskDraft = e.target.value; }}
          @keydown=${(e) => { if (e.key === 'Enter') this._addTask(); }} />
        <button @click=${() => this._addTask()} ?disabled=${!this._taskDraft.trim()}>Añadir tarea</button>
        <button class="primary" @click=${() => this._finish()}>Terminar sesión</button>
      </div>
      ${this._renderAgreements()}
    </div>`;
  }

  /** El organizador tiene dos pestañas (Mesa y Tareas); quien vota, solo la mesa. */
  _renderSimple() {
    if (!this.canManage) return this._renderMesa();
    return html`
      <div class="tabs" role="tablist" aria-label="Organizador">
        ${ORG_TABS.map((t) => html`<button type="button" class="tab ${this._orgTab === t.id ? 'on' : ''}"
          role="tab" aria-selected=${this._orgTab === t.id ? 'true' : 'false'}
          @click=${() => { this._orgTab = t.id; }}>${t.label}</button>`)}
      </div>
      ${this._orgTab === 'tareas' ? this._renderTasksTab() : this._renderMesa()}`;
  }

  render() {
    if (!this._session) return html`<p class="lead">Cargando la mesa…</p>`;
    if (this._finished) return this._renderFinished();
    return html`
      ${this._renderSimple()}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._renderIssueModal()}`;
  }
}

if (!customElements.get('poker-table')) {
  customElements.define('poker-table', PokerTable);
}
