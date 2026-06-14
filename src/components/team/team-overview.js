/**
 * <team-overview>
 * Panel agregado del equipo (R6, sin comparar personas R3): radar de cobertura
 * de roles Belbin (R9a), bus factor por área, avisos de silencio (R7) y
 * distribución de seniority. Permite exportar SOLO los agregados (R6).
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 */
import { LitElement, html, css, svg } from 'lit';
import {
  getTeamHealth,
  exportAggregate,
  listActivePeople,
  listAreas,
} from '../../tools/team/application/usecases/index.js';

export class TeamOverview extends LitElement {
  static properties = {
    persistence: { attribute: false },
    health: { state: true },
    loading: { state: true },
    error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    h2 { font-size: 1.05rem; margin: 0 0 1rem; }
    h3 { font-size: 0.95rem; margin: 0 0 0.5rem; }
    .grid { display: grid; grid-template-columns: minmax(220px, 280px) 1fr; gap: 1.5rem; align-items: center; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
    .radar { width: 100%; height: auto; max-width: 280px; }
    .radar-grid { fill: none; stroke: var(--rm-border, #e5e7eb); }
    .radar-axis { stroke: var(--rm-border, #e5e7eb); }
    .radar-area { fill: color-mix(in srgb, var(--rm-accent, #2a9d8f) 22%, transparent); stroke: var(--rm-accent, #2a9d8f); stroke-width: 2; }
    .radar-label { font-size: 7px; fill: var(--rm-muted, #6b7280); }
    .bar-row { display: grid; grid-template-columns: 16ch 1fr 4ch; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem; font-size: 0.85rem; }
    .track { height: 12px; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; }
    .fill { height: 100%; border-radius: 999px; background: var(--rm-accent, #2a9d8f); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    .badge { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
    .badge.risk { background: var(--rm-coral-soft, #fdecea); color: var(--rm-coral-600, #e26d5e); }
    .badge.ok { background: var(--rm-teal-soft, #e6f4f1); color: var(--rm-teal-600, #23867a); }
    .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .chip { background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
    .muted { color: var(--rm-muted, #9ca3af); }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    button {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.45rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    .note { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); margin: 0.5rem 0 0; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.health = null;
    this._areaName = new Map();
    this._personName = new Map();
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
      const now = new Date().toISOString();
      const [health, people, areas] = await Promise.all([
        getTeamHealth(this.persistence, now),
        listActivePeople(this.persistence),
        listAreas(this.persistence),
      ]);
      this._personName = new Map(people.map((p) => [p.id, p.name]));
      this._areaName = new Map(areas.map((a) => [a.id, a.name]));
      this.health = health;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el panel de equipo.';
    } finally {
      this.loading = false;
    }
  }

  async _export() {
    this.error = '';
    try {
      const data = await exportAggregate(this.persistence, new Date().toISOString());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'grebla-equipo-agregados.json';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo exportar.';
    }
  }

  _renderRadar(coverage) {
    const n = coverage.length;
    if (n === 0) return null;
    const size = 220;
    const c = size / 2;
    const radius = 80;
    const max = Math.max(1, ...coverage.map((r) => r.score));
    const pointAt = (value, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const r = (value / max) * radius;
      return [c + r * Math.cos(angle), c + r * Math.sin(angle)];
    };
    const ring = (v) => coverage.map((_, i) => pointAt(v, i).join(',')).join(' ');
    const area = coverage.map((r, i) => pointAt(r.score, i).join(',')).join(' ');
    return svg`
      <svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Cobertura de roles Belbin">
        ${[0.25, 0.5, 0.75, 1].map((f) => svg`<polygon class="radar-grid" points=${ring(f * max)} />`)}
        ${coverage.map((_, i) => {
          const [x, y] = pointAt(max, i);
          return svg`<line class="radar-axis" x1=${c} y1=${c} x2=${x} y2=${y} />`;
        })}
        <polygon class="radar-area" points=${area} />
        ${coverage.map((r, i) => {
          const [x, y] = pointAt(max * 1.18, i);
          return svg`<text class="radar-label" x=${x} y=${y} text-anchor="middle" dominant-baseline="middle">${r.sigla}</text>`;
        })}
      </svg>
    `;
  }

  render() {
    if (this.loading) return html`<p class="empty">Cargando panel…</p>`;
    if (this.error) return html`<p class="error">${this.error}</p>`;
    const h = this.health;
    if (!h) return html`<p class="empty">Sin datos.</p>`;
    const maxCov = Math.max(1, ...h.roleCoverage.map((r) => r.score));
    const maxSenior = Math.max(1, ...h.seniorityDistribution.map((s) => s.count));
    return html`
      <section>
        <div class="head">
          <h2>Equipo (${h.teamSize} ${h.teamSize === 1 ? 'persona' : 'personas'})</h2>
          <button @click=${this._export}>Exportar agregados (JSON)</button>
        </div>
        <p class="note">Vistas agregadas del equipo. No se comparan ni se ordenan personas por desempeño (R3).</p>
      </section>

      <section>
        <h2>Cobertura de roles (Belbin)</h2>
        <div class="grid">
          ${this._renderRadar(h.roleCoverage)}
          <div>
            ${h.roleCoverage.map(
              (r) => html`
                <div class="bar-row">
                  <span title=${r.name}>${r.sigla} · ${r.name}</span>
                  <span class="track"><span class="fill" style=${`width:${(r.score / maxCov) * 100}%`}></span></span>
                  <span class="num">${r.score}</span>
                </div>
              `,
            )}
          </div>
        </div>
        ${h.uncoveredRoles.length > 0
          ? html`<p class="note">Sin cubrir: <span class="chips">${h.uncoveredRoles.map((r) => html`<span class="chip">${r.sigla} · ${r.name}</span>`)}</span></p>`
          : html`<p class="note">Todos los roles tienen alguna cobertura.</p>`}
      </section>

      <section>
        <h2>Bus factor por área</h2>
        ${h.busFactor.length === 0
          ? html`<p class="empty">Sin datos de conocimiento. Registra niveles por área en las fichas.</p>`
          : html`
              <table>
                <thead><tr><th>Área</th><th class="num">Personas que cubren</th><th>Estado</th></tr></thead>
                <tbody>
                  ${h.busFactor.map(
                    (b) => html`
                      <tr>
                        <td>${this._areaName.get(b.areaId) ?? '—'}</td>
                        <td class="num">${b.count}</td>
                        <td>${b.atRisk
                          ? html`<span class="badge risk">Riesgo (${b.count})</span>`
                          : html`<span class="badge ok">OK</span>`}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
              <p class="note">${h.busFactorOneCount} área(s) dependen de una sola persona; ${h.areasAtRiskCount} en riesgo (menos de 2 con dominio suficiente).</p>
            `}
      </section>

      <section>
        <h2>Avisos de silencio (${h.silenceCount})</h2>
        ${h.silence.length === 0
          ? html`<p class="empty">Nadie supera la cadencia configurada.</p>`
          : html`
              <table>
                <thead><tr><th>Persona</th><th class="num">Días sin seguimiento</th></tr></thead>
                <tbody>
                  ${h.silence.map(
                    (s) => html`<tr>
                      <td>${this._personName.get(s.personId) ?? '—'}</td>
                      <td class="num">${Number.isFinite(s.daysSince) ? s.daysSince : '— (sin registros)'}</td>
                    </tr>`,
                  )}
                </tbody>
              </table>
              <p class="note">Cola de atención operativa, no una comparación de desempeño (R3).</p>
            `}
      </section>

      <section>
        <h2>Distribución de seniority</h2>
        ${h.seniorityDistribution.map(
          (s) => html`
            <div class="bar-row">
              <span>${s.order}. ${s.name}</span>
              <span class="track"><span class="fill" style=${`width:${(s.count / maxSenior) * 100}%`}></span></span>
              <span class="num">${s.count}</span>
            </div>
          `,
        )}
      </section>
    `;
  }
}

if (!customElements.get('team-overview')) {
  customElements.define('team-overview', TeamOverview);
}
