/**
 * <dora-metrics>
 * Dashboards DORA agregados: global + por equipo + por gremio. Lee getDoraSummary
 * (sobre las métricas ya calculadas por repo). Siempre a nivel de equipo (R3).
 *
 * Propiedades:
 *  - persistence: DoraPersistence
 */
import { LitElement, html, css } from 'lit';
import { getDoraSummary } from '../../tools/dora/application/usecases.js';

const lt = (v) => (v != null ? `${v} h` : '—');

export class DoraMetrics extends LitElement {
  static properties = {
    persistence: { attribute: false },
    summary: { state: true },
    loading: { state: true },
    error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    section { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb); border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; }
    h2 { font-size: 1.05rem; margin: 0 0 1rem; }
    .cards { display: flex; flex-wrap: wrap; gap: 1.5rem; }
    .card { display: flex; flex-direction: column; gap: 0.2rem; }
    .card .value { font-size: 1.7rem; font-weight: 800; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; }
    .card .label { font-size: 0.78rem; color: var(--rm-muted, #6b7280); }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .empty { color: var(--rm-muted, #9ca3af); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .note { font-size: 0.75rem; color: var(--rm-muted, #9ca3af); margin-top: 0.5rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.summary = null;
    this.loading = true;
    this.error = '';
    this._loaded = false;
  }

  updated() {
    if (this.persistence && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      this.summary = await getDoraSummary(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el resumen.';
    } finally {
      this.loading = false;
    }
  }

  _table(title, rows) {
    return html`
      <section>
        <h2>${title}</h2>
        ${rows.length === 0
          ? html`<p class="empty">Sin datos.</p>`
          : html`
              <table>
                <thead>
                  <tr><th>${title.includes('equipo') ? 'Equipo' : 'Gremio'}</th><th class="num">Repos</th><th class="num">Despliegues</th><th class="num">Deploy/sem</th><th class="num">Lead time</th></tr>
                </thead>
                <tbody>
                  ${rows.map(
                    (g) => html`<tr>
                      <td>${g.key}</td>
                      <td class="num">${g.measured}/${g.repos}</td>
                      <td class="num">${g.deployments}</td>
                      <td class="num">${g.deployFrequencyPerWeek}</td>
                      <td class="num">${lt(g.leadTimeHoursAvg)}</td>
                    </tr>`,
                  )}
                </tbody>
              </table>
            `}
      </section>
    `;
  }

  render() {
    if (this.loading) return html`<p class="empty">Cargando métricas…</p>`;
    if (this.error) return html`<p class="error">${this.error}</p>`;
    const s = this.summary;
    if (!s) return html`<p class="empty">Sin datos.</p>`;
    if (s.global.measured === 0) {
      return html`<section><p class="empty">Aún no hay métricas. Ve a <strong>Repos</strong>, añade repos públicos y pulsa “Actualizar métricas”.</p></section>`;
    }
    const g = s.global;
    return html`
      <section>
        <h2>Global (${g.measured}/${g.repos} repos medidos)</h2>
        <div class="cards">
          <div class="card"><span class="value">${g.deployments}</span><span class="label">Despliegues (merges)</span></div>
          <div class="card"><span class="value">${g.deployFrequencyPerWeek}</span><span class="label">Deploy / semana</span></div>
          <div class="card"><span class="value">${lt(g.leadTimeHoursAvg)}</span><span class="label">Lead time medio</span></div>
        </div>
        <p class="note">Lead time agregado = media ponderada por despliegues. Métricas de equipo, nunca por persona (R3).</p>
      </section>
      ${this._table('Por equipo', s.byTeam)}
      ${this._table('Por gremio', s.byGuild)}
    `;
  }
}

if (!customElements.get('dora-metrics')) {
  customElements.define('dora-metrics', DoraMetrics);
}
