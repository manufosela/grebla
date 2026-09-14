/**
 * <team-map>
 * Mapa del equipo (GREBLA §13): una fila por persona con su estado actual en las
 * cuatro dimensiones. Seniority y Emocional con color de nivel; Conocimiento con
 * su perfil (I/T/π/Comb) y un punto de color por área; Contribución con los roles
 * Belbin (primario/secundario). Es una foto del sistema y lectura privada de quien
 * lidera: NO ordena ni puntúa a las personas entre sí (R3).
 *
 * Y una columna más, «Carrera» (RMR-TSK-0506): el nivel de la persona y cómo va
 * frente a las expectativas de ese nivel. Son otra familia de dimensiones —las
 * del framework de carrera, que cambian con el nivel— y vivían solo dentro de la
 * ficha: había que entrar persona a persona para saber quién no llega en algo.
 * Aquí se miran las dos familias de una vez.
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 *  - framework: CareerFramework (inyectado por <team-app>; sin él no hay nivel
 *    que valorar y la columna lo dice, en vez de callarse)
 */
import { LitElement, html, css } from 'lit';
import { tableStyles } from '../common/table-styles.js';
import { skeletonBlock } from '../app-skeleton.js';
import { getTeamMap, listAreas } from '../../tools/team/application/usecases/index.js';
import { LEVELS, LEVEL_BY_ORDER, levelLabel } from '../../tools/team/domain/levels.js';
import { careerStatus } from '../../tools/career/domain/careerStatus.js';
import { getCareerAssessment } from '../../lib/careerAssessment.js';

/**
 * Valoraciones de carrera de las personas del mapa, en paralelo. Una lectura que
 * falle (permisos, red) NO se cuenta como «sin valorar»: la persona se queda
 * fuera del mapa y su celda lo dice, porque decir «sin valorar» de alguien a
 * quien no hemos podido leer es inventarse el dato.
 * @param {Array<{ id: string, external: boolean }>} rows
 * @returns {Promise<Map<string, import('../../tools/career/data/assessment.js').CareerAssessment>>}
 */
async function loadAssessments(rows) {
  // Los externos no tienen plan de carrera: ni se pregunta por ellos.
  const ids = rows.filter((r) => !r.external).map((r) => r.id);
  const results = await Promise.allSettled(ids.map((id) => getCareerAssessment(id)));
  const byPerson = new Map();
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') byPerson.set(ids[i], res.value);
    else console.warn(`Mapa · no se pudo leer la valoración de ${ids[i]}`, res.reason);
  });
  return byPerson;
}

/** Texto de la celda de carrera por estado. Lo que no se sabe, se dice. */
const CAREER_TEXT = {
  external: 'Sin plan (externa)',
  'no-level': 'Sin nivel asignado',
  'unknown-level': 'Nivel fuera del framework',
  'no-expectations': 'Nivel sin expectativas',
  unassessed: 'Sin valorar',
};

export class TeamMap extends LitElement {
  static properties = {
    persistence: { attribute: false },
    framework: { attribute: false },
    rows: { state: true },
    loading: { state: true },
    error: { state: true },
  };

