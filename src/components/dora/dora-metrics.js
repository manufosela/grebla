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
import { leadTimeLevel, deployFrequencyLevel, changeFailureRateLevel, mttrLevel } from '../../tools/dora/domain/levels.js';
import { levelBadge, levelStyles } from './level-badge.js';
import { formatHours } from './format.js';

const lt = (v) => (v != null ? `${v} h` : '—');
/**
 * MTTR para tablas de grupo. Muestra la duración legible si hay incidentes
 * resueltos; si no, '—' (no medible). Sin badge de nivel: los umbrales son de D5.
 * @param {{ mttrHoursAvg: number|null, incidentsResolved: number }} g
 * @returns {string}
 */
const mttr = (g) => (g.incidentsResolved > 0 ? formatHours(g.mttrHoursAvg) : '—');
/**
 * Change Failure Rate para tablas de grupo. Muestra el porcentaje si hay
 * despliegues registrados; si no, '—' (no medible, mismo criterio que el lead
 * time real de D2). Sin badge de nivel: los umbrales son de D5.
 * @param {{ changeFailureRatePct: number|null, deploymentsTotal: number }} g
 * @returns {string}
 */
const cfr = (g) => (g.deploymentsTotal > 0 ? `${g.changeFailureRatePct}%` : '—');

export class DoraMetrics extends LitElement {
  static properties = {
    persistence: { attribute: false },
    summary: { state: true },
    loading: { state: true },
    error: { state: true },
  };

