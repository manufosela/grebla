/**
 * <poker-table> — la mesa de una sesión de Scrum Poker (RMR-TSK-0321, v3 en
 * RMR-TSK-0521..0524). Una carta boca abajo por persona; cada uno vota en
 * oculto; cuando han votado todos, el organizador pulsa «Mostrar votos» y las
 * cartas se giran con su juicio (acuerdo, o la más baja y la más alta). El
 * organizador conduce: tareas, volver a votar, nueva votación, terminar.
 *
 * Todo en tiempo real: se suscribe a la sesión y a la presencia siempre, y a los
 * votos SOLO cuando la sesión está revelada (antes, las reglas no dejan leer la
 * colección entera). Limpia las suscripciones al desmontar.
 *
 * Props: sessionId, uid, authorName (nombre para la presencia), canManage (dueño).
 */
import { LitElement, html, css } from 'lit';
import { deckOf, cardLabel, SPLIT_CARD } from '../../tools/poker/domain/deck.js';
import { magnitudeCard, COMPLEXITY_LEVELS, EFFORT_LEVELS } from '../../tools/poker/domain/magnitude.js';
import { normalizeLinearRef, findLinearRef } from '../../tools/poker/domain/reference.js';
import '../app-modal.js';
import '../markdown-view.js';
import { currentTask, closeTask, appendTask, setTaskGuilds, defaultGuilds, taskGuilds } from '../../tools/poker/domain/tasks.js';
import { listGlobalGuilds } from '../../lib/guilds.js';
import './guild-picker.js';

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
import { isSpectator, hasSkippedRound, eligibleFor, guildsForTask, impliedGuild, seatGuilds, baseGuilds, assignSeatGuilds, isLocked, activeVoters, taskSettlement, judgeVotes } from '../../tools/poker/domain/tally.js';
import { cardStates, allActiveVoted } from '../../tools/poker/domain/table.js';
import {
  joinSession, castVote, reveal, revote, getMyVote, setVoteTitle, recordAgreement,
  fetchLinearIssue, setVoteRef, showIssue, setIssueOpen, getSession, setSessionTasks, closeCurrentTask, finishSession,
  watchSession, watchPlayers, watchVotes,
  setSpectator, skipRound, unskipRound,
  setSeatGuilds, pushLinearEstimates,
} from '../../lib/poker.js';

/** ¿Son los mismos gremios, en el mismo orden? (para no escribir en balde). */
const sameGuilds = (a, b) => a.length === b.length && a.every((g, i) => g === b[i]);

