/**
 * <team-map>
 * Mapa del equipo (GREBLA §13): una fila por persona con su estado actual en las
 * cuatro dimensiones. Seniority y Emocional con color de nivel; Conocimiento con
 * su perfil (I/T/π/Comb) y un punto de color por área; Contribución con los roles
 * Belbin (primario/secundario). Es una foto del sistema y lectura privada de quien
 * lidera: NO ordena ni puntúa a las personas entre sí (R3).
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 */
import { LitElement, html, css } from 'lit';
import { getTeamMap, listAreas } from '../../tools/team/application/usecases/index.js';
import { LEVELS, LEVEL_BY_ORDER, levelLabel } from '../../tools/team/domain/levels.js';

export class TeamMap extends LitElement {
  static properties = {
    persistence: { attribute: false },
    rows: { state: true },
    loading: { state: true },
    error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.05rem; margin: 0 0 0.25rem; }
    .lead { font-size: 0.82rem; color: var(--rm-muted, #6b7280); margin: 0 0 1rem; }
    .wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 640px; }
    th, td { text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); vertical-align: top; }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; white-space: nowrap; }
    td.person { font-weight: 600; white-space: nowrap; }
    .roles { display: block; font-weight: 400; font-size: 0.75rem; color: var(--rm-muted, #9ca3af); }
    .lvl { display: inline-flex; align-items: center; gap: 0.4rem; white-space: nowrap; }
    .dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.12); flex: none; }
    .muted { color: var(--rm-muted, #9ca3af); }
    .profile { display: inline-block; padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--rm-track, #e9f0f2); font-weight: 700; font-size: 0.78rem; }
    .areas { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.3rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .chip { background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.05rem 0.5rem; font-size: 0.75rem; font-weight: 600; }
    .chip.p { background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 22%, transparent); }
    .legend { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1rem; font-size: 0.75rem; color: var(--rm-muted, #6b7280); }
    .legend .lvl { gap: 0.3rem; }
    .empty { color: var(--rm-muted, #9ca3af); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.rows = [];
    this._areaName = new Map();
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
      const [rows, areas] = await Promise.all([
        getTeamMap(this.persistence),
        listAreas(this.persistence),
      ]);
      this._areaName = new Map(areas.map((a) => [a.id, a.name]));
      this.rows = rows;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el mapa.';
    } finally {
      this.loading = false;
    }
  }

  _levelCell(reading) {
    if (!reading) return html`<span class="muted">—</span>`;
    const color = LEVEL_BY_ORDER[reading.level]?.color ?? '#999';
    return html`<span class="lvl"><span class="dot" style=${`background:${color}`}></span>${levelLabel(reading.level, reading.toNext)}</span>`;
  }

  _knowledgeCell(knowledge) {
    const { areas, profile } = knowledge;
    if (areas.length === 0) return html`<span class="muted">—</span>`;
    return html`
      <span class="profile" title=${profile.label}>${profile.shape ?? '—'}</span>
      <span class="areas">
        ${areas.map((a) => {
          const color = LEVEL_BY_ORDER[a.level]?.color ?? '#999';
          return html`<span class="dot" style=${`background:${color}`} title=${`${this._areaName.get(a.areaId) ?? '—'}: ${levelLabel(a.level, a.toNext)}`}></span>`;
        })}
      </span>
    `;
  }

  _contributionCell(roles) {
    if (!roles || Object.keys(roles).length === 0) return html`<span class="muted">—</span>`;
    return html`<span class="chips">
      ${Object.entries(roles).map(
        ([sigla, kind]) => html`<span class="chip ${kind === 'primary' ? 'p' : ''}">${sigla} ${kind === 'primary' ? '(P)' : '(S)'}</span>`,
      )}
    </span>`;
  }

  render() {
    if (this.loading) return html`<p class="empty">Cargando mapa…</p>`;
    if (this.error) return html`<p class="error">${this.error}</p>`;
    return html`
      <section>
        <h2>Mapa del equipo</h2>
        <p class="lead">
          Foto del sistema en las cuatro dimensiones. Colores cálidos = niveles iniciales, fríos = avanzados;
          la mezcla indica diversidad sana. Es una lectura privada de quien lidera, no una comparación entre personas.
        </p>
        ${this.rows.length === 0
          ? html`<p class="empty">Aún no hay personas con lecturas.</p>`
          : html`
              <div class="wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Persona</th><th>Seniority</th><th>Emocional</th><th>Conocimiento</th><th>Contribución</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.rows.map(
                      (r) => html`
                        <tr>
                          <td class="person">${r.name}${(r.guilds ?? []).length ? html`<span class="roles">${r.guilds.join(' · ')}</span>` : null}</td>
                          <td>${this._levelCell(r.seniority)}</td>
                          <td>${this._levelCell(r.emotional)}</td>
                          <td>${this._knowledgeCell(r.knowledge)}</td>
                          <td>${this._contributionCell(r.contribution)}</td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              </div>
              <div class="legend">
                ${LEVELS.map((l) => html`<span class="lvl"><span class="dot" style=${`background:${l.color}`}></span>${l.order}. ${l.name}</span>`)}
              </div>
            `}
      </section>
    `;
  }
}

if (!customElements.get('team-map')) {
  customElements.define('team-map', TeamMap);
}