  static styles = [tableStyles, css`
    :host { display: block; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.05rem; margin: 0 0 0.25rem; }
    .lead { font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 1rem; }
    .wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 640px; }
    th, td { text-align: left; padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); vertical-align: top; }
    th { color: var(--rm-muted, #5b6b7d); font-weight: 600; white-space: nowrap; }
    td.person { font-weight: 600; white-space: nowrap; }
    .roles { display: block; font-weight: 400; font-size: 0.75rem; color: var(--rm-muted, #5b6b7d); }
    .lvl { display: inline-flex; align-items: center; gap: 0.4rem; white-space: nowrap; }
    .dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--rm-dot-border, rgba(0,0,0,0.12)); flex: none; }
    .muted { color: var(--rm-muted, #5b6b7d); }
    .profile { display: inline-block; padding: 0.05rem 0.5rem; border-radius: 999px; background: var(--rm-track, #e9f0f2); font-weight: 700; font-size: 0.78rem; }
    .areas { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.3rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .chip { background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.05rem 0.5rem; font-size: 0.75rem; font-weight: 600; }
    .chip.p { background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 22%, transparent); }
    .legend { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 1rem; font-size: 0.75rem; color: var(--rm-muted, #5b6b7d); }
    .legend .lvl { gap: 0.3rem; }
    .empty { color: var(--rm-muted, #5b6b7d); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    tbody tr:hover td { background: var(--rm-surface-hover, #f9fafb); }
    /* Nombre de persona como enlace: abre su ficha (sub-pestaña por defecto). */
    .link {
      border: 0; background: none; padding: 0; margin: 0; cursor: pointer;
      font: inherit; font-weight: 600; text-align: left; color: var(--rm-accent, #2a9d8f); text-decoration: underline;
    }
    /* Celda de dimensión clicable: abre la ficha en esa sub-pestaña sin alterar el aspecto. */
    .cell-link {
      display: block; width: 100%; border: 0; background: none; padding: 0; margin: 0;
      font: inherit; color: inherit; text-align: left; cursor: pointer;
    }
    .link:focus-visible, .cell-link:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
    .link-inline {
      border: 0; background: none; padding: 0; margin: 0; cursor: pointer;
      font: inherit; font-weight: 700; color: var(--rm-accent, #2a9d8f); text-decoration: underline;
    }
    .link-inline:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
    /* Carrera: el nivel arriba y cómo va debajo. Rojo y verde SIN fallback: los
       tokens del tema ya traen un valor por modo, y un fallback claro se
       quedaría pegado en el tema oscuro (donde no se leería). */
    .career { display: flex; flex-direction: column; gap: 0.15rem; }
    .career .level { font-weight: 600; white-space: nowrap; }
    .career .state { font-size: 0.78rem; }
    .career .gaps { color: var(--rm-danger); font-weight: 700; }
    .career .meets { color: var(--rm-success); font-weight: 600; }
    .career .pending { color: var(--rm-muted, #5b6b7d); }
  `];

