/**
 * <team-career> — pestaña «Carrera» de la tool Equipo (RMR-PCS-0029 · F2b).
 *
 * Vista LISTADA, read-only, del progreso de carrera de las personas del ámbito
 * del manager (el mismo que ya resuelve Equipo: líder→su equipo, supermanager→su
 * rama, superadmin→todos). NO es el juego: acompañar el crecimiento sin entrar a
 * jugar el mapa de nadie. Carga los journeys BAJO DEMANDA (al montar esta
 * pestaña), no al abrir Equipo — así «carga solo lo necesario» y escala.
 */
import { LitElement, html, css } from 'lit';
import { skeletonBlock } from '../app-skeleton.js';
import { listActivePeople } from '../../tools/team/application/usecases/index.js';
import { getJourney } from '../../tools/career/application/usecases.js';
import { careerRoster } from '../../tools/career/domain/careerRoster.js';

export class TeamCareer extends LitElement {
  static properties = {
    persistence: { attribute: false },
    careerStore: { attribute: false },
    archipelago: { attribute: false },
    framework: { attribute: false },
    _rows: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #111827); }
    .lead { color: var(--rm-muted, #6b7280); font-size: 0.9rem; margin: 0 0 1rem; }
    .error { color: var(--rm-danger, #dc2626); }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1.5rem 0; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 40rem; }
    th, td { text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    td.num { font-variant-numeric: tabular-nums; }
    .lvl { display: inline-block; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .muted { color: var(--rm-muted, #9ca3af); }
    .pill { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.78rem; font-weight: 700; background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 14%, transparent); color: var(--rm-accent, #2a9d8f); }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.careerStore = null;
    this.archipelago = null;
    this.framework = null;
    /** @type {import('../../tools/career/domain/careerRoster.js').CareerRosterRow[]|null} */
    this._rows = null;
    this._error = '';
    this._loaded = false;
  }

  updated() {
    if (this._loaded) return;
    if (this.persistence && this.careerStore && this.archipelago) {
      this._loaded = true;
      this._load();
    } else if (this.persistence && (!this.careerStore || !this.archipelago)) {
      // El glue ya terminó (persistence llega el último) pero faltan el store de
      // carrera o el archipiélago: su preparación falló. No esperar eternamente.
      this._loaded = true;
      this._error = 'No se pudo preparar el progreso de carrera. Recarga la página.';
    }
  }

  async _load() {
    this._error = '';
    try {
      const people = await listActivePeople(this.persistence);
      const journeyById = new Map();
      // Journeys BAJO DEMANDA: 1 lectura por persona, en paralelo, al abrir la
      // pestaña. Un journey ilegible (otra rama) no tumba al resto.
      await Promise.all(
        people.map(async (p) => {
          try {
            journeyById.set(p.id, await getJourney(this.careerStore, p.id));
          } catch {
            // sin datos para esa persona: saldrá como «no empezó»
          }
        }),
      );
      this._rows = careerRoster({
        people,
        journeyById,
        islands: this.archipelago?.islands ?? [],
        framework: this.framework,
      });
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el progreso.';
    }
  }

  render() {
    if (this._error) return html`<p class="error">${this._error}</p>`;
    if (this._rows === null) return html`${skeletonBlock('320px')}`;
    if (this._rows.length === 0) return html`<p class="empty">No hay personas en tu ámbito.</p>`;
    return html`
      <p class="lead">Progreso de carrera de tu gente (solo lectura). Cada persona juega su propio mapa; aquí ves su avance.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Persona</th>
              <th>Nivel objetivo</th>
              <th>Ciudadanías</th>
              <th>Certificados</th>
              <th>Islas pisadas</th>
              <th>Isla actual</th>
            </tr>
          </thead>
          <tbody>
            ${this._rows.map((r) => html`<tr>
              <td>${r.name}</td>
              <td>${r.levelCode ? html`<span class="lvl" title=${r.levelTitle ?? ''}>${r.levelCode}</span>` : html`<span class="muted">—</span>`}</td>
              <td class="num">${r.citizenships > 0 ? html`<span class="pill">${r.citizenships}</span>` : html`<span class="muted">0</span>`}</td>
              <td class="num">${r.certificates}</td>
              <td class="num">${r.islandsVisited}</td>
              <td>${r.currentIsland ?? html`<span class="muted">sin empezar</span>`}</td>
            </tr>`)}
          </tbody>
        </table>
      </div>
    `;
  }
}

customElements.define('team-career', TeamCareer);
