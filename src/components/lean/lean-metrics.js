/**
 * <lean-metrics> — dashboard de flujo (LEAN): tarjetas globales + tabla por equipo
 * con throughput, cycle time (p50/p85), WIP y aging. Solo lectura. Espeja a
 * <dora-metrics>. Reutiliza `formatHours` de DORA para las duraciones.
 */
import { LitElement, html, css } from 'lit';
import { getFlowSummary } from '../../tools/lean/application/usecases.js';
import { formatHours } from '../dora/format.js';

const num = (v) => (v == null ? '—' : v);
const days = (v) => (v == null ? '—' : `${v} d`);
const hrs = (v) => formatHours(v) ?? '—';
const pct = (v) => (v == null ? '—' : `${v} %`);
/** Aging alto (posible atasco) si supera ~2 semanas. */
const AGING_WARN_DAYS = 14;
/** Flow efficiency baja (mucho tiempo esperando) por debajo de este %. */
const FLOW_EFF_WARN_PCT = 25;

export class LeanMetrics extends LitElement {
  static properties = {
    persistence: { attribute: false },
    _summary: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    h3 { font-size: 1rem; margin: 0 0 0.75rem; color: var(--rm-navy, #1e3a5f); }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin: 0 0 1.5rem; }
    .card { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 0.75rem 0.9rem; display: flex; flex-direction: column; gap: 0.2rem; }
    .card .value { font-size: 1.7rem; font-weight: 800; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; }
    .card .value.warn { color: var(--rm-danger, #dc2626); }
    .card .label { font-size: 0.76rem; color: var(--rm-muted, #6b7280); }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .key-cell { font-weight: 700; font-family: ui-monospace, monospace; }
    .warn { color: var(--rm-danger, #dc2626); font-weight: 700; }
    .note { font-size: 0.78rem; color: var(--rm-muted, #6b7280); margin: 0.5rem 0 0; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this._summary = null;
    this._loading = false;
    this._error = '';
    this._loaded = false;
  }

  updated(changed) {
    if (changed.has('persistence') && this.persistence && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      this._summary = await getFlowSummary(this.persistence);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las métricas.';
    } finally {
      this._loading = false;
    }
  }

  render() {
    if (this._error) return html`<p class="error">${this._error}</p>`;
    if (this._loading || !this._summary) return html`<p class="empty">Cargando métricas…</p>`;
    const { global, teams } = this._summary;
    const withMetrics = teams.filter((t) => t.metrics && !t.metrics.error);
    if (withMetrics.length === 0) {
      return html`<p class="empty">Aún no hay métricas. Añade un equipo de Linear y pulsa «↻ Recalcular desde Linear» en la pestaña Equipos.</p>`;
    }
    return html`
      <h3>Global (${global.teams} equipo${global.teams === 1 ? '' : 's'})</h3>
      ${this._renderCards(global)}
      <h3>Por equipo</h3>
      ${this._renderTable(withMetrics)}
      <p class="note">Ventana móvil de las últimas 8 semanas. WIP y aging son una foto del momento del último cálculo. Métrica de equipo, nunca individual.</p>
    `;
  }

  _renderCards(g) {
    const agingWarn = g.agingDaysMax != null && g.agingDaysMax >= AGING_WARN_DAYS;
    const flowWarn = g.flowEfficiencyPct != null && g.flowEfficiencyPct < FLOW_EFF_WARN_PCT;
    return html`<div class="cards">
      <div class="card"><span class="value">${num(g.throughputPerWeek)}</span><span class="label">Throughput / semana</span></div>
      <div class="card"><span class="value">${hrs(g.cycleTimeP50Hours)}</span><span class="label">Cycle time (p50)</span></div>
      <div class="card"><span class="value">${hrs(g.cycleTimeP85Hours)}</span><span class="label">Cycle time (p85)</span></div>
      <div class="card"><span class="value">${num(g.wip)}</span><span class="label">WIP (en curso)</span></div>
      <div class="card"><span class="value ${agingWarn ? 'warn' : ''}">${days(g.agingDaysMax)}</span><span class="label">Aging máx.</span></div>
      <div class="card"><span class="value ${flowWarn ? 'warn' : ''}">${pct(g.flowEfficiencyPct)}</span><span class="label">Flow efficiency</span></div>
    </div>`;
  }

  _renderTable(teams) {
    return html`<table>
      <thead><tr>
        <th>Equipo</th><th class="num">Throughput/sem</th><th class="num">Cycle p50</th>
        <th class="num">Cycle p85</th><th class="num">WIP</th><th class="num">Aging máx</th><th class="num">Flow eff.</th>
      </tr></thead>
      <tbody>${teams.map((t) => this._renderRow(t))}</tbody>
    </table>`;
  }

  _renderRow(t) {
    const m = t.metrics;
    const agingWarn = m.agingDaysMax != null && m.agingDaysMax >= AGING_WARN_DAYS;
    const flowWarn = m.flowEfficiencyPct != null && m.flowEfficiencyPct < FLOW_EFF_WARN_PCT;
    return html`<tr>
      <td><span class="key-cell">${t.linearTeamKey}</span> ${t.name}</td>
      <td class="num">${num(m.throughputPerWeek)}</td>
      <td class="num">${hrs(m.cycleTimeP50Hours)}</td>
      <td class="num">${hrs(m.cycleTimeP85Hours)}</td>
      <td class="num">${num(m.wip)}</td>
      <td class="num ${agingWarn ? 'warn' : ''}">${days(m.agingDaysMax)}</td>
      <td class="num ${flowWarn ? 'warn' : ''}">${pct(m.flowEfficiencyPct)}</td>
    </tr>`;
  }
}

if (!customElements.get('lean-metrics')) {
  customElements.define('lean-metrics', LeanMetrics);
}
