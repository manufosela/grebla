/**
 * <poker-app> — orquesta Scrum Poker (RMR-TSK-0317). El manager/head crea sesiones
 * y las gestiona; al abrir una se muestra la mesa (poker-table). El ingeniero ve
 * las sesiones de su equipo y participa igual (sin crear).
 *
 * Props: uid, leaderUid (manager cuyas sesiones se ven), leaderUids (rama de un
 * supermanager), authorName (nombre para la presencia), canManage (dueño).
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import './poker-table.js';
import { listSessions, createSession, deleteSession, listSquads, getSession } from '../../lib/poker.js';
import { POKER_SCALES, scaleById } from '../../tools/poker/domain/deck.js';

export class PokerApp extends LitElement {
  static properties = {
    uid: { attribute: false },
    leaderUid: { attribute: false },
    leaderUids: { attribute: false },
    authorName: { attribute: false },
    canManage: { attribute: false },
    _selected: { state: true },
    _sessions: { state: true },
    _newName: { state: true },
    _newMode: { state: true },
    _newSquad: { state: true },
    _newScale: { state: true },
    _squads: { state: true },
    openSessionId: { attribute: false },
    _copied: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _tab: { state: true },
  };

  /**
   * Pestañas de quien convoca (RMR-TSK-0514): estimar es juego y convocar es
   * gestión. Apilados en la misma pantalla, quien entraba a votar se topaba
   * primero con el formulario. Quien solo estima no las ve: una pestaña sola
   * no es una pestaña.
   */
  static TABS = Object.freeze([
    Object.freeze({ id: 'sesiones', label: 'Sesiones' }),
    Object.freeze({ id: 'convocar', label: 'Convocar' }),
  ]);

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); }
    .detail { display: flex; flex-direction: column; gap: 1rem; }
    .detail-top { display: flex; gap: 0.6rem; flex-wrap: wrap; justify-content: space-between; }
    .back { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; padding: 0.4rem 0.8rem; font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
    .back:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .lead { margin: 0 0 1rem; color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .tabs { display: inline-flex; gap: 0.25rem; padding: 0.28rem; background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; margin: 0 0 1.1rem; }
    .tab { background: none; border: 0; padding: 0.5rem 1.15rem; font: inherit; font-weight: 600; font-size: 0.9rem; color: var(--rm-muted, #5b6b7d); cursor: pointer; border-radius: 9px; transition: background 0.12s, color 0.12s, box-shadow 0.12s; }
    .tab:hover { color: var(--teal); }
    .tab.on { background: var(--teal); color: var(--rm-on-accent, #fff); box-shadow: 0 1px 4px rgba(42,157,143,0.4); }
    .create { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.4rem; max-width: 34rem; }
    .create input, .create select { padding: 0.55rem 0.75rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
    .create input:focus, .create select:focus { outline: none; border-color: var(--teal); background: var(--rm-surface, #fff); }
    .modes { display: flex; gap: 1.2rem; flex-wrap: wrap; font-size: 0.9rem; color: var(--rm-text, #1e3a5f); }
    .modes label { display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; }
    /* Escala y cartas de la sesión que se convoca (RMR-TSK-0481). */
    .scale { display: flex; flex-direction: column; gap: 0.5rem; }
    .scale .hint { margin: 0; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); }
    button { font: inherit; cursor: pointer; border-radius: 8px; font-weight: 600; }
    .create button { align-self: flex-start; border: 1px solid var(--teal); background: var(--teal); color: var(--rm-on-accent, #fff); padding: 0.55rem 1.2rem; }
    .create button:disabled { opacity: 0.5; cursor: default; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.55rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #5b6b7d); font-weight: 600; font-size: 0.78rem; }
    .chip { display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 999px; }
    .chip.open { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .chip.closed { background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); }
    .act { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 8px; padding: 0.25rem 0.7rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .act.danger:hover { border-color: #b42318; color: #b42318; }
    .act:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; padding: 0.5rem 0; }
    .error { color: #b42318; font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.uid = null;
    this.leaderUid = null;
    this.leaderUids = null;
    this.authorName = '';
    this.canManage = false;
    this._selected = null;
    this._sessions = [];
    this._newName = '';
    this._newMode = 'simple';
    this._newSquad = '';
    this._newScale = POKER_SCALES[0].id;
    this._squads = [];
    this.openSessionId = null;
    this._copied = false;
    this._loading = false;
    this._error = '';
    this._loadedFor = null;
    this._openedShared = false;
    this._tab = 'sesiones';
  }

  /** De quién son las sesiones que se ven: la rama del supermanager, o su manager. */
  get _ownerScope() {
    return this.leaderUids?.length ? this.leaderUids : this.leaderUid;
  }

  get _sourcesKey() {
    return this.leaderUids?.length ? this.leaderUids.join(',') : (this.leaderUid ?? '');
  }

  updated(changed) {
    // Enlace compartido: abrir la sesión directamente en cuanto haya uid.
    if ((changed.has('openSessionId') || changed.has('uid'))
        && this.openSessionId && this.uid && !this._openedShared) {
      this._openedShared = true;
      this._openShared(this.openSessionId);
    }
    if (!changed.has('leaderUid') && !changed.has('leaderUids') && !changed.has('canManage')) return;
    const key = this._sourcesKey;
    if (!key || key === this._loadedFor) return;
    this._loadedFor = key;
    this._loadList();
  }

  async _openShared(id) {
    try {
      const session = await getSession(id);
      if (session) this._select(session);
      else this._error = 'Esa sesión no existe o se ha cerrado.';
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo abrir la sesión.';
    }
  }

  async _shareLink(session) {
    const url = `${location.origin}/poker?s=${session.id}`;
    try {
      await navigator.clipboard.writeText(url);
      this._copied = true;
      setTimeout(() => { this._copied = false; }, 2000);
    } catch {
      // Sin permiso de portapapeles: se muestra la URL para copiarla a mano.
      this._error = url;
    }
  }

  async _loadList() {
    this._loading = true;
    this._error = '';
    try {
      const sessions = await listSessions(this._ownerScope);
      this._sessions = sessions.filter((s) => s.status !== 'closed');
      if (this.canManage && !this._squads.length) {
        this._squads = await listSquads().catch(() => []);
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las sesiones.';
    } finally {
      this._loading = false;
    }
  }

  /**
   * Escala de la sesión que se va a convocar (RMR-TSK-0481). El mazo es fijo
   * (RMR-TSK-0515): se enseña para que quien convoca sepa con qué cartas se va
   * a votar, no para recortarlo.
   */
  _renderScalePicker() {
    const escala = scaleById(this._newScale);
    return html`
      <div class="scale">
        <div class="modes">
          ${POKER_SCALES.map((s) => html`
            <label title=${s.hint}><input type="radio" name="scale" .checked=${this._newScale === s.id}
              @change=${() => { this._newScale = s.id; }} /> ${s.label}</label>`)}
        </div>
        <p class="hint">Cartas: ${escala.cards.join(' · ')}, más «?» y «☕».</p>
      </div>`;
  }

  async _create() {
    const name = this._newName.trim();
    if (!name || !this.leaderUid) return;
    if (this._newMode === 'linear' && !this._newSquad) {
      this._error = 'Elige un squad para el modo Linear.';
      return;
    }
    try {
      const squad = this._newMode === 'linear'
        ? this._squads.find((s) => s.linearLabel === this._newSquad) ?? null
        : null;
      const id = await createSession({
        name, ownerLeaderUid: this.leaderUid, mode: this._newMode, squad,
        scale: this._newScale,
      });
      this._newName = '';
      this._error = '';
      // Convocada: al volver de la mesa se aterriza en la lista, no en el formulario.
      this._tab = 'sesiones';
      await this._loadList();
      const created = this._sessions.find((s) => s.id === id);
      if (created) this._select(created);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo crear la sesión.';
    }
  }

  async _delete(session) {
    try {
      await deleteSession(session.id);
      this._sessions = this._sessions.filter((s) => s.id !== session.id);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar la sesión.';
    }
  }

  _select(session) { this._selected = session; }
  _backToList() { this._selected = null; this._loadList(); }

  _renderDetail() {
    const s = this._selected;
    return html`<div class="detail">
      <div class="detail-top">
        <button class="back" @click=${() => this._backToList()}>← Volver a las sesiones</button>
        <button class="back" @click=${() => this._shareLink(s)}>${this._copied ? '✓ Enlace copiado' : '🔗 Compartir enlace'}</button>
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      <poker-table .sessionId=${s.id} .uid=${this.uid} .authorName=${this.authorName ?? ''}
        .canManage=${this.canManage && s.ownerLeaderUid === this.uid}></poker-table>
    </div>`;
  }

  _renderTabs() {
    return html`<div class="tabs" role="tablist" aria-label="Scrum Poker">
      ${PokerApp.TABS.map((t) => html`<button type="button" class="tab ${this._tab === t.id ? 'on' : ''}"
        role="tab" aria-selected=${this._tab === t.id ? 'true' : 'false'}
        @click=${() => { this._tab = t.id; }}>${t.label}</button>`)}
    </div>`;
  }

  _renderCreate() {
    return html`<div class="create">
      <input type="text" placeholder="Nombre de la sesión (p. ej. «Refinamiento sprint 12»)" .value=${this._newName}
        @input=${(e) => { this._newName = e.target.value; }}
        @keydown=${(e) => { if (e.key === 'Enter') this._create(); }} />
      <div class="modes">
        <label><input type="radio" name="mode" .checked=${this._newMode === 'simple'}
          @change=${() => { this._newMode = 'simple'; }} /> Voto simple</label>
        <label><input type="radio" name="mode" .checked=${this._newMode === 'linear'}
          @change=${() => { this._newMode = 'linear'; }} /> Refinar backlog (Linear)</label>
      </div>
      ${this._newMode === 'linear' ? html`
        <select @change=${(e) => { this._newSquad = e.target.value; }}>
          <option value="">Elige un squad…</option>
          ${this._squads.map((s) => html`<option value=${s.linearLabel} .selected=${this._newSquad === s.linearLabel}>${s.name}</option>`)}
        </select>` : null}
      ${this._renderScalePicker()}
      <button @click=${() => this._create()} ?disabled=${!this._newName.trim()}>Crear sesión</button>
    </div>`;
  }

  _renderSessions() {
    if (!this._sessions.length) {
      return html`<p class="empty">${this.canManage ? 'Aún no has creado ninguna sesión.' : 'Tu equipo aún no tiene sesiones de poker.'}</p>`;
    }
    return html`
      <p class="lead">${this.canManage ? 'Tus sesiones de estimación.' : 'Sesiones de tu equipo. Ábrela para votar.'}</p>
      <table>
        <thead><tr><th>Sesión</th><th></th>${this.canManage ? html`<th></th>` : null}</tr></thead>
        <tbody>${this._sessions.map((s) => html`<tr>
          <td>${s.name}</td>
          <td><button class="act" @click=${() => this._select(s)}>Abrir</button></td>
          ${this.canManage ? html`<td><button class="act danger" @click=${() => this._delete(s)}>Borrar</button></td>` : null}
        </tr>`)}</tbody>
      </table>`;
  }

  _renderList() {
    if (this._loading) return skeletonLines(4);
    const error = this._error ? html`<p class="error">${this._error}</p>` : null;
    if (!this.canManage) return html`${error}${this._renderSessions()}`;
    const body = this._tab === 'convocar' ? this._renderCreate() : this._renderSessions();
    return html`${this._renderTabs()}${error}${body}`;
  }

  render() {
    return this._selected ? this._renderDetail() : this._renderList();
  }
}

if (!customElements.get('poker-app')) {
  customElements.define('poker-app', PokerApp);
}
