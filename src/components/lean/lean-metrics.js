/**
 * <lean-metrics> — dashboard de flujo (LEAN) separado por Equipos (Squad) y Gremios
 * (Chapter): tarjetas globales + tabla por unidad, con throughput, cycle time
 * (p50/p85), WIP, aging y flow efficiency. Solo lectura. Reutiliza `formatHours` de DORA.
 */
import { LitElement, html, css } from 'lit';
import { getFlowSummary } from '../../tools/lean/application/usecases.js';
import { flowEfficiencyLevel, agingLevel } from '../../tools/lean/domain/levels.js';
import { formatHours } from '../dora/format.js';
import { levelBadge, levelStyles } from '../dora/level-badge.js';
import '../shared/metrics-interpretation.js';

const num = (v) => (v == null ? '—' : v);
const days = (v) => (v == null ? '—' : `${v} d`);
const hrs = (v) => formatHours(v) ?? '—';
const pct = (v) => (v == null ? '—' : `${v} %`);

/** Ayuda de cada métrica: nombre completo, traducción y qué mide (tooltip «?»). */
const FIELD_HELP = {
  throughput: { name: 'Throughput', es: 'Rendimiento', what: 'Issues completadas por semana: cuánto trabajo termina el equipo.' },
  cycleP50: { name: 'Cycle time · p50', es: 'Tiempo de ciclo (mediana)', what: 'Desde que se empieza una issue hasta que se completa. La mitad tarda menos que esto.' },
  cycleP85: { name: 'Cycle time · p85', es: 'Tiempo de ciclo (percentil 85)', what: 'El 85 % de las issues tarda menos; refleja la cola de casos lentos.' },
  wip: { name: 'WIP', es: 'Trabajo en curso (Work In Progress)', what: 'Issues en curso ahora mismo. Mucho WIP = trabajo repartido o atascado.' },
  aging: { name: 'Aging', es: 'Antigüedad del trabajo en curso', what: 'Días que lleva sin cerrarse la issue en curso más vieja. Alto = algo atascado.' },
  flowEff: { name: 'Flow efficiency', es: 'Eficiencia de flujo', what: '% del tiempo de ciclo que se trabaja de verdad, frente a esperar en colas/review. Alta = poca espera.' },
};

