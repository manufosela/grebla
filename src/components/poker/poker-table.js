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
import { normalizeLinearRef } from '../../tools/poker/domain/reference.js';

/**
 * Dos formas de votar (RMR-TSK-0516): por complejidad × esfuerzo —el cuadro del
 * taller da la carta— o eligiendo la carta directamente. Los ejes van primero:
 * el cuadro está para que cada uno llegue a su número por el mismo camino que
 * los demás, y no a ojo.
 */
const VOTE_TABS = Object.freeze([
  Object.freeze({ id: 'ejes', label: 'Complejidad y esfuerzo' }),
  Object.freeze({ id: 'carta', label: 'Carta directa' }),
]);
import {
  countActiveVoted, hasVotedThisRound, revealedVotes, judgeVotes,
  isSpectator, hasSkippedRound, activeVoters,
} from '../../tools/poker/domain/tally.js';
import {
  joinSession, castVote, reveal, revote, getMyVote, setVoteTitle, recordAgreement,
  fetchLinearIssue, setVoteRef,
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
    .deck { display: flex; flex-wrap: wrap; gap: 0.55rem; margin: 0.4rem 0 1.3rem; }
    .card { width: 3.2rem; height: 4.4rem; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0; }
    .card.picked { background: var(--teal); border-color: var(--teal); color: var(--rm-on-accent, #fff); transform: translateY(-4px); box-shadow: 0 6px 14px color-mix(in srgb, var(--teal) 30%, transparent); }
    /* Cómo votar: pestañas (RMR-TSK-0516), mismo patrón que la lista de sesiones. */
    .tabs { display: inline-flex; gap: 0.25rem; padding: 0.28rem; background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; margin: 0.2rem 0 0.8rem; }
    .tab { background: none; border: 0; padding: 0.5rem 1.15rem; font: inherit; font-weight: 600; font-size: 0.9rem; color: var(--rm-muted, #5b6b7d); cursor: pointer; border-radius: 9px; transition: background 0.12s, color 0.12s, box-shadow 0.12s; }
    .tab:hover { color: var(--teal); }
    .tab.on { background: var(--teal); color: var(--rm-on-accent, #fff); box-shadow: 0 1px 4px rgba(42,157,143,0.4); }
    .axis { display: grid; grid-template-columns: 7rem 1fr; gap: 0.3rem 0.8rem; align-items: center; margin: 0.4rem 0; }
    .axis-name { font-weight: 700; color: var(--rm-text, #1e3a5f); font-size: 0.9rem; }
    .levels { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .level { width: 2.6rem; height: 2.6rem; font-size: 1rem; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0; }
    .level.picked { background: var(--teal); border-color: var(--teal); color: var(--rm-on-accent, #fff); }
    .axis-text { grid-column: 2; color: var(--rm-muted, #5b6b7d); font-size: 0.82rem; min-height: 1.2em; }
    .magnitude { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; margin: 0.9rem 0 1.3rem; }
    .card.result { cursor: default; border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .card.result.split { border-style: dashed; color: var(--rm-muted, #5b6b7d); }
    .magnitude-text { color: var(--rm-text, #1e3a5f); font-size: 0.9rem; }
    .axes { font-size: 0.72rem; font-weight: 700; color: var(--rm-muted, #5b6b7d); font-variant-numeric: tabular-nums; }
    .players { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .players li { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.65rem; border: 1px solid var(--rm-border, #eef0f2); border-radius: 8px; }
    .players .name { flex: 1; color: var(--rm-text, #1e3a5f); }
    .state { font-size: 0.78rem; font-weight: 700; padding: 0.1rem 0.55rem; border-radius: 999px; }
    .state.voted { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .state.waiting { background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); }
    .reveal-card { min-width: 2.2rem; text-align: center; font-weight: 800; font-size: 1.05rem; color: var(--rm-text, #1e3a5f); }
    .bar { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin: 1.1rem 0; }
    .summary { border: 1px solid var(--rm-border, #dde7ec); border-radius: 10px; padding: 0.9rem 1rem; background: var(--rm-surface-hover, #f6f9fa); margin-top: 0.8rem; }
    .summary .headline { font-size: 1.05rem; font-weight: 700; color: var(--rm-text, #1e3a5f); margin: 0 0 0.5rem; }
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
    /* La referencia va con su etiqueta: si la fila no cabe, saltan juntas. */
    .ref-field { display: inline-flex; align-items: center; gap: 0.6rem; white-space: nowrap; }
    .ref { font-size: 0.78rem; font-weight: 700; color: var(--rm-accent-700, var(--teal)); text-decoration: none; white-space: nowrap; }
    a.ref:hover { text-decoration: underline; }
    /* La historia de Linear al lado de la mesa (RMR-TSK-0518): dos columnas en desktop. */
    .table.with-issue { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, 22rem); gap: 1.6rem; align-items: start; }
    .table > .main { min-width: 0; }
    .issue { border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; padding: 0.9rem 1rem; background: var(--rm-surface-hover, #f6f9fa); position: sticky; top: 1rem; }
    .issue-head h3 { margin: 0.2rem 0 0.4rem; font-size: 1rem; line-height: 1.3; color: var(--rm-text, #1e3a5f); }
    .issue-meta { margin: 0 0 0.5rem; font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); }
    .issue-desc { margin: 0.6rem 0 0; white-space: pre-wrap; word-break: break-word; font: inherit; font-size: 0.86rem; line-height: 1.45; color: var(--rm-text, #1e3a5f); max-height: 60vh; overflow: auto; }
    @media (max-width: 900px) { .table.with-issue { grid-template-columns: 1fr; } .issue { position: static; } }
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
      await joinSession(this.sessionId, this.uid, this.authorName);
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

  /** Lo que se ve de cada jugador: su carta (y sus ejes) al revelar, o su estado mientras se vota. */
  _renderPlayerState(p, vote) {
    const round = this._round;
    const voted = hasVotedThisRound(p, round);
    const spec = isSpectator(p);
    const skip = hasSkippedRound(p, round);
    if (this._revealed) {
      if (spec) return html`<span class="reveal-card">👁</span>`;
      if (!voted || skip) return html`<span class="reveal-card">—</span>`;
      return html`
        ${vote?.axes ? html`<span class="axes" title="complejidad · esfuerzo">C${vote.axes.complexity}·E${vote.axes.effort}</span>` : null}
        <span class="reveal-card" title=${vote?.value ?? ''}>${cardLabel(vote?.value ?? '·')}</span>`;
    }
    if (spec) return html`<span class="state out">solo ve</span>`;
    if (skip) return html`<span class="state out">fuera de ámbito</span>`;
    if (voted) return html`<span class="state voted">✓ votó</span>`;
    return html`<span class="state waiting">pensando…</span>`;
  }

  _renderPlayers() {
    const round = this._round;
    const revealed = this._revealed;
    const byUid = Object.fromEntries(this._votes.map((v) => [v.uid, v]));
    const cards = revealed ? revealedVotes(this._players, byUid, round) : [];
    const voteByUid = Object.fromEntries(cards.map((c) => [c.uid, c]));
    if (!this._players.length) return html`<p class="lead">Aún no se ha unido nadie a la mesa.</p>`;
    return html`
      <ul class="players">
        ${this._players.map((p) => html`<li>
          <span class="name">${p.name || 'Sin nombre'}</span>
          ${this._renderPlayerState(p, voteByUid[p.uid] ?? null)}
        </li>`)}
      </ul>`;
  }

  _renderBar() {
    // Tras revelar: solo el manager puede reiniciar la votación.
    if (this._revealed) {
      return this.canManage
        ? html`<div class="bar"><button class="primary" @click=${() => this._revote()}>Volver a votar</button></div>`
        : null;
    }
    const voted = countActiveVoted(this._players, this._round);
    const total = activeVoters(this._players, this._round).length;
    // «Mostrar votos» lo puede pulsar cualquiera (basta con que haya algún voto).
    return html`<div class="bar">
      <span class="lead">${voted}/${total} han votado</span>
      <button class="primary" @click=${() => this._reveal()} ?disabled=${voted === 0}>Mostrar votos</button>
    </div>`;
  }

  _renderSummary() {
    if (!this._revealed) return null;
    const cards = revealedVotes(this._players, Object.fromEntries(this._votes.map((v) => [v.uid, v])), this._round);
    const s = judgeVotes(cards.map((c) => c.value), deckOf(this._session));
    return html`<div class="summary">
      <p class="headline">${this._headline(s)}</p>
      <div class="dist">
        ${s.distribution.map((d) => html`<span class="chip">${d.value} × ${d.count}</span>`)}
      </div>
      ${this._renderAgreement(s)}
    </div>`;
  }

  /** Qué se dice del reparto de cartas, sin dar por cerrado lo que no lo está. Sin medias (RMR-TSK-0521). */
  _headline(s) {
    if (s.consensus) return `¡Acuerdo! Todas las cartas dicen ${s.agreed}.`;
    if (s.lowest !== null) return `Más baja ${s.lowest} · más alta ${s.highest}`;
    return 'Nadie ha puesto una carta que diga algo todavía.';
  }

  /**
   * Cerrar la votación con el valor acordado (RMR-TSK-0482).
   *
   * Solo aparece si TODAS las cartas coinciden y dicen algo. Sin unanimidad no
   * se ofrece cerrar por mayoría ni por la media: el acuerdo se demuestra
   * votando, y darlo por bueno con un botón es justo lo que hace que nadie
   * vuelva a discutir la diferencia entre un 3 y un 8.
   */
  _renderAgreement(s) {
    if (!this.canManage) return null;
    if (!s.consensus) {
      return html`<p class="lead">Todavía no hay acuerdo: hablad la diferencia y volved a votar.</p>`;
    }
    return html`<div class="bar">
      <button class="primary" @click=${() => this._recordAgreement(s.agreed)}>
        Guardar ${s.agreed}${this._voteTitle ? ` para «${this._voteTitle}»` : ''}
      </button>
    </div>`;
  }

  get _voteTitle() { return this._session?.voteTitle ?? ''; }

  async _recordAgreement(value) {
    try {
      await recordAgreement(this.sessionId, { title: this._shownTitle, ref: this._voteRef, value, round: this._round });
      this._titleDraft = '';
      this._refDraft = null;
      await revote(this.sessionId);
    } catch (err) { this._onError(err); }
  }

  /** Qué se está estimando ahora mismo: lo escribe quien coordina. */
  get _voteRef() { return this._session?.voteRef ?? ''; }
  get _voteIssue() { return this._session?.voteIssue ?? null; }
  /** Lo que se enseña como «qué se estima»: el título, o el de la historia de Linear si no hay. */
  get _shownTitle() { return this._voteTitle || this._voteIssue?.title || ''; }

  _renderVoteTitle() {
    if (!this.canManage) {
      const t = this._shownTitle;
      return t ? html`<p class="lead">Estimando: <strong>${t}</strong>${this._voteRef ? html` <span class="ref">${this._voteRef}</span>` : null}</p>` : null;
    }
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

  /** La ficha de la historia, al lado de la mesa: todos la ven mientras se estima. */
  _renderIssuePanel() {
    const i = this._voteIssue;
    if (!i) return null;
    const meta = [i.state, i.estimate != null ? `estimación ${i.estimate}` : null, i.priority, i.assignee, i.project]
      .filter(Boolean);
    return html`<aside class="issue" aria-label="Historia de Linear">
      <div class="issue-head">
        ${i.url ? html`<a class="ref" href=${i.url} target="_blank" rel="noopener">${i.identifier} ↗</a>` : html`<span class="ref">${i.identifier}</span>`}
        <h3>${i.title}</h3>
      </div>
      ${meta.length ? html`<p class="issue-meta">${meta.join(' · ')}</p>` : null}
      ${i.labels?.length ? html`<div class="dist">${i.labels.map((l) => html`<span class="chip">${l}</span>`)}</div>` : null}
      ${i.description ? html`<pre class="issue-desc">${i.description}</pre>` : html`<p class="lead">Sin descripción.</p>`}
    </aside>`;
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

  _renderSimple() {
    return html`
      ${this._renderVoteTitle()}
      ${this._renderControls()}
      ${this._renderDeck()}
      ${this._renderBar()}
      ${this._renderPlayers()}
      ${this._renderSummary()}
      ${this._renderAgreements()}`;
  }

  render() {
    if (!this._session) return html`<p class="lead">Cargando la mesa…</p>`;
    // Con ficha de Linear la mesa va en dos columnas (desktop): la historia al lado, no debajo.
    return html`
      <div class="table ${this._voteIssue ? 'with-issue' : ''}">
        <div class="main">
          ${this._renderSimple()}
          ${this._error ? html`<p class="error">${this._error}</p>` : null}
        </div>
        ${this._renderIssuePanel()}
      </div>`;
  }
}

if (!customElements.get('poker-table')) {
  customElements.define('poker-table', PokerTable);
}