export class PokerTable extends LitElement {
  static properties = {
    sessionId: { attribute: false },
    _guildCatalog: { state: true },
    _voteGuild: { state: true },
    _linearBusy: { state: true },
    uid: { attribute: false },
    guilds: { attribute: false },
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
    _issueLocalOpen: { state: true },
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
    /* Sliders cortos (RMR-TSK-0525): nombre · slider · valor · descripción, en una línea. */
    .axis { display: grid; grid-template-columns: 6.5rem 12rem 1.6rem 1fr; gap: 0.3rem 0.8rem; align-items: center; margin: 0.35rem 0; }
    .axis-name { font-weight: 700; color: var(--rm-text, #1e3a5f); font-size: 0.9rem; }
    .slider { width: 100%; accent-color: var(--teal); cursor: pointer; margin: 0; }
    .axis-value { font-weight: 800; font-size: 1.05rem; color: var(--rm-accent-700, var(--teal)); text-align: center; font-variant-numeric: tabular-nums; }
    .axis-text { color: var(--rm-muted, #5b6b7d); font-size: 0.82rem; min-height: 1.2em; }
    @media (max-width: 700px) { .axis { grid-template-columns: 6.5rem 1fr 1.6rem; } .axis-text { grid-column: 1 / -1; } }
    .magnitude { display: flex; align-items: center; gap: 0.9rem; flex-wrap: wrap; margin: 0.9rem 0 1.3rem; }
    .card.result { cursor: default; border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .card.result.split { border-style: dashed; color: var(--rm-muted, #5b6b7d); }
    .magnitude-text { color: var(--rm-text, #1e3a5f); font-size: 0.9rem; }
    .axes { font-size: 0.72rem; font-weight: 700; color: var(--rm-muted, #5b6b7d); font-variant-numeric: tabular-nums; }
    /* La mesa (RMR-TSK-0523): una carta por persona, a todo el ancho. */
    .seats { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.8rem, 1fr)); gap: 1rem 0.8rem; margin: 0.8rem 0 1rem; }
    .seat { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; min-width: 0; }
    .seat.empty { opacity: 0.5; }
    .seat.empty .back { border-style: dashed; background: var(--rm-surface-hover, #eef3f5); }
    .seat.empty .back-mark { color: var(--rm-muted, #5b6b7d); }
    .seat.empty .seat-name { font-style: italic; color: var(--rm-muted, #5b6b7d); }
    .guild-groups { display: flex; flex-direction: column; gap: 0.6rem; margin: 0.8rem 0 1rem; }
    .guild-group { border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; padding: 0.5rem 0.8rem 0.2rem; }
    .guild-group h4 { margin: 0 0 0.3rem; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #5b6b7d); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .guild-group .seats { margin: 0.3rem 0 0.5rem; }
    .guild-group.locked { background: color-mix(in srgb, #2e9e5b 8%, transparent); border-color: #2e9e5b; }
    .chip { display: inline-flex; align-items: center; padding: 0.1rem 0.5rem; border-radius: 999px; border: 1px solid var(--rm-border, #dde7ec); font-size: 0.72rem; font-weight: 700; text-transform: none; letter-spacing: 0; color: var(--rm-text, #1e3a5f); background: var(--rm-surface, #fff); }
    .chip.agree { background: #d9f3e3; border-color: #2e9e5b; color: #14532d; }
    .chip.low { background: #fbe0e0; border-color: #c0392b; color: #7f1d1d; }
    .chip.warn { background: #fdf1d6; border-color: #b45309; color: #78350f; }
    .guild-values { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; }
    .linear-links a.chip { text-decoration: none; color: var(--rm-accent-700, var(--teal)); border-color: var(--teal); }
    .linear-btn { font-size: 0.78rem; padding: 0.25rem 0.6rem; }
    .seat-guild { font-size: 0.68rem; color: var(--rm-muted, #5b6b7d); text-transform: uppercase; letter-spacing: 0.03em; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .unseated { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.9rem; margin: -0.4rem 0 1rem; font-size: 0.85rem; }
    .unseated-row { display: inline-flex; align-items: center; gap: 0.35rem; }
    .unseated select { font: inherit; font-size: 0.82rem; padding: 0.25rem 0.4rem; border-radius: 8px; border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
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
    /* Los tonos llevan fondo Y texto fijos (RMR-BUG-0123): en oscuro el texto del
       tema es claro y sobre el pastel no se leía. Mismos colores en los dos temas. */
    .flip.tone-agree .front { background: #d9f3e3; border-color: #2e9e5b; color: #14532d; }
    .flip.tone-low .front, .flip.tone-high .front { background: #fbe0e0; border-color: #c0392b; color: #7f1d1d; }
    .flip.tone-agree .axes { color: #2e7d4f; }
    .flip.tone-low .axes, .flip.tone-high .axes { color: #a93226; }
    .flip.tone-empty .front { color: var(--rm-muted, #5b6b7d); border-style: dashed; }
    .bar { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin: 0.8rem 0; }
    .guild-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.6rem; margin: -0.3rem 0 0.8rem; }
    .verdict { border: 1px solid var(--rm-border, #dde7ec); border-radius: 10px; padding: 0.7rem 1rem; background: var(--rm-surface-hover, #f6f9fa); margin: 0.4rem 0 0.8rem; }
    .verdict.agree { border-color: #2e9e5b; background: #edf9f1; }
    .verdict.agree .headline { color: #14532d; }
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
    .issue-desc { margin: 0.3rem 0 0; max-height: 55vh; overflow: auto; }
    .title-bar { justify-content: space-between; margin: 0.2rem 0 0.4rem; }
    .title-bar .lead { margin: 0; }
    .act { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; padding: 0.25rem 0.7rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .act:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; margin: 0 0 0.9rem; font-size: 0.86rem; color: var(--rm-text, #1e3a5f); }
    .ctl { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; }
    .controls select { font: inherit; font-size: 0.82rem; padding: 0.25rem 0.4rem; border-radius: 8px; border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
    .ctl-btn { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d); border-radius: 8px; padding: 0.3rem 0.75rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
    .ctl-btn:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .state.out { background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); font-style: italic; }
  `;

  constructor() {
    super();
    this.sessionId = null;
    this._guildCatalog = [];
    /** Gremios de la ficha de quien entra (RMR-PCS-0043 · F2). */
    this.guilds = [];
    /** Gremio elegido para votar cuando el asiento tiene varios válidos para la tarea. */
    this._voteGuild = null;
    /** Id de la tarea que se está enviando a Linear, o null. */
    this._linearBusy = null;
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
    /** La historia abierta EN LOCAL por quien vota (RMR-TSK-0536): no toca la sesión. */
    this._issueLocalOpen = false;
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
    this._syncGuildSelects();
  }

  /** Un <select> con opciones dinámicas no refleja su valor solo: se fija aquí. */
  _syncGuildSelects() {
    const mio = this.renderRoot?.querySelector('#myguild');
    if (mio) mio.value = this._guildForVote() ?? '';
    const task = this._currentTask;
    for (const sel of this.renderRoot?.querySelectorAll('select[data-seat]') ?? []) {
      const asiento = this._players.find((p) => p.uid === sel.dataset.seat);
      sel.value = asiento && task ? (guildsForTask(asiento, task, {})[0] ?? '') : '';
    }
  }

  firstUpdated() {
    listGlobalGuilds().then((cat) => { this._guildCatalog = cat; }).catch(() => { this._guildCatalog = []; });
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
      await joinSession(this.sessionId, this.uid, this.authorName, { spectator, guilds: this.guilds });
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
      this._issueLocalOpen = false;
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
  get _activeVoteTab() { return this._voteTab ?? 'ejes'; }
  get _myPlayer() { return this._players.find((p) => p.uid === this.uid) ?? null; }
  get _amSpectator() { return isSpectator(this._myPlayer); }
  get _amSkipped() { return hasSkippedRound(this._myPlayer, this._round); }
  get _canIVote() { return !this._revealed && !this._amSpectator && !this._amSkipped && this._eligible; }
  /** Gremios ya con acuerdo en esta tarea {gremio: valor} (RMR-PCS-0043 · F3): no vuelven a votar. */
  get _locked() { return this._session?.lockedGuilds ?? {}; }
  /** ¿Es esta tarea de mi gremio y sigue abierta para él? (tarea general: de todos). */
  get _eligible() { return eligibleFor(this._myPlayer, this._currentTask, this._locked); }
  /** Con qué gremios puedo votar la tarea actual (varios = hay que elegir). */
  get _myTaskGuilds() { return guildsForTask(this._myPlayer, this._currentTask, this._locked); }
  /** ¿La tarea actual va por gremios? */
  get _byGuilds() { return (this._currentTask?.guilds ?? []).length > 0; }

  async _toggleSpectator() {
    try { await setSpectator(this.sessionId, this.uid, !this._amSpectator); } catch (err) { this._onError(err); }
  }

  async _toggleSkip() {
    try {
      if (this._amSkipped) await unskipRound(this.sessionId, this.uid);
      else await skipRound(this.sessionId, this.uid, this._round);
    } catch (err) { this._onError(err); }
  }

  /** El gremio con el que cuenta mi voto: el único posible, o el elegido si hay varios; null en tarea general. */
  _guildForVote() {
    const options = this._myTaskGuilds;
    if (options.length <= 1) return impliedGuild(this._myPlayer, this._currentTask, this._locked);
    return options.includes(this._voteGuild) ? this._voteGuild : undefined;
  }

  async _vote(card, axes = null) {
    if (!this._canIVote) return; // ni revelado, ni observador, ni fuera de ámbito, ni en discusión
    const guild = this._guildForVote();
    if (guild === undefined) { this._error = 'Elige con qué gremio votas.'; return; }
    try {
      await castVote(this.sessionId, this.uid, this._round, card, this._session, axes, guild);
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
      ${this._renderMyGuild()}
      ${!this._amSpectator ? html`
        <button class="ctl-btn" @click=${() => this._toggleSkip()}>${this._amSkipped ? 'Volver a la ronda' : 'Fuera de mi ámbito'}</button>` : null}
    </div>`;
  }

  /**
   * Con qué gremio voto esta tarea (RMR-BUG-0127): al lado de «Solo ver», que es
   * el otro ajuste de cómo participo, y SIEMPRE cambiable — elegir mal no puede
   * ser definitivo. Los gremios ya cerrados salen deshabilitados.
   */
  _renderMyGuild() {
    if (!this._byGuilds || this._amSpectator) return null;
    const actual = this._guildForVote() ?? '';
    const opciones = (this._currentTask.guilds ?? []).map((g) => {
      const fijado = isLocked(this._locked, g);
      return html`<option value=${g} ?disabled=${fijado} ?selected=${g === actual}>${fijado ? `${g} (acordado)` : g}</option>`;
    });
    return html`<label class="ctl">Voto como
      <select id="myguild" aria-label="Gremio con el que voto" @change=${(e) => this._pickMyGuild(e.target.value)}>
        <option value="" ?selected=${actual === ''}>elige gremio…</option>
        ${opciones}
      </select>
    </label>`;
  }

  /**
   * Elijo (o corrijo) mi gremio: el asiento se recalcula desde la ficha, así que
   * el anterior no se queda pegado, y si ya había votado esta ronda el voto se
   * vuelve a emitir para que cuente en el gremio nuevo.
   */
  async _pickMyGuild(value) {
    const elegido = value || null;
    this._error = '';
    this._voteGuild = elegido;
    const votado = this._myVoteValue;
    try {
      const nuevo = assignSeatGuilds(this._myPlayer, elegido);
      if (!sameGuilds(nuevo, seatGuilds(this._myPlayer))) await setSeatGuilds(this.sessionId, this.uid, nuevo);
      if (elegido && votado !== null) await castVote(this.sessionId, this.uid, this._round, votado, this._session, this._myAxes, elegido);
    } catch (err) { this._onError(err); }
  }

  _renderDeck() {
    if (this._revealed) return null;
    if (this._amSpectator) return html`<p class="lead">Estás como observador: no votas en esta sesión.</p>`;
    if (this._amSkipped) return html`<p class="lead">Te has saltado esta ronda (fuera de tu ámbito).</p>`;
    if (!this._eligible) {
      // Mi gremio ya tiene acuerdo en esta tarea: solo esperan los demás (RMR-PCS-0043 · F3).
      const fijados = guildsForTask(this._myPlayer, this._currentTask, {}).filter((g) => Object.hasOwn(this._locked, g));
      if (fijados.length > 0) {
        return html`<p class="lead">Tu gremio ya tiene acuerdo (${fijados.map((g) => `${g}: ${cardLabel(this._locked[g])}`).join(' · ')}). Esperando a los demás.</p>`;
      }
      const de = (this._currentTask?.guilds ?? []).join(', ');
      return html`<p class="lead">Esta tarea es de otro gremio (${de}): la miras, no la votas.</p>`;
    }
    const tab = this._activeVoteTab;
    return html`
      <div class="tabs" role="tablist" aria-label="Cómo votar">
        ${VOTE_TABS.map((t) => html`<button type="button" class="tab ${tab === t.id ? 'on' : ''}"
          role="tab" aria-selected=${tab === t.id ? 'true' : 'false'}
          @click=${() => { this._voteTab = t.id; }}>${t.label}</button>`)}
      </div>
      ${tab === 'ejes' ? this._renderAxes() : this._renderCards()}`;
  }

  /**
   * Quien está en la mesa sin ningún gremio de la tarea EN SU FICHA
   * (RMR-PCS-0043 · F2): el organizador le pone (o le cambia, RMR-BUG-0127) uno
   * de los gremios de la tarea; los demás solo ven cuántos miran.
   */
  _renderUnseated() {
    const task = this._currentTask;
    if (!task || (task.guilds ?? []).length === 0) return null;
    const activos = activeVoters(this._players, this._round);
    const sinFicha = activos.filter((p) => guildsForTask({ guilds: baseGuilds(p) }, task, {}).length === 0);
    if (sinFicha.length === 0) return null;
    if (!this.canManage) {
      // Quien ya tiene gremio asignado no «mira»: está votando en ese gremio.
      const miran = sinFicha.filter((p) => guildsForTask(p, task, {}).length === 0);
      if (miran.length === 0) return null;
      return html`<p class="lead unseated">${miran.length} ${miran.length === 1 ? 'persona mira' : 'personas miran'} esta tarea (otro gremio).</p>`;
    }
    return html`<div class="unseated">
      <span class="lead">Sin gremio en su ficha:</span>
      ${sinFicha.map((p) => this._renderUnseatedRow(p, task))}
    </div>`;
  }

  _renderUnseatedRow(p, task) {
    const label = `Gremio para ${p.name}`;
    const actual = guildsForTask(p, task, {})[0] ?? '';
    return html`<span class="unseated-row">
      <span class="seat-name">${p.name}</span>
      <select aria-label=${label} data-seat=${p.uid} @change=${(e) => this._assignGuild(p, e.target.value)}>
        <option value="" ?selected=${actual === ''}>sin gremio</option>
        ${task.guilds.map((g) => html`<option value=${g} ?selected=${g === actual}>${g}</option>`)}
      </select>
    </span>`;
  }

  /** El organizador pone o cambia el gremio de un asiento (siempre desde la ficha). */
  async _assignGuild(player, guild) {
    try {
      await setSeatGuilds(this.sessionId, player.uid, assignSeatGuilds(player, guild || null));
    } catch (err) { this._onError(err); }
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

  /** Un eje del cuadro (RMR-TSK-0525): un slider corto del 1 al 5, el valor al final y la descripción del nivel. */
  _renderAxis(name, levels, picked, onPick) {
    const valor = picked ?? 1;
    const elegido = levels.find((n) => n.level === valor);
    return html`<div class="axis" role="group" aria-label=${name}>
      <span class="axis-name">${name}</span>
      <input class="slider" type="range" min="1" max="5" step="1" .value=${String(valor)}
        aria-label=${`${name}: ${valor}`} aria-valuetext=${elegido?.text ?? ''}
        @input=${(e) => onPick(Number(e.target.value))} />
      <span class="axis-value" aria-hidden="true">${valor}</span>
      <span class="axis-text">${elegido ? `${elegido.text} (${elegido.example})` : ''}</span>
    </div>`;
  }

  _renderAxes() {
    const c = this._axisC ?? this._myAxes?.complexity ?? 1;
    const e = this._axisE ?? this._myAxes?.effort ?? 1;
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
    return cardStates({ players: this._players, votesByUid, round: this._round, revealed: this._revealed, deck: deckOf(this._session), task: this._currentTask, locked: this._locked });
  }

  /**
   * La mesa (RMR-TSK-0523): una carta boca abajo por persona que vota, con su
   * nombre debajo y borde verde cuando ya ha votado. Al revelar giran y el
   * color cuenta el juicio: verde si coinciden, rojo en la más baja y la más
   * alta. Sin lista de personas ni contador: la mesa ya lo dice.
   */
  _renderSeats() {
    const { seats, byGuild } = this._table;
    if (!this._byGuilds) {
      // La mesa se ve SIEMPRE (RMR-BUG-0128): sin nadie sentado se deja un sitio
      // vacío y se dice, en vez de cambiar la mesa por un párrafo (y que salte
      // el layout en cuanto entra la primera persona).
      return html`<div class="seats" aria-label="Cartas de la mesa">
        ${seats.length ? seats.map((s) => this._renderSeat(s)) : this._renderEmptySeat()}
      </div>
      ${seats.length ? null : html`<p class="lead">Aún no se ha sentado nadie a la mesa.</p>`}
      ${this._renderUnseated()}`;
    }
    // Por gremio (RMR-PCS-0043 · F3): un grupo por gremio de la tarea, en su orden;
    // los fijados con su valor; los que aún no han elegido gremio, aparte.
    const grupos = this._currentTask.guilds.map((g) => this._renderGuildGroup(g, seats.filter((x) => x.guild === g), byGuild));
    const sinElegir = seats.filter((x) => x.guild === null);
    return html`<div class="guild-groups" aria-label="Cartas de la mesa">
      ${grupos}
      ${sinElegir.length ? html`<section class="guild-group"><h4>Por elegir gremio</h4><div class="seats">${sinElegir.map((s) => this._renderSeat(s))}</div></section>` : null}
    </div>
    ${this._renderUnseated()}`;
  }

  _renderGuildGroup(guild, seats, byGuild) {
    if (Object.hasOwn(this._locked, guild)) {
      return html`<section class="guild-group locked"><h4>${guild} <span class="chip agree">acuerdo ${cardLabel(this._locked[guild])}</span></h4></section>`;
    }
    const verdict = byGuild?.groups.find((g) => g.guild === guild)?.verdict ?? null;
    let chip = null;
    if (seats.length === 0) chip = html`<span class="chip warn">nadie en la mesa</span>`;
    else if (verdict?.consensus) chip = html`<span class="chip agree">acuerdo ${cardLabel(verdict.agreed)}</span>`;
    else if (verdict && verdict.lowest !== null) chip = html`<span class="chip low">${cardLabel(verdict.lowest)} – ${cardLabel(verdict.highest)}</span>`;
    return html`<section class="guild-group" data-guild=${guild}>
      <h4>${guild} ${chip}</h4>
      <div class="seats">${seats.length ? seats.map((s) => this._renderSeat(s)) : this._renderEmptySeat()}</div>
    </section>`;
  }

  /** Un sitio vacío: la mesa sigue puesta aunque no haya nadie (RMR-BUG-0128). */
  _renderEmptySeat() {
    return html`<div class="seat empty" aria-hidden="true">
      <div class="flip"><div class="face back"><span class="back-mark">♠</span></div></div>
      <span class="seat-name">sin ocupar</span>
    </div>`;
  }

  _renderSeat(s) {
    return html`<div class="seat">
      <div class="flip ${this._revealed ? 'up' : ''} ${s.voted ? 'voted' : ''} tone-${s.tone}" data-uid=${s.uid} aria-label="${s.name}: ${this._seatLabel(s)}">
        <div class="face back"><span class="back-mark" aria-hidden="true">♠</span></div>
        <div class="face front" title=${s.value ?? ''}>
          <span class="value">${s.value === null ? '—' : cardLabel(s.value)}</span>
          ${s.axes ? html`<span class="axes">C${s.axes.complexity}·E${s.axes.effort}</span>` : null}
        </div>
      </div>
      <span class="seat-name">${s.name}</span>
      ${this._renderSeatGuild(s)}
    </div>`;
  }

  /** Bajo el nombre, el gremio con el que vota (o los suyos, en tarea general). */
  _renderSeatGuild(s) {
    const texto = s.guild ?? (s.guilds ?? []).join(' · ');
    return texto ? html`<span class="seat-guild">${texto}</span>` : null;
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
    const { seats, verdict, byGuild } = this._table;
    if (!this._revealed) {
      if (!this.canManage) return null;
      const listos = allActiveVoted(this._players, this._round, this._currentTask, this._locked);
      return html`<div class="bar">
        <button class="primary" @click=${() => this._reveal()} ?disabled=${!listos}
          title=${listos ? '' : 'Cuando hayan votado todos'}>Mostrar votos</button>
      </div>`;
    }
    if (this._byGuilds) return this._renderGuildVerdict(byGuild);
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
   * El juicio por gremio (RMR-PCS-0043 · F3): cada gremio coincide o no. Si
   * todos tienen valor (acordado ahora o fijado antes) se cierra la tarea con
   * el valor de cada uno; si no, «Volver a votar» fija los que coinciden y
   * solo repiten los demás.
   */
  _renderGuildVerdict(byGuild) {
    const task = this._currentTask;
    const settlement = taskSettlement(task, this._locked, byGuild?.agreed ?? {});
    const sinMesa = settlement.missing.filter((g) => !byGuild?.groups.some((x) => x.guild === g));
    const enDesacuerdo = settlement.missing.filter((g) => !sinMesa.includes(g));
    let texto;
    if (settlement.done) texto = `¡Acuerdo en todos los gremios! ${Object.entries(settlement.values).map(([g, v]) => `${g}: ${cardLabel(v)}`).join(' · ')}.`;
    else if (enDesacuerdo.length) texto = `Sin acuerdo en ${enDesacuerdo.join(' y ')}. Hablad la diferencia y que vuelvan a votar solo esos gremios.`;
    else texto = `Faltan gremios sin nadie en la mesa: ${sinMesa.join(', ')}. Asigna gremio a alguien o quítalos de la tarea.`;
    return html`<div class="verdict ${settlement.done ? 'agree' : ''}">
      <p class="headline">${texto}</p>
      ${this._renderGuildVerdictActions(settlement, byGuild)}
    </div>`;
  }

  _renderGuildVerdictActions(settlement, byGuild) {
    if (!this.canManage) return null;
    if (settlement.done) {
      const resumen = Object.entries(settlement.values).map(([g, v]) => `${g} ${cardLabel(v)}`).join(' · ');
      return html`<div class="bar"><button class="primary" @click=${() => this._recordAgreementByGuild(settlement.values)}>Nueva votación (queda ${resumen})</button></div>`;
    }
    const fijar = { ...this._locked, ...(byGuild?.agreed ?? {}) };
    const repiten = settlement.missing.filter((g) => byGuild?.groups.some((x) => x.guild === g));
    const etiqueta = repiten.length ? `Volver a votar (solo ${repiten.join(', ')})` : 'Volver a votar';
    return html`<div class="bar"><button class="primary" @click=${() => this._revoteLocking(fijar)}>${etiqueta}</button></div>`;
  }

  async _revoteLocking(locked) {
    try { await revote(this.sessionId, locked); } catch (err) { this._onError(err); }
  }

  /** Cierra la tarea con el valor de cada gremio; el resumen es el mayor (una tarea pesa lo que su gremio más cargado). */
  async _recordAgreementByGuild(values) {
    const value = judgeVotes(Object.values(values), deckOf(this._session)).highest;
    if (!value) return;
    try {
      await recordAgreement(this.sessionId, { title: this._shownTitle, ref: this._voteRef, value, values, round: this._round });
      const task = this._currentTask;
      const { tasks, nextId } = closeTask(this._tasks, task.id, value, values);
      await closeCurrentTask(this.sessionId, tasks, nextId);
    } catch (err) { this._onError(err); }
  }

  /**
   * Linear por gremio (RMR-PCS-0043 · F5): con la tarea cerrada por gremios y
   * referencia en el título, el organizador la envía; después, los enlaces.
   */
  _renderLinear(task) {
    const enviado = task.linear?.subIssues;
    if (Array.isArray(enviado)) {
      return html`<span class="guild-values linear-links">${enviado.map((si) => this._renderLinearLink(si))}</span>`;
    }
    // Solo una tarea CERRADA por gremios (con su valor y sus values) y con referencia; nunca la que se está estimando.
    const porGremios = Array.isArray(task.guilds) && task.guilds.length > 0;
    const cerrada = porGremios && task.value != null && task.values && typeof task.values === 'object' && Object.keys(task.values).length > 0;
    if (!this.canManage || !cerrada || task.id === this._currentTask?.id || !findLinearRef(task.title)) return null;
    const busy = this._linearBusy === task.id || task.linear?.pending === true;
    return html`<button class="linear-btn" ?disabled=${busy} @click=${() => this._pushLinear(task)}
      title="Crea en Linear una sub-issue por gremio con su estimación y deja un comentario resumen en la historia">
      ${busy ? 'Enviando a Linear…' : 'Sub-issues en Linear'}</button>`;
  }

  /** Solo se enlaza a Linear de verdad: cualquier otra cosa en `url` se pinta sin enlace. */
  _renderLinearLink(si) {
    const url = typeof si?.url === 'string' && si.url.startsWith('https://linear.app/') ? si.url : null;
    const texto = `${si?.guild ?? ''} ${si?.identifier ?? ''}`.trim();
    if (!url) return html`<span class="chip">${texto}</span>`;
    return html`<a class="chip" href=${url} target="_blank" rel="noopener noreferrer">${texto} ↗</a>`;
  }

  async _pushLinear(task) {
    this._linearBusy = task.id;
    this._error = '';
    try {
      await pushLinearEstimates(this.sessionId, task.id);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se ha podido enviar a Linear.';
    } finally {
      this._linearBusy = null;
    }
  }

  /** Los valores por gremio de una tarea o acuerdo, como chips. */
  _renderValues(values) {
    if (!values || typeof values !== 'object') return null;
    const entradas = Object.entries(values);
    if (entradas.length === 0) return null;
    return html`<span class="guild-values">${entradas.map(([g, v]) => html`<span class="chip">${g} ${cardLabel(v)}</span>`)}</span>`;
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

  /** Los gremios de la tarea actual se cambian aquí mismo, antes de votar, y lo ven todos (RMR-PCS-0043 · F1). */
  async _setTaskGuilds(task, guilds) {
    try {
      await setSessionTasks(this.sessionId, setTaskGuilds(this._tasks, task.id, guilds, this._guildCatalog), this._currentTask?.id ?? null);
    } catch (err) { this._onError(err); }
  }

  async _addTask() {
    const { tasks, task } = appendTask(this._tasks, this._taskDraft, Date.now(), defaultGuilds(this._guildCatalog));
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
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      <ol class="results">
        ${this._tasks.map((task) => html`<li>
          <span class="est">${task.value == null ? '—' : cardLabel(task.value)}</span>
          <span class="qtitle">${task.title}</span>
          ${this._renderValues(task.values)}
          ${this._renderLinear(task)}
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
      if (!t) return null;
      const ref = this._voteRef ? html` <span class="ref">${this._voteRef}</span>` : null;
      const gremios = task ? html`<div class="guild-bar"><span class="lead">Gremios:</span><guild-picker readonly .value=${taskGuilds(task)}></guild-picker></div>` : null;
      return html`<div class="bar title-bar"><p class="lead">Estimando: <strong>${t}</strong>${ref}</p>${this._renderReopenIssue()}</div>${gremios}`;
    }
    // Con lista de tareas (RMR-TSK-0522) la actual es el título; sin tarea
    // actual, el organizador añade otra o termina.
    if (task) {
      const guildLabel = `Gremios de ${task.title}`;
      return html`<div class="bar title-bar">
        <p class="lead">Estimando: <strong>${task.title}</strong> <span class="muted">(${this._tasks.filter((x) => x.value != null).length}/${this._tasks.length})</span></p>
        ${this._renderIssueButton(findLinearRef(task.title))}
      </div>
      <div class="guild-bar">
        <span class="lead">Gremios:</span>
        <guild-picker .catalog=${this._guildCatalog} .value=${taskGuilds(task)} label=${guildLabel}
          @change=${(e) => this._setTaskGuilds(task, e.detail.guilds)}></guild-picker>
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
    this._issueLocalOpen = false;
    if (this.canManage) { this._closeIssueForAll(); return; }
    this._issueDismissed = this._voteIssue?.identifier ?? null;
  }

  /**
   * Quien vota puede releer la historia aunque el organizador la haya cerrado
   * para todos (RMR-TSK-0536): se abre solo en su pantalla.
   */
  _renderReopenIssue() {
    const ref = findLinearRef(this._currentTask?.title ?? this._voteTitle);
    if (this.canManage || !ref || this._voteIssue?.identifier !== ref) return null;
    if (this._issueOpen && this._issueDismissed !== ref) return null; // ya está abierta para todos
    return html`<button class="act" @click=${() => { this._issueLocalOpen = true; }}>Ver historia ${ref}</button>`;
  }

  /** La historia, en un modal por encima de todo, en todas las pantallas a la vez. */
  _renderIssueModal() {
    const i = this._voteIssue;
    const paraTodos = this._issueOpen && this._issueDismissed !== i?.identifier;
    if (!i || !(paraTodos || this._issueLocalOpen)) return null;
    const meta = [i.state, i.estimate != null ? `estimación ${i.estimate}` : null, i.priority, i.assignee, i.project]
      .filter(Boolean);
    return html`<app-modal .open=${true} size="wide" heading=${`${i.identifier} · ${i.title}`} @close=${() => this._dismissIssue()}>
      <div class="issue" aria-label="Historia de Linear">
        ${i.url ? html`<a class="ref" href=${i.url} target="_blank" rel="noopener">Abrir en Linear ↗</a>` : null}
        ${meta.length ? html`<p class="issue-meta">${meta.join(' · ')}</p>` : null}
        ${i.labels?.length ? html`<div class="dist">${i.labels.map((l) => html`<span class="chip">${l}</span>`)}</div>` : null}
        ${i.description ? html`<markdown-view class="issue-desc" .text=${i.description}></markdown-view>` : html`<p class="lead">Sin descripción.</p>`}
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
          ${this._renderValues(a.values)}
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
          ${this._renderValues(task.values)}
          ${this._renderLinear(task)}
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
