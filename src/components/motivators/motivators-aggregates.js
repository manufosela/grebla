/**
 * <motivators-aggregates> — resultados PÚBLICOS de un juego (los lee cualquiera).
 * Nunca muestra datos individuales: ranking por posición media, distribución top-3,
 * evolución entre rondas y desglose por equipo/manager. Lee el documento agregado que
 * escribe la Cloud Function (`getAggregates`). Barras/tablas CSS, sin charts.
 */
import { LitElement, html, css } from 'lit';
import { getAggregates } from '../../tools/motivators/application/usecases.js';
import { DECK_SIZE } from '../../tools/motivators/domain/types.js';
import { accentStyle } from './accent.js';

export class MotivatorsAggregates extends LitElement {
  static properties = {
    persistence: { attribute: false },
    deck: { attribute: false },
    leaderNames: { attribute: false },
    rounds: { attribute: false },
    _agg: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _scope: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.95rem; padding: 0.5rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.9rem; }
    .bar-top { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin: 0 0 1rem; }
    .respondents { font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    .legend { font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; line-height: 1.45; }
    label { font-size: 0.85rem; color: var(--rm-muted, #6b7280); }
    select { font: inherit; padding: 0.3rem 0.5rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); }
    h4 { margin: 1.25rem 0 0.6rem; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); }
    .row { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 0.6rem; padding: 0.35rem 0; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    .rank { width: 24px; height: 24px; border-radius: 50%; background: var(--accent-soft); color: var(--accent-ink);
      font-weight: 800; font-size: 0.78rem; display: grid; place-items: center; }
    .who { min-width: 0; }
    .who .name { font-weight: 700; color: var(--rm-text, #111827); font-size: 0.92rem; }
    .track { height: 8px; border-radius: 999px; background: var(--rm-track, #e9f0f2); margin-top: 0.25rem; overflow: hidden; }
    .fill { height: 100%; background: var(--accent); border-radius: 999px; }
    .metric { text-align: right; font-variant-numeric: tabular-nums; }
    .metric .avg { font-weight: 800; color: var(--accent-ink); font-size: 0.95rem; }
    .metric .sub { display: block; font-size: 0.72rem; color: var(--rm-muted, #6b7280); }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 0.4rem; }
    th, td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); text-align: center; }
    th.mot, td.mot { text-align: left; font-weight: 700; color: var(--rm-text, #111827); }
    caption { caption-side: top; text-align: left; color: var(--rm-muted, #6b7280); font-size: 0.78rem; margin-bottom: 0.3rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.deck = null;
    this.leaderNames = {};
    this.rounds = [];
    this._agg = null;
    this._loading = false;
    this._error = '';
    this._scope = 'global';
    this._loaded = false;
  }

  updated(changed) {
    if (changed.has('persistence') && this.persistence && this.deck && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._agg = await getAggregates(this.persistence, this.deck.game);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los resultados.';
    } finally {
      this._loading = false;
    }
  }

  _cardName(id) {
    return (this.deck?.cards ?? []).find((c) => c.id === id)?.name ?? id;
  }

  _leaderLabel(uid) {
    return this.leaderNames?.[uid] ?? `Equipo ${String(uid).slice(0, 6)}`;
  }

  _roundName(roundId) {
    return (this.rounds ?? []).find((r) => r.id === roundId)?.name ?? roundId;
  }

  /** Los departamentos se distinguen de los equipos con un prefijo en el valor. */
  static DEPT_PREFIX = 'dept:';

  _block() {
    if (this._scope === 'global') return this._agg?.global ?? null;
    if (this._scope.startsWith(MotivatorsAggregates.DEPT_PREFIX)) {
      return this._agg?.byDepartment?.[this._scope.slice(MotivatorsAggregates.DEPT_PREFIX.length)] ?? null;
    }
    return this._agg?.byLeader?.[this._scope] ?? null;
  }

  /**
   * Nombre del ámbito elegido, sea departamento o equipo. Los departamentos se
   * agrupan por uid del Head (dos Heads pueden llamarse igual), así que el
   * nombre visible se resuelve con el mapa que publica el agregado.
   */
  _scopeLabel(scope) {
    if (!scope.startsWith(MotivatorsAggregates.DEPT_PREFIX)) return this._leaderLabel(scope);
    const uid = scope.slice(MotivatorsAggregates.DEPT_PREFIX.length);
    return this._agg?.departmentNames?.[uid] ?? uid;
  }

  render() {
    if (this._loading && !this._agg) return html`<p class="empty">Cargando resultados…</p>`;
    if (this._error) return html`<p class="error">${this._error}</p>`;
    if (!this._agg || (this._agg.respondents ?? 0) === 0) {
      return html`<p class="empty">Aún no hay resultados. Cuando haya sesiones guardadas en una ronda, aquí verás el ranking del equipo.</p>`;
    }
    const block = this._block();
    return html`
      <div style=${accentStyle(this.deck?.accent)}>
        <div class="bar-top">
          <span class="respondents">${this._agg.respondents} ${this._agg.respondents === 1 ? 'respuesta' : 'respuestas'} en total</span>
          ${this._renderScopeSelect()}
        </div>
        <h4>Ranking${this._scope === 'global' ? ' global' : ` · ${this._scopeLabel(this._scope)}`}</h4>
        ${this._renderRanking(block)}
        ${this._scope === 'global' ? this._renderEvolution() : null}
      </div>`;
  }

  _renderScopeSelect() {
    const leaders = Object.keys(this._agg.byLeader ?? {});
    const departments = Object.keys(this._agg.byDepartment ?? {});
    if (leaders.length === 0 && departments.length === 0) return null;
    return html`<span>
      <label for="scope">Ver: </label>
      <select id="scope" @change=${(e) => { this._scope = e.target.value; }}>
        <option value="global" ?selected=${this._scope === 'global'}>Global (toda la organización)</option>
        ${departments.length === 0 ? null : html`<optgroup label="Departamentos">
          ${departments.map((name) => this._deptOption(name))}
        </optgroup>`}
        ${leaders.length === 0 ? null : html`<optgroup label="Equipos">
          ${leaders.map((uid) => this._scopeOption(uid))}
        </optgroup>`}
      </select>
    </span>`;
  }

  _deptOption(uid) {
    const value = `${MotivatorsAggregates.DEPT_PREFIX}${uid}`;
    return html`<option value=${value} ?selected=${this._scope === value}>${this._agg?.departmentNames?.[uid] ?? uid}</option>`;
  }

  _scopeOption(uid) {
    return html`<option value=${uid} ?selected=${this._scope === uid}>${this._leaderLabel(uid)}</option>`;
  }

  _renderRanking(block) {
    if (!block || block.respondents === 0) return html`<p class="empty">Sin datos para esta vista.</p>`;
    const n = block.respondents;
    // Corte RETENIDO por anonimato (RMR-BUG-0051): con tan pocas respuestas, la
    // posición media y la distribución reconstruyen lo que eligió una persona
    // concreta. No es un fallo ni un dato que falte: es la garantía de que estos
    // juegos nunca señalan a nadie.
    const minCount = this._agg?.minCount ?? 3;
    if (n < minCount) {
      return html`<p class="empty">Hacen falta al menos ${minCount} respuestas para enseñar el ranking sin que se pueda deducir lo que eligió cada persona. Ahora mismo hay ${n}.</p>`;
    }
    return html`
      <p class="legend">Ordenados por <strong>posición media</strong> (1 = lo más prioritario para el equipo). La barra indica la prioridad relativa. Basado en ${n} ${n === 1 ? 'respuesta' : 'respuestas'}.</p>
      <div>${block.ranking.map((s, i) => this._renderRow(s, i))}</div>`;
  }

  /** Anchura de barra proporcional a la prioridad: media 1 → llena, media DECK_SIZE → mínima. */
  _priorityWidth(avg) {
    if (avg == null) return 0;
    return Math.round(((DECK_SIZE - avg + 1) / DECK_SIZE) * 100);
  }

  _renderRow(stat, i) {
    const width = this._priorityWidth(stat.averagePosition);
    const avg = stat.averagePosition == null ? '—' : stat.averagePosition.toFixed(1);
    const top3 = stat.top3Count > 0 ? ` · top-3 ${stat.top3Count}×` : '';
    return html`<div class="row">
      <span class="rank">${i + 1}</span>
      <div class="who">
        <div class="name">${this._cardName(stat.motivadorId)}</div>
        <div class="track"><div class="fill" style=${`width:${width}%`}></div></div>
      </div>
      <div class="metric"><span class="avg">${avg}</span><span class="sub">media${top3}</span></div>
    </div>`;
  }

  _renderEvolution() {
    const cardIds = (this.deck?.cards ?? []).map((c) => c.id);
    const roundIds = this._agg.evolution?.[cardIds[0]]?.map((e) => e.roundId) ?? [];
    if (roundIds.length < 2) return null; // la evolución necesita al menos 2 rondas
    return html`<h4>Evolución entre rondas</h4>
      <table>
        <caption>Posición media de cada motivador por ronda (más bajo = más prioritario).</caption>
        <thead><tr><th class="mot">Motivador</th>${roundIds.map((r) => this._evoHead(r))}</tr></thead>
        <tbody>${cardIds.map((id) => this._renderEvoRow(id, roundIds))}</tbody>
      </table>`;
  }

  _evoHead(roundId) {
    return html`<th>${this._roundName(roundId)}</th>`;
  }

  _evoCell(value) {
    return html`<td>${value ?? '—'}</td>`;
  }

  _renderEvoRow(cardId, roundIds) {
    const series = this._agg.evolution?.[cardId] ?? [];
    const byRound = new Map(series.map((e) => [e.roundId, e.averagePosition]));
    return html`<tr><td class="mot">${this._cardName(cardId)}</td>
      ${roundIds.map((r) => this._evoCell(byRound.get(r)))}</tr>`;
  }
}

if (!customElements.get('motivators-aggregates')) {
  customElements.define('motivators-aggregates', MotivatorsAggregates);
}