  static styles = [css`
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
  `, levelStyles];

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
                  <tr><th>${title.includes('equipo') ? 'Equipo' : 'Gremio'}</th><th class="num">Repos</th><th class="num">Despliegues</th><th class="num">Deploy/sem</th><th class="num">Lead time</th><th class="num">CFR</th><th class="num">MTTR</th><th class="num">Personas</th></tr>
                </thead>
                <tbody>
                  ${rows.map(
                    (g) => html`<tr>
                      <td>${g.key}</td>
                      <td class="num">${g.measured}/${g.repos}</td>
                      <td class="num">${g.deployments}</td>
                      <td class="num">${g.deployFrequencyPerWeek}${levelBadge(deployFrequencyLevel(g.deployFrequencyPerWeek))}</td>
                      <td class="num">${lt(g.leadTimeHoursAvg)}${levelBadge(leadTimeLevel(g.leadTimeHoursAvg))}</td>
                      <td class="num">${cfr(g)}${levelBadge(changeFailureRateLevel(g.changeFailureRatePct))}</td>
                      <td class="num">${mttr(g)}${levelBadge(mttrLevel(g.mttrHoursAvg))}</td>
                      <td class="num">${g.people}</td>
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
    // Lead time REAL (commit→deploy). Si no hay despliegues registrados es null:
    // se muestra el proxy (PR→merge) y se invita a registrar despliegues.
    const hasRealLead = g.leadTimeCommitDeployHoursAvg != null;
    // Change Failure Rate (D3): métrica REAL sobre los despliegues registrados
    // manualmente (D1). Si no hay despliegues registrados, no es medible.
    const hasDeploys = g.deploymentsTotal > 0;
    // MTTR (D4): métrica REAL sobre los incidentes registrados. Si no hay
    // incidentes resueltos, no es medible (se muestra el nº de abiertos si los hay).
    const hasResolved = g.incidentsResolved > 0;
    const mttrLabel = formatHours(g.mttrHoursAvg);
    return html`
      <section>
        <h2>Global (${g.measured}/${g.repos} repos medidos)</h2>
        <div class="cards">
          <div class="card"><span class="value">${g.deployments}</span><span class="label">Despliegues (merges)</span></div>
          <div class="card"><span class="value">${g.deployFrequencyPerWeek}${levelBadge(deployFrequencyLevel(g.deployFrequencyPerWeek))}</span><span class="label">Deploy / semana</span></div>
          <div class="card">
            <span class="value">${lt(g.leadTimeCommitDeployHoursAvg)}${levelBadge(leadTimeLevel(g.leadTimeCommitDeployHoursAvg))}</span>
            <span class="label">Lead time real (commit→deploy)</span>
          </div>
          <div class="card">
            <span class="value">${lt(g.leadTimeHoursAvg)}${levelBadge(leadTimeLevel(g.leadTimeHoursAvg))}</span>
            <span class="label">Lead time proxy (PR→merge)</span>
          </div>
          <div class="card">
            <span class="value">${hasDeploys ? `${g.changeFailureRatePct}%` : '—'}${hasDeploys ? levelBadge(changeFailureRateLevel(g.changeFailureRatePct)) : ''}</span>
            <span class="label">${hasDeploys
              ? `Change Failure Rate · ${g.deploymentsFailed} de ${g.deploymentsTotal} despliegues fallaron`
              : 'Change Failure Rate · sin despliegues registrados'}</span>
          </div>
          <div class="card">
            <span class="value">${hasResolved ? mttrLabel : '—'}${hasResolved ? levelBadge(mttrLevel(g.mttrHoursAvg)) : ''}</span>
            <span class="label">${hasResolved
              ? `MTTR · ${g.incidentsResolved} ${g.incidentsResolved === 1 ? 'incidente resuelto' : 'incidentes resueltos'}${g.incidentsOpen > 0 ? `, ${g.incidentsOpen} abierto${g.incidentsOpen === 1 ? '' : 's'}` : ''}`
              : g.incidentsOpen > 0
                ? `MTTR · sin incidentes resueltos, ${g.incidentsOpen} abierto${g.incidentsOpen === 1 ? '' : 's'}`
                : 'MTTR · sin incidentes registrados'}</span>
          </div>
          <div class="card"><span class="value">${g.people}</span><span class="label">Personas que participan</span></div>
        </div>
        ${hasRealLead
          ? html`<p class="note">Lead time real = primer commit → despliegue en producción (DORA). El proxy (PR→merge) se conserva como referencia.</p>`
          : html`<p class="note">Aún no hay lead time real: registra despliegues para medir commit→deploy. Mientras tanto se muestra el proxy (PR→merge).</p>`}
        ${g.changesPending > 0
          ? html`<p class="note">${g.changesPending} ${g.changesPending === 1 ? 'cambio sin desplegar' : 'cambios sin desplegar'} (mergeados pero aún no en producción).</p>`
          : null}
        ${g.leadTimeApproxCount > 0
          ? html`<p class="note">Algunos primeros commits son aproximados por el límite de la API pública de GitHub (60/h sin token); un token de acceso lo resuelve.</p>`
          : null}
        ${hasDeploys
          ? html`<p class="note">Change Failure Rate = % de despliegues en producción que fallaron (${g.deploymentsFailed}/${g.deploymentsTotal}), sobre los despliegues registrados manualmente (D1). Métrica real, no proxy.</p>`
          : html`<p class="note">Change Failure Rate: sin despliegues registrados. Registra despliegues (con su resultado) para poder medirlo.</p>`}
        ${hasResolved
          ? html`<p class="note">MTTR (Mean Time to Recovery) = downtime total ÷ nº de incidentes resueltos, sobre los incidentes registrados manualmente (D4). Métrica real, no proxy.</p>`
          : html`<p class="note">MTTR: sin incidentes resueltos. Registra incidentes (inicio → restauración) en cada repo para poder medirlo.</p>`}
        <p class="note">Lead time y MTTR agregados = media ponderada. Métricas de equipo, nunca por persona (R3).</p>
      </section>
      ${this._table('Por equipo', s.byTeam)}
      ${this._table('Por gremio', s.byGuild)}
    `;
  }
}

if (!customElements.get('dora-metrics')) {
  customElements.define('dora-metrics', DoraMetrics);
}
