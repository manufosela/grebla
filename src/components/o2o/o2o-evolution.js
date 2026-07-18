/**
 * <o2o-evolution> — evolución del ciclo de O2O ENTRE periodos: para cada periodo,
 * la cobertura del equipo (cuántos tienen su O2O) y el nº de sesiones. Permite ver
 * la tendencia (p. ej. Julio 6/8 → Septiembre 8/8). Solo lectura.
 *
 * Props: persistence, people.
 */
import { LitElement, html, css } from 'lit';
import { skeletonBlock } from '../app-skeleton.js';
import { listPeriods } from '../../tools/o2o/application/usecases/periods.js';
import { listAllSessions } from '../../tools/o2o/application/usecases/sessions.js';
import { evolutionOf } from '../../tools/o2o/application/usecases/periodStats.js';

export class O2OEvolution extends LitElement {
  static properties = {
    persistence: { attribute: false },
    people: { attribute: false },
    _rows: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .lead { font-size: 0.88rem; color: var(--rm-muted, #6b7280); margin: 0 0 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); font-size: 0.88rem; }
    th { font-size: 0.75rem; color: var(--rm-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.03em; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .barcell { display: flex; align-items: center; gap: 0.5rem; }
    .bar { flex: 1; height: 8px; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; min-width: 5rem; }
    .bar span { display: block; height: 100%; background: var(--rm-accent, #2a9d8f); }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.people = [];
    this._rows = [];
    this._loading = false;
    this._error = '';
    this._loaded = false;
  }

  updated() {
    if (this.persistence && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      const [periods, sessions] = await Promise.all([
        listPeriods(this.persistence),
        listAllSessions(this.persistence),
      ]);
      this._rows = evolutionOf(periods, sessions, this.people);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar la evolución.';
    } finally {
      this._loading = false;
    }
  }

  render() {
    if (this._loading) return skeletonBlock('200px');
    if (this._error) return html`<p class="error">${this._error}</p>`;
    if (!this._rows.length) return html`<p class="empty">Aún no hay periodos que comparar.</p>`;
    return html`
      <p class="lead">Cobertura del equipo por periodo (cuántas personas tuvieron su O2O). Sirve para ver si el ciclo se mantiene.</p>
      <table>
        <thead><tr><th>Periodo</th><th>Cobertura</th><th class="num">%</th><th class="num">Sesiones</th></tr></thead>
        <tbody>${this._rows.map((r) => this._renderRow(r))}</tbody>
      </table>
    `;
  }

  _renderRow(r) {
    return html`<tr>
      <td>${r.name}</td>
      <td>
        <div class="barcell">
          <span>${r.done}/${r.total}</span>
          <span class="bar"><span style=${`width:${r.pct}%`}></span></span>
        </div>
      </td>
      <td class="num">${r.pct}%</td>
      <td class="num">${r.sessions}</td>
    </tr>`;
  }
}

if (!customElements.get('o2o-evolution')) {
  customElements.define('o2o-evolution', O2OEvolution);
}
