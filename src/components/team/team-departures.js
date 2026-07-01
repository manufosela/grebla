/**
 * <team-departures>
 * Sección "Bajas": personas dadas de baja (no se borran, conservan su histórico)
 * con su fecha de alta y de baja, más una tarjeta con la tasa de rotación del
 * equipo en los últimos 12 meses. Agregado, no compara personas (R3).
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 */
import { LitElement, html, css } from 'lit';
import { listDepartedPeople, getTurnover } from '../../tools/team/application/usecases/index.js';

const MS_YEAR = 365 * 86_400_000;
const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** @param {string} iso */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export class TeamDepartures extends LitElement {
  static properties = {
    persistence: { attribute: false },
    departed: { state: true },
    turnover: { state: true },
    loading: { state: true },
    error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    section {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.05rem; margin: 0 0 1rem; }
    .stats { display: flex; flex-wrap: wrap; gap: 1.5rem; }
    .stat { display: flex; flex-direction: column; gap: 0.2rem; }
    .stat .value { font-size: 1.6rem; font-weight: 800; color: var(--rm-accent, #2a9d8f); font-variant-numeric: tabular-nums; }
    .stat .label { font-size: 0.78rem; color: var(--rm-muted, #6b7280); }
    .period { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); margin-top: 0.75rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    .chips { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; }
    .chip { background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
    .muted { color: var(--rm-muted, #9ca3af); }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    /** @type {import('../../tools/team/domain/types.js').Person[]} */
    this.departed = [];
    this.turnover = null;
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
      const now = new Date();
      const from = new Date(now.getTime() - MS_YEAR);
      const [departed, turnover] = await Promise.all([
        listDepartedPeople(this.persistence),
        getTurnover(this.persistence, { from: from.toISOString(), to: now.toISOString() }),
      ]);
      this.departed = departed;
      this.turnover = turnover;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron cargar las bajas.';
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.loading) return html`<p class="empty">Cargando…</p>`;
    if (this.error) return html`<p class="error">${this.error}</p>`;
    const t = this.turnover;
    return html`
      <section>
        <h2>Rotación del equipo</h2>
        <div class="stats">
          <div class="stat"><span class="value">${t ? `${Math.round(t.turnoverRate)}%` : '—'}</span><span class="label">Tasa de rotación</span></div>
          <div class="stat"><span class="value">${t?.departures ?? 0}</span><span class="label">Bajas</span></div>
          <div class="stat"><span class="value">${t?.hires ?? 0}</span><span class="label">Altas</span></div>
          <div class="stat"><span class="value">${t ? Math.round(t.avgHeadcount) : 0}</span><span class="label">Plantilla media</span></div>
        </div>
        <p class="period">Periodo: últimos 12 meses${t ? ` (${formatDate(t.from)} – ${formatDate(t.to)})` : ''}.</p>
      </section>

      <section>
        <h2>Personas dadas de baja (${this.departed.length})</h2>
        ${this.departed.length === 0
          ? html`<p class="empty">No hay bajas registradas.</p>`
          : html`
              <table>
                <thead>
                  <tr><th>Nombre</th><th>Gremios</th><th>Alta</th><th>Baja</th></tr>
                </thead>
                <tbody>
                  ${this.departed.map(
                    (p) => html`
                      <tr>
                        <td>${p.name}</td>
                        <td>
                          ${(p.guilds ?? []).length === 0
                            ? html`<span class="muted">—</span>`
                            : html`<span class="chips">${p.guilds.map((r) => html`<span class="chip">${r}</span>`)}</span>`}
                        </td>
                        <td>${formatDate(p.startDate)}</td>
                        <td>${formatDate(p.deactivatedAt)}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `}
      </section>
    `;
  }
}

if (!customElements.get('team-departures')) {
  customElements.define('team-departures', TeamDepartures);
}
