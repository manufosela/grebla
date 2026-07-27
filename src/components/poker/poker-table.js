/**
 * <poker-table> — la mesa de una sesión de Scrum Poker (RMR-TSK-0317). Se une a
 * la sesión, muestra el tema, el mazo para votar en oculto y la presencia (quién
 * ha votado, SIN el valor). Cuando todos los que se han unido han votado, aparece
 * el botón «Revelar» para todos; al revelar se ven las cartas y un resumen
 * (media de las numéricas / consenso). El dueño pasa al siguiente tema.
 *
 * Todo en tiempo real: se suscribe a la sesión y a la presencia siempre, y a los
 * votos SOLO cuando la sesión está revelada (antes, las reglas no dejan leer la
 * colección entera). Limpia las suscripciones al desmontar.
 *
 * Props: sessionId, uid, authorName (nombre para la presencia), canManage (dueño).
 */
import { LitElement, html, css } from 'lit';
import { POKER_DECK } from '../../tools/poker/domain/deck.js';
import { allVoted, countVoted, hasVotedThisRound, revealedVotes, summarizeVotes } from '../../tools/poker/domain/tally.js';
import {
  joinSession, castVote, reveal, startTopic, getMyVote,
  watchSession, watchPlayers, watchVotes,
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
    _topicDraft: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); }
    .topic { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.2rem; }
    .topic h3 { margin: 0; font-size: 1.05rem; color: var(--rm-text, #1e3a5f); }
    .topic .muted { color: var(--rm-muted, #5b6b7d); font-style: italic; }
    .topic-edit { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .topic-edit input { flex: 1 1 12rem; min-width: 0; padding: 0.5rem 0.7rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
    .topic-edit input:focus { outline: none; border-color: var(--teal); background: var(--rm-surface, #fff); }
    button { font: inherit; cursor: pointer; border-radius: 8px; border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); padding: 0.45rem 0.85rem; font-weight: 600; }
    button:hover:not(:disabled) { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    button.primary { background: var(--teal); border-color: var(--teal); color: var(--rm-on-accent, #fff); }
    button.primary:hover:not(:disabled) { color: var(--rm-on-accent, #fff); filter: brightness(1.06); }
    button:disabled { opacity: 0.5; cursor: default; }
    .deck { display: flex; flex-wrap: wrap; gap: 0.55rem; margin: 0.4rem 0 1.3rem; }
    .card { width: 3.2rem; height: 4.4rem; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0; }
    .card.picked { background: var(--teal); border-color: var(--teal); color: var(--rm-on-accent, #fff); transform: translateY(-4px); box-shadow: 0 6px 14px color-mix(in srgb, var(--teal) 30%, transparent); }
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
    this._topicDraft = '';
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
      watchSession(this.sessionId, (s) => this._onSession(s), (e) => this._onError(e)),
      watchPlayers(this.sessionId, (p) => { this._players = p; }, (e) => this._onError(e)),
    ];
  }

  _onSession(session) {
    this._session = session;
    if (!session) return;
    // Al cambiar de ronda, la carta elegida deja de valer.
    if (this._lastRound !== null && session.round !== this._lastRound) {
      this._myVote = null;
      this._topicDraft = '';
    }
    this._lastRound = session.round;
    // Suscribirse a los votos SOLO cuando está revelado (antes las reglas rechazan
    // leer la colección entera); al ocultar, cortar y limpiar.
    if (session.revealed && !this._votesSub) {
      this._votesSub = watchVotes(this.sessionId, (v) => { this._votes = v; }, (e) => this._onError(e));
    } else if (!session.revealed && this._votesSub) {
      this._votesSub();
      this._votesSub = null;
      this._votes = [];
    }
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

  async _vote(card) {
    if (this._revealed) return;
    try {
      await castVote(this.sessionId, this.uid, this._round, card);
      this._myVote = { value: card, round: this._round };
    } catch (err) { this._onError(err); }
  }

  async _reveal() {
    try { await reveal(this.sessionId); } catch (err) { this._onError(err); }
  }

  async _startTopic() {
    const topic = this._topicDraft.trim();
    if (!topic) return;
    try {
      await startTopic(this.sessionId, topic);
      this._topicDraft = '';
    } catch (err) { this._onError(err); }
  }

  _renderTopic() {
    const topic = this._session?.topic?.trim();
    if (!this.canManage) {
      return html`<div class="topic">
        <h3>${topic || html`<span class="muted">Esperando a que se proponga un tema…</span>`}</h3>
      </div>`;
    }
    const label = this._revealed ? 'Siguiente tema' : (topic ? 'Cambiar tema' : 'Empezar a estimar');
    return html`<div class="topic">
      ${topic ? html`<h3>${topic}</h3>` : html`<h3 class="muted">Propón el primer tema a estimar</h3>`}
      <div class="topic-edit">
        <input type="text" placeholder="Tema o tarea a estimar…" .value=${this._topicDraft}
          @input=${(e) => { this._topicDraft = e.target.value; }}
          @keydown=${(e) => { if (e.key === 'Enter') this._startTopic(); }} />
        <button class="primary" @click=${() => this._startTopic()} ?disabled=${!this._topicDraft.trim()}>${label}</button>
      </div>
    </div>`;
  }

  _renderDeck() {
    if (!this._session?.topic?.trim() || this._revealed) return null;
    const picked = this._myVoteValue;
    return html`
      <p class="lead">Elige tu carta. Nadie ve tu voto hasta que se revele.</p>
      <div class="deck">
        ${POKER_DECK.map((card) => html`
          <button class="card ${card === picked ? 'picked' : ''}" @click=${() => this._vote(card)}>${card}</button>`)}
      </div>`;
  }

  _renderPlayers() {
    const round = this._round;
    const revealed = this._revealed;
    const byUid = Object.fromEntries(this._votes.map((v) => [v.uid, v]));
    const cards = revealed ? revealedVotes(this._players, byUid, round) : [];
    const cardByUid = Object.fromEntries(cards.map((c) => [c.uid, c.value]));
    if (!this._players.length) return html`<p class="lead">Aún no se ha unido nadie a la mesa.</p>`;
    return html`
      <ul class="players">
        ${this._players.map((p) => {
          const voted = hasVotedThisRound(p, round);
          return html`<li>
            <span class="name">${p.name || 'Sin nombre'}</span>
            ${revealed
              ? html`<span class="reveal-card">${voted ? (cardByUid[p.uid] ?? '·') : '—'}</span>`
              : html`<span class="state ${voted ? 'voted' : 'waiting'}">${voted ? '✓ votó' : 'pensando…'}</span>`}
          </li>`;
        })}
      </ul>`;
  }

  _renderBar() {
    const round = this._round;
    const voted = countVoted(this._players, round);
    const total = this._players.length;
    if (this._revealed) return null;
    if (!this._session?.topic?.trim()) return null;
    const ready = allVoted(this._players, round);
    return html`<div class="bar">
      <span class="lead">${voted}/${total} han votado</span>
      ${ready ? html`<button class="primary" @click=${() => this._reveal()}>Revelar votos</button>` : null}
    </div>`;
  }

  _renderSummary() {
    if (!this._revealed) return null;
    const cards = revealedVotes(this._players, Object.fromEntries(this._votes.map((v) => [v.uid, v])), this._round);
    const s = summarizeVotes(cards.map((c) => c.value));
    const headline = s.consensus
      ? '¡Consenso! Todas las cartas coinciden.'
      : s.average !== null
        ? `Media ${Number.isInteger(s.average) ? s.average : s.average.toFixed(1)} · rango ${s.min}–${s.max}`
        : 'Sin cartas numéricas que promediar.';
    return html`<div class="summary">
      <p class="headline">${headline}</p>
      <div class="dist">
        ${s.distribution.map((d) => html`<span class="chip">${d.value} × ${d.count}</span>`)}
      </div>
    </div>`;
  }

  render() {
    if (!this._session) return html`<p class="lead">Cargando la mesa…</p>`;
    return html`
      ${this._renderTopic()}
      ${this._renderDeck()}
      ${this._renderBar()}
      ${this._renderPlayers()}
      ${this._renderSummary()}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}`;
  }
}

if (!customElements.get('poker-table')) {
  customElements.define('poker-table', PokerTable);
}
