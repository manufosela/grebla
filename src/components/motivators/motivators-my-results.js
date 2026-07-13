/**
 * <motivators-my-results> — histórico PRIVADO del jugador: sus órdenes por ronda.
 * Solo lo ve el propio usuario (las reglas de Firestore restringen la lectura a su
 * uid). Lee `getMyHistory(persistence, uid, game)`.
 */
import { LitElement, html, css } from 'lit';
import { getMyHistory } from '../../tools/motivators/application/usecases.js';
import { accentStyle } from './accent.js';

const STAMP = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });

export class MotivatorsMyResults extends LitElement {
  static properties = {
    persistence: { attribute: false },
    deck: { attribute: false },
    uid: { type: String },
    rounds: { attribute: false },
    _sessions: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.95rem; padding: 0.5rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.9rem; }
    .session { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 0.85rem 1rem; margin: 0 0 1rem; }
    .session h3 { margin: 0 0 0.15rem; font-size: 1rem; color: var(--rm-text, #111827); }
    .when { color: var(--rm-muted, #6b7280); font-size: 0.8rem; margin: 0 0 0.6rem; }
    ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.25rem; }
    li { display: flex; align-items: baseline; gap: 0.6rem; font-size: 0.9rem; }
    .rank { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; background: var(--accent-soft); color: var(--accent-ink);
      font-weight: 800; font-size: 0.78rem; display: grid; place-items: center; }
    .cname { color: var(--rm-text, #1a1a1a); }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.deck = null;
    this.uid = '';
    this.rounds = [];
    this._sessions = null;
    this._loading = false;
    this._error = '';
    this._loaded = false;
  }

  updated(changed) {
    if ((changed.has('persistence') || changed.has('uid')) && this.persistence && this.uid && this.deck && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._sessions = await getMyHistory(this.persistence, this.uid, this.deck.game);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar tu histórico.';
    } finally {
      this._loading = false;
    }
  }

  _roundName(roundId) {
    return (this.rounds ?? []).find((r) => r.id === roundId)?.name ?? 'Ronda';
  }

  _cardName(id) {
    return (this.deck?.cards ?? []).find((c) => c.id === id)?.name ?? id;
  }

  render() {
    if (this._loading && !this._sessions) return html`<p class="empty">Cargando tu histórico…</p>`;
    const sessions = [...(this._sessions ?? [])].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    if (sessions.length === 0) {
      return html`<p class="empty">Aún no has ordenado tus cartas en ninguna ronda. Cuando lo hagas, tu histórico aparecerá aquí (solo lo ves tú).</p>`;
    }
    return html`
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      <div style=${accentStyle(this.deck?.accent)}>${sessions.map((s) => this._renderSession(s))}</div>`;
  }

  _renderSession(s) {
    const orden = [...(s.orden ?? [])].sort((a, b) => a.posicion - b.posicion);
    return html`<div class="session">
      <h3>${this._roundName(s.roundId)}</h3>
      <p class="when">${s.fecha ? STAMP.format(new Date(s.fecha)) : ''}</p>
      <ol>${orden.map((p) => this._renderPlacement(p))}</ol>
    </div>`;
  }

  _renderPlacement(p) {
    return html`<li><span class="rank">${p.posicion}</span><span class="cname">${this._cardName(p.motivadorId)}</span></li>`;
  }
}

if (!customElements.get('motivators-my-results')) {
  customElements.define('motivators-my-results', MotivatorsMyResults);
}
