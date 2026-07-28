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
import { POKER_DECK } from '../../tools/poker/domain/deck.js';
import {
  countActiveVoted, hasVotedThisRound, revealedVotes, summarizeVotes,
  isSpectator, hasSkippedRound, activeVoters,
} from '../../tools/poker/domain/tally.js';
import {
  joinSession, castVote, reveal, revote, getMyVote,
  watchSession, watchPlayers, watchVotes,
  listSquadBacklog, setSessionTasks, setCurrentTask, activateVoting, saveEstimate,
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
    _backlog: { state: true },
    _backlogLoading: { state: true },
    _selectedTaskIds: { state: true },
    _estimateDraft: { state: true },
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
    .backlog { list-style: none; margin: 0 0 0.6rem; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; max-height: 24rem; overflow-y: auto; }
    .backlog li label { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.4rem 0.5rem; border: 1px solid var(--rm-border, #eef0f2); border-radius: 8px; cursor: pointer; line-height: 1.35; }
    .backlog li label:hover { border-color: var(--teal); }
    .ident { font-weight: 700; color: var(--rm-muted, #5b6b7d); font-size: 0.8rem; white-space: nowrap; }
    .queue { list-style: none; margin: 0 0 1.2rem; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .queue li { display: flex; align-items: center; gap: 0.55rem; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #eef0f2); border-radius: 8px; }
    .queue li.current { border-color: var(--teal); background: color-mix(in srgb, var(--teal) 8%, transparent); }
    .queue .qtitle { flex: 1; color: var(--rm-text, #1e3a5f); font-size: 0.9rem; }
    .est { font-weight: 800; color: var(--rm-accent-700, var(--teal)); }
    .task { margin: 0.4rem 0 1rem; }
    .task h3 { margin: 0 0 0.35rem; font-size: 1.1rem; color: var(--rm-text, #1e3a5f); }
    .linear-link { font-size: 0.82rem; font-weight: 600; color: var(--rm-accent-700, var(--teal)); text-decoration: none; }
    .linear-link:hover { text-decoration: underline; }
    .est-input { width: 5rem; padding: 0.4rem 0.6rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
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
    this._backlog = [];
    this._backlogLoading = false;
    this._selectedTaskIds = new Set();
    this._estimateDraft = '';
    this._error = '';
    this._subs = [];
    this._votesSub = null;
    this._joinedFor = null;
    this._lastRound = null;
    this._backlogLoadedFor = null;
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
      this._estimateDraft = '';
    }
    this._lastRound = session.round;
    // Modo Linear sin tareas aún: el manager carga el backlog del squad para elegir.
    if (session.mode === 'linear' && !(session.tasks?.length) && this.canManage
        && this._backlogLoadedFor !== session.squad?.linearLabel) {
      this._backlogLoadedFor = session.squad?.linearLabel;
      this._loadBacklog(session.squad?.linearLabel);
    }
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
  get _mode() { return this._session?.mode === 'linear' ? 'linear' : 'simple'; }
  get _tasks() { return this._session?.tasks ?? []; }
  get _currentTaskId() { return this._session?.currentTaskId ?? null; }
  get _currentTask() { return this._tasks.find((t) => t.id === this._currentTaskId) ?? null; }
  // En simple se vota siempre; en linear, solo tras «activar votación» de la tarea.
  get _votingActive() { return this._mode !== 'linear' || this._session?.votingActive === true; }
  get _results() { return this._session?.results ?? {}; }
  get _myPlayer() { return this._players.find((p) => p.uid === this.uid) ?? null; }
  get _amSpectator() { return isSpectator(this._myPlayer); }
  get _amSkipped() { return hasSkippedRound(this._myPlayer, this._round); }
  get _canIVote() { return this._votingActive && !this._revealed && !this._amSpectator && !this._amSkipped; }

  async _toggleSpectator() {
    try { await setSpectator(this.sessionId, this.uid, !this._amSpectator); } catch (err) { this._onError(err); }
  }

  async _toggleSkip() {
    try {
      if (this._amSkipped) await unskipRound(this.sessionId, this.uid);
      else await skipRound(this.sessionId, this.uid, this._round);
    } catch (err) { this._onError(err); }
  }

  async _vote(card) {
    if (!this._canIVote) return; // ni revelado, ni observador, ni fuera de ámbito, ni en discusión
    try {
      await castVote(this.sessionId, this.uid, this._round, card);
      this._myVote = { value: card, round: this._round };
    } catch (err) { this._onError(err); }
  }

  async _reveal() {
    try { await reveal(this.sessionId); } catch (err) { this._onError(err); }
  }

  async _revote() {
    try { await revote(this.sessionId); } catch (err) { this._onError(err); }
  }

  // ── Modo Linear: backlog, tareas y estimación ──────────────────────────────
  async _loadBacklog(label) {
    if (!label) return;
    this._backlogLoading = true;
    try { this._backlog = await listSquadBacklog(label); }
    catch (err) { this._onError(err); }
    finally { this._backlogLoading = false; }
  }

  _toggleTask(id) {
    const next = new Set(this._selectedTaskIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    this._selectedTaskIds = next;
  }

  async _startRefinement() {
    const tasks = this._backlog.filter((t) => this._selectedTaskIds.has(t.id));
    if (!tasks.length) return;
    try { await setSessionTasks(this.sessionId, tasks); } catch (err) { this._onError(err); }
  }

  async _pickTask(taskId) {
    try { await setCurrentTask(this.sessionId, taskId); } catch (err) { this._onError(err); }
  }

  async _activateVoting() {
    try { await activateVoting(this.sessionId); } catch (err) { this._onError(err); }
  }

  async _saveEstimate() {
    const value = this._estimateDraft.trim();
    if (!value || !this._currentTaskId) return;
    try { await saveEstimate(this.sessionId, this._currentTaskId, value); } catch (err) { this._onError(err); }
  }

  _renderControls() {
    if (this._revealed) return null;
    return html`<div class="controls">
      <label class="ctl"><input type="checkbox" .checked=${this._amSpectator}
        @change=${() => this._toggleSpectator()} /> Solo ver (no votar)</label>
      ${this._votingActive && !this._amSpectator ? html`
        <button class="ctl-btn" @click=${() => this._toggleSkip()}>${this._amSkipped ? 'Volver a la ronda' : 'Fuera de mi ámbito'}</button>` : null}
    </div>`;
  }

  _renderDeck() {
    if (this._revealed || !this._votingActive) return null;
    if (this._amSpectator) return html`<p class="lead">Estás como observador: no votas en esta sesión.</p>`;
    if (this._amSkipped) return html`<p class="lead">Te has saltado esta ronda (fuera de tu ámbito).</p>`;
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
          const spec = isSpectator(p);
          const skip = hasSkippedRound(p, round);
          return html`<li>
            <span class="name">${p.name || 'Sin nombre'}</span>
            ${revealed
              ? html`<span class="reveal-card">${(voted && !spec && !skip) ? (cardByUid[p.uid] ?? '·') : (spec ? '👁' : '—')}</span>`
              : html`<span class="state ${voted ? 'voted' : (spec || skip ? 'out' : 'waiting')}">${
                  spec ? 'solo ve' : skip ? 'fuera de ámbito' : voted ? '✓ votó' : 'pensando…'
                }</span>`}
          </li>`;
        })}
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

  _renderSimple() {
    return html`
      ${this._renderControls()}
      ${this._renderDeck()}
      ${this._renderBar()}
      ${this._renderPlayers()}
      ${this._renderSummary()}`;
  }

  _renderBacklogPicker() {
    if (this._backlogLoading) return html`<p class="lead">Cargando el backlog de ${this._session.squad?.name}…</p>`;
    if (!this._backlog.length) return html`<p class="lead">No hay tareas de backlog en «${this._session.squad?.name}».</p>`;
    return html`
      <p class="lead">Backlog de <strong>${this._session.squad?.name}</strong>. Marca las tareas a refinar.</p>
      <ul class="backlog">
        ${this._backlog.map((t) => html`<li>
          <label><input type="checkbox" .checked=${this._selectedTaskIds.has(t.id)} @change=${() => this._toggleTask(t.id)} />
            <span class="ident">${t.identifier}</span> <span>${t.title}</span></label>
        </li>`)}
      </ul>
      <div class="bar">
        <button class="primary" ?disabled=${!this._selectedTaskIds.size} @click=${() => this._startRefinement()}>
          Empezar refinamiento (${this._selectedTaskIds.size})
        </button>
      </div>`;
  }

  _renderTaskQueue() {
    return html`<ol class="queue">
      ${this._tasks.map((t) => {
        const isCurrent = t.id === this._currentTaskId;
        const est = this._results[t.id]?.value;
        return html`<li class=${isCurrent ? 'current' : ''}>
          <span class="ident">${t.identifier}</span>
          <span class="qtitle">${t.title}</span>
          ${est != null ? html`<span class="est">${est}</span>` : null}
          ${this.canManage && !isCurrent ? html`<button class="act" @click=${() => this._pickTask(t.id)}>Refinar</button>` : null}
        </li>`;
      })}
    </ol>`;
  }

  _renderCurrentTask() {
    const t = this._currentTask;
    return html`
      <div class="task">
        <h3>${t.identifier} · ${t.title}</h3>
        ${t.url ? html`<a class="linear-link" href=${t.url} target="_blank" rel="noopener">Abrir en Linear ↗</a>` : null}
      </div>
      ${this._renderVotingArea()}`;
  }

  _renderVotingArea() {
    if (!this._votingActive) {
      return html`
        <div class="bar">
          <span class="lead">En discusión — anotad en Linear. Cuando esté claro, a votar.</span>
          ${this.canManage ? html`<button class="primary" @click=${() => this._activateVoting()}>Activar votación</button>` : null}
        </div>
        ${this._renderControls()}`;
    }
    return html`
      ${this._renderControls()}
      ${this._renderDeck()}
      ${this._renderBar()}
      ${this._renderPlayers()}
      ${this._renderSummary()}
      ${this._revealed && this.canManage ? this._renderSaveEstimate() : null}`;
  }

  _renderSaveEstimate() {
    const saved = this._results[this._currentTaskId]?.value;
    return html`<div class="bar">
      <label class="lead" for="est">Estimación acordada:</label>
      <input id="est" class="est-input" type="text" .value=${this._estimateDraft} placeholder="p. ej. 5"
        @input=${(e) => { this._estimateDraft = e.target.value; }} />
      <button class="primary" ?disabled=${!this._estimateDraft.trim()} @click=${() => this._saveEstimate()}>Guardar en la tarea</button>
      ${saved != null ? html`<span class="lead">✓ Guardada: ${saved}</span>` : null}
    </div>`;
  }

  _renderLinear() {
    if (!this._tasks.length) {
      return this.canManage
        ? this._renderBacklogPicker()
        : html`<p class="lead">El manager está preparando el backlog…</p>`;
    }
    return html`
      ${this._renderTaskQueue()}
      ${this._currentTask
        ? this._renderCurrentTask()
        : html`<p class="lead">${this.canManage ? 'Elige una tarea de la lista para refinar.' : 'Esperando a que el manager elija una tarea.'}</p>`}`;
  }

  render() {
    if (!this._session) return html`<p class="lead">Cargando la mesa…</p>`;
    return html`
      ${this._mode === 'linear' ? this._renderLinear() : this._renderSimple()}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}`;
  }
}

if (!customElements.get('poker-table')) {
  customElements.define('poker-table', PokerTable);
}