export class LeanMetrics extends LitElement {
  static properties = {
    persistence: { attribute: false },
    interpret: { attribute: false },
    loadSaved: { attribute: false },
    canInterpret: { attribute: false },
    _summary: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = [css`
    :host { display: block; }
    h3 { font-size: 1.05rem; margin: 1.25rem 0 0.75rem; color: var(--rm-navy, #1e3a5f); }
    h3:first-of-type { margin-top: 0; }
    h4 { font-size: 0.85rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.4rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin: 0 0 1rem; }
    .card { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 0.7rem 0.85rem; display: flex; flex-direction: column; gap: 0.15rem; }
    .card .value { font-size: 1.5rem; font-weight: 800; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; }
    .card .label { font-size: 0.74rem; color: var(--rm-muted, #6b7280); }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin: 0 0 0.5rem; }
    th, td { text-align: left; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .label-cell { font-weight: 700; }
    .note { font-size: 0.78rem; color: var(--rm-muted, #6b7280); margin: 0.5rem 0 1.25rem; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .val-line { display: inline-flex; align-items: center; gap: 0.35rem; }
    .label { display: inline-flex; align-items: center; gap: 0.25rem; }
    .help {
      position: relative; display: inline-grid; place-items: center; width: 14px; height: 14px;
      border-radius: 50%; border: 1px solid var(--rm-muted, #9ca3af); color: var(--rm-muted, #9ca3af);
      font-size: 0.62rem; font-weight: 700; cursor: help; flex: 0 0 auto;
    }
    .help:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 1px; }
    .help .tip {
      position: absolute; bottom: 150%; left: 50%; transform: translateX(-50%); z-index: 6;
      width: 220px; background: var(--rm-navy, #1e3a5f); color: #fff; text-align: left;
      padding: 0.5rem 0.6rem; border-radius: 8px; font-size: 0.72rem; font-weight: 400; line-height: 1.35;
      box-shadow: 0 6px 20px rgba(15, 27, 45, 0.3); opacity: 0; pointer-events: none; transition: opacity 0.12s;
    }
    .help:hover .tip, .help:focus .tip, .help:focus-within .tip { opacity: 1; }
    .help .tip strong { display: block; margin-bottom: 0.15rem; }
  `, levelStyles];

  constructor() {
    super();
    this.persistence = null;
    this.interpret = null;
    this.loadSaved = null;
    this.canInterpret = false;
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
    const { squads, chapters } = this._summary;
    const hasAny = this._withMetrics(squads.units).length || this._withMetrics(chapters.units).length;
    if (!hasAny) {
      return html`<p class="empty">Aún no hay métricas. En la pestaña Equipos, «✨ Descubrir…» y luego «↻ Recalcular desde Linear».</p>`;
    }
    return html`
      ${this._renderSection('Equipos', squads, 'Equipo')}
      ${this._renderSection('Gremios', chapters, 'Gremio')}
      <metrics-interpretation
        .interpret=${this.interpret}
        .loadSaved=${this.loadSaved}
        .canInterpret=${this.canInterpret}
        .summary=${this._summary}
        tool="lean"
      ></metrics-interpretation>
      <p class="note">Ventana móvil de 8 semanas. WIP y aging son una foto del último cálculo. Métrica de equipo/gremio, nunca individual.</p>
    `;
  }

  _withMetrics(units) {
    return (units ?? []).filter((u) => u.metrics && !u.metrics.error);
  }

  _renderSection(title, group, unitWord) {
    const units = this._withMetrics(group.units);
    if (units.length === 0) return null;
    return html`
      <h3>${title} (${units.length})</h3>
      <h4>Global</h4>
      ${this._renderCards(group.global)}
      <h4>Por ${unitWord.toLowerCase()}</h4>
      ${this._renderTable(units, unitWord)}
    `;
  }

  /** Icono «?» con tooltip (nombre completo, traducción y qué mide) de una métrica. */
  _help(key) {
    const h = FIELD_HELP[key];
    if (!h) return null;
    return html`<span class="help" tabindex="0" role="note" aria-label="${h.name} (${h.es}): ${h.what}"
      >?<span class="tip"><strong>${h.name} — ${h.es}</strong>${h.what}</span></span>`;
  }

  _renderCards(g) {
    return html`<div class="cards">
      <div class="card"><span class="value">${num(g.throughputPerWeek)}</span><span class="label">Throughput / semana ${this._help('throughput')}</span></div>
      <div class="card"><span class="value">${hrs(g.cycleTimeP50Hours)}</span><span class="label">Cycle time (p50) ${this._help('cycleP50')}</span></div>
      <div class="card"><span class="value">${hrs(g.cycleTimeP85Hours)}</span><span class="label">Cycle time (p85) ${this._help('cycleP85')}</span></div>
      <div class="card"><span class="value">${num(g.wip)}</span><span class="label">WIP (en curso) ${this._help('wip')}</span></div>
      <div class="card"><span class="val-line"><span class="value">${days(g.agingDaysMax)}</span>${levelBadge(agingLevel(g.agingDaysMax))}</span><span class="label">Aging máx. ${this._help('aging')}</span></div>
      <div class="card"><span class="val-line"><span class="value">${pct(g.flowEfficiencyPct)}</span>${levelBadge(flowEfficiencyLevel(g.flowEfficiencyPct))}</span><span class="label">Flow efficiency ${this._help('flowEff')}</span></div>
    </div>`;
  }

  _renderTable(units, unitWord) {
    return html`<table>
      <thead><tr>
        <th>${unitWord}</th><th class="num">Throughput/sem</th><th class="num">Cycle p50</th>
        <th class="num">Cycle p85</th><th class="num">WIP</th><th class="num">Aging máx</th><th class="num">Flow eff.</th>
      </tr></thead>
      <tbody>${units.map((u) => this._renderRow(u))}</tbody>
    </table>`;
  }

  _renderRow(u) {
    const m = u.metrics;
    return html`<tr>
      <td class="label-cell">${u.name}</td>
      <td class="num">${num(m.throughputPerWeek)}</td>
      <td class="num">${hrs(m.cycleTimeP50Hours)}</td>
      <td class="num">${hrs(m.cycleTimeP85Hours)}</td>
      <td class="num">${num(m.wip)}</td>
      <td class="num">${days(m.agingDaysMax)}${levelBadge(agingLevel(m.agingDaysMax))}</td>
      <td class="num">${pct(m.flowEfficiencyPct)}${levelBadge(flowEfficiencyLevel(m.flowEfficiencyPct))}</td>
    </tr>`;
  }
}

if (!customElements.get('lean-metrics')) {
  customElements.define('lean-metrics', LeanMetrics);
}