  constructor() {
    super();
    this.persistence = null;
    this.framework = null;
    this.rows = [];
    this._areaName = new Map();
    /** @type {Map<string, import('../../tools/career/data/assessment.js').CareerAssessment>}
     * Valoración por persona. Una persona AUSENTE del mapa es una cuya
     * valoración no se pudo leer — que no es lo mismo que no tenerla. */
    this._assessments = new Map();
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
      this._assessments = await loadAssessments(rows);
      // La tabla se pinta con todo listo: aparecer primero sin la columna de
      // carrera y rellenarla después movería las filas bajo el cursor.
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

  /**
   * Celda de carrera: el nivel y cómo va frente a sus expectativas. Los estados
   * que no son una valoración (sin nivel, sin valorar, externa…) se nombran, en
   * vez de pintarse como si cumpliera.
   * @param {{ id: string, external: boolean, levelId: string|null }} row
   * @returns {import('lit').TemplateResult}
   */
  _careerCell(row) {
    // Persona que no está en el mapa de valoraciones: su lectura falló. Decirlo
    // en vez de contarla como «sin valorar», que sería otro dato distinto.
    if (!row.external && !this._assessments.has(row.id)) {
      return html`<span class="muted" title="No se ha podido leer su valoración">—</span>`;
    }
    const estado = careerStatus(this.framework, row, this._assessments.get(row.id));
    const nivel = estado.levelName
      ? html`<span class="level">${estado.levelName}</span>`
      : null;
    return html`<span class="career">${nivel}${this._careerState(estado)}</span>`;
  }

  /**
   * La segunda línea de la celda de carrera: qué le pasa a esta persona con las
   * expectativas de su nivel.
   * @param {import('../../tools/career/domain/careerStatus.js').CareerStatus} estado
   * @returns {import('lit').TemplateResult}
   */
  _careerState(estado) {
    if (estado.kind === 'gaps') {
      const plural = estado.reds === 1 ? 'expectativa' : 'expectativas';
      return html`<span class="state gaps">No llega en ${estado.reds} ${plural} de ${estado.total}</span>`;
    }
    if (estado.kind === 'meets') {
      return html`<span class="state meets">Cumple las ${estado.total}</span>`;
    }
    return html`<span class="state pending">${CAREER_TEXT[estado.kind]}</span>`;
  }

  _contributionCell(roles) {
    if (!roles || Object.keys(roles).length === 0) return html`<span class="muted">—</span>`;
    return html`<span class="chips">
      ${Object.entries(roles).map(
        ([sigla, kind]) => html`<span class="chip ${kind === 'primary' ? 'p' : ''}">${sigla} ${kind === 'primary' ? '(P)' : '(S)'}</span>`,
      )}
    </span>`;
  }

  /**
   * Pide a `<team-app>` que abra la ficha de una persona. Reutiliza el mismo
   * evento burbujeante que emite `<team-people>`, pero con `personId` (el Mapa
   * no dispone del objeto completo; `<team-app>` lo resuelve por id). `subtab`
   * es opcional y abre la ficha directamente en esa dimensión.
   * @param {string} personId
   * @param {string} [subtab]
   * @returns {void}
   */
  _open(personId, subtab) {
    this.dispatchEvent(
      new CustomEvent('open-person', {
        detail: subtab ? { personId, subtab } : { personId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Pide a `<team-app>` que cambie de sección principal (p. ej. «Personas»).
   * @param {string} tab
   * @returns {void}
   */
  _gotoTab(tab) {
    this.dispatchEvent(
      new CustomEvent('goto-tab', { detail: { tab }, bubbles: true, composed: true }),
    );
  }

  /**
   * Envuelve el contenido de una celda de dimensión en un botón que abre la ficha
   * en la sub-pestaña correspondiente (accesible: enfocable y activable por teclado).
   * @param {{ id: string, name: string }} row
   * @param {string} subtab  id de la dimensión (seniority/emotional/knowledge/contribution)
   * @param {string} label   nombre visible de la dimensión (para el aria-label)
   * @param {import('lit').TemplateResult} content
   * @returns {import('lit').TemplateResult}
   */
  _dimButton(row, subtab, label, content) {
    return html`<button
      type="button"
      class="cell-link"
      @click=${() => this._open(row.id, subtab)}
      aria-label=${`Abrir ${label} de ${row.name}`}
    >${content}</button>`;
  }

  render() {
    if (this.loading) return skeletonBlock('320px');
    if (this.error) return html`<p class="error">${this.error}</p>`;
    return html`
      <section>
        <h2>Mapa del equipo</h2>
        <p class="lead">
          Foto del sistema en las cuatro dimensiones, y cómo va cada persona en su nivel de carrera.
          Colores cálidos = niveles iniciales, fríos = avanzados; la mezcla indica diversidad sana.
          Es una lectura privada de quien lidera, no una comparación entre personas.
        </p>
        ${this.rows.length === 0
          ? html`<p class="empty">Aún no hay nadie en tu equipo.
              <button type="button" class="link-inline" @click=${() => this._gotoTab('people')}>Ve a Personas</button>
              para dar de alta a la primera y empezar a registrar lecturas.</p>`
          : html`
              <div class="wrap">
                <div class="table-wrap"><table>
                  <thead>
                    <tr>
                      <th>Persona</th><th>Seniority</th><th>Emocional</th><th>Conocimiento</th><th>Contribución</th><th>Carrera</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.rows.map(
                      (r) => html`
                        <tr>
                          <td class="person">
                            <button type="button" class="link" @click=${() => this._open(r.id)} aria-label=${`Abrir ficha de ${r.name}`}>${r.name}</button>
                            ${(r.guilds ?? []).length ? html`<span class="roles">${r.guilds.join(' · ')}</span>` : null}
                          </td>
                          <td>${this._dimButton(r, 'seniority', 'Seniority', this._levelCell(r.seniority))}</td>
                          <td>${this._dimButton(r, 'emotional', 'Emocional', this._levelCell(r.emotional))}</td>
                          <td>${this._dimButton(r, 'knowledge', 'Conocimiento', this._knowledgeCell(r.knowledge))}</td>
                          <td>${this._dimButton(r, 'contribution', 'Contribución', this._contributionCell(r.contribution))}</td>
                          <td>${this._dimButton(r, 'expectativas', 'Carrera', this._careerCell(r))}</td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table></div>
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
