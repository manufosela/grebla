/**
 * <engineer-space>
 * Contenido de «Mi espacio» del ingeniero (persona con cuenta vinculada), en
 * SOLO LECTURA. Renderiza tres secciones sin ningún control de edición:
 *   1. Mi carrera     — nivel, expectativas, addendums y a qué aspirar del
 *                       framework (mismo marcado que la sección «Carrera» de
 *                       <team-person-detail>, con los helpers puros del tool).
 *   2. Mi Role Mirror — perfil calculado (dominante, afinidades, radar y barras
 *                       por dimensión) reutilizando <role-result> sin el selector
 *                       de rol objetivo (comparador what-if desactivado).
 *   3. Mi mapa        — resumen del journey: isla, ciudad actual, ciudades
 *                       dominadas por comarca y ruta marcada. Sin acciones.
 *
 * El componente es PRESENTACIONAL: recibe todos los datos ya cargados por el glue
 * (client/engineer.js) y NO hace ninguna IO ni escritura a Firestore. La cabecera
 * de identidad la pinta la página/glue de G2, aquí no se duplica.
 *
 * @typedef {import('../tools/team/domain/types.js').Person} Person
 * @typedef {import('../tools/career/data/framework.js').CareerFramework} CareerFramework
 * @typedef {import('../lib/scoring.js').Profile} Profile
 * @typedef {import('../data/roles.js').Role} Role
 * @typedef {import('../tools/career/domain/types.js').CareerMap} CareerMap
 * @typedef {import('../tools/career/domain/types.js').Journey} Journey
 */
import { LitElement, html, css } from 'lit';
import './role-result.js';
import './career/career-map.js';
import {
  getLevel,
  expectationsForLevel,
  addendumsForDisciplines,
  aspirationalLevels,
} from '../tools/career/data/framework.js';
import { stats } from '../tools/career/application/usecases.js';

export class EngineerSpace extends LitElement {
  static properties = {
    person: { attribute: false },
    framework: { attribute: false },
    profile: { attribute: false },
    roles: { attribute: false },
    island: { attribute: false },
    journey: { attribute: false },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    section {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    section > h2 { margin: 0 0 0.75rem; font-size: 1.2rem; }
    section.career { border-left: 4px solid var(--rm-accent, #2a9d8f); }
    section.map { border-left: 4px solid var(--rm-coral, #f2887a); }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; margin: 0; }

    /* ── Sección Carrera (marcado espejo de <team-person-detail>) ── */
    .sub { font-size: 0.85rem; font-weight: 700; color: var(--rm-text, #111827); margin: 1.1rem 0 0.35rem; }
    .now .code { font-weight: 700; }
    .now .desc { font-size: 0.85rem; color: var(--rm-text, #111827); margin: 0.2rem 0 0; }
    .now .profile { font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin: 0.2rem 0 0; }
    .expect { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    .expect li { padding: 0.4rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .expect .dim { font-weight: 700; }
    .expect .txt { color: var(--rm-text, #111827); }
    .expect .todo { color: var(--rm-muted, #9ca3af); font-style: italic; }
    .addn { margin: 0.3rem 0 0; }
    .addn .disc { font-weight: 700; font-size: 0.85rem; margin: 0.6rem 0 0.2rem; }
    .addn ul { list-style: none; margin: 0; padding: 0; font-size: 0.83rem; }
    .addn li { padding: 0.25rem 0; }
    .addn .dim { font-weight: 600; }
    .aspire { list-style: none; margin: 0; padding: 0; }
    .aspire > li { border-top: 1px solid var(--rm-border, #eef0f2); }
    .aspire summary { cursor: pointer; padding: 0.45rem 0; font-size: 0.88rem; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
    .aspire summary::-webkit-details-marker { color: var(--rm-muted, #9ca3af); }
    .aspire .code { font-weight: 700; }
    .aspire .track { color: var(--rm-muted, #6b7280); font-size: 0.78rem; }
    .aspire .desc { font-size: 0.82rem; color: var(--rm-muted, #4b5563); margin: 0 0 0.5rem; padding-left: 1.1rem; }

    /* ── Sección Mapa de carrera (resumen read-only) ── */
    .map-head { display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 0.4rem; }
    .map-head .lvl { font-weight: 800; color: var(--rm-accent, #2a9d8f); }
    .map-head .pts { font-size: 0.85rem; color: var(--rm-muted, #6b7280); font-variant-numeric: tabular-nums; }
    .progress { height: 8px; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; margin-bottom: 1rem; }
    .progress span { display: block; height: 100%; background: var(--rm-accent, #2a9d8f); border-radius: 999px; }
    .now-city { margin: 0; font-weight: 700; }
    .by-area { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem 1.25rem; }
    .by-area .area-name { font-weight: 700; font-size: 0.85rem; margin: 0 0 0.2rem; }
    .by-area .cities { list-style: none; margin: 0; padding: 0; font-size: 0.83rem; }
    .by-area .cities li { padding: 0.15rem 0; color: var(--rm-text, #111827); }
    .route { margin: 0; padding-left: 1.2rem; font-size: 0.85rem; }
    .route li { padding: 0.15rem 0; }
  `;

  constructor() {
    super();
    /** @type {(Person & { id: string })|null} */
    this.person = null;
    /** @type {CareerFramework|null} */
    this.framework = null;
    /** @type {Profile|null} */
    this.profile = null;
    /** @type {ReadonlyArray<Role>} */
    this.roles = [];
    /** @type {CareerMap|null} */
    this.island = null;
    /** @type {Journey|null} */
    this.journey = null;
  }

  /**
   * Sección «Mi carrera»: nivel actual, lo que se te reconoce (expectativas),
   * enfoque por disciplina (addendums) y a qué aspirar. Espejo del marcado de la
   * sección «Carrera» de <team-person-detail>, con los mismos helpers puros.
   * @returns {import('lit').TemplateResult|null}
   */
  _renderCareer() {
    const fw = this.framework;
    const person = this.person;
    if (!person) return html`<p class="empty">No hay datos de carrera.</p>`;

    const disciplineIds = person.disciplines ?? [];
    const level = getLevel(fw, person.levelId);
    if (!level && disciplineIds.length === 0) {
      return html`<p class="empty">Aún no tienes un nivel de carrera asignado.</p>`;
    }

    const trackName = (trackId) => (fw?.tracks ?? []).find((t) => t.id === trackId)?.name ?? '';
    const expectations = level ? expectationsForLevel(fw, person.levelId) : [];
    const addendums = addendumsForDisciplines(fw, disciplineIds);
    const addendumsByDiscipline = Object.groupBy(addendums, (a) => a.discipline.id);
    const aspirations = level ? aspirationalLevels(fw, person.levelId) : [];

    return html`
      <p class="sub">Nivel actual</p>
      ${level
        ? html`
            <div class="now">
              <p><span class="code">${level.code}</span> · ${level.title}</p>
              ${level.description ? html`<p class="desc">${level.description}</p>` : null}
              ${level.typicalProfile ? html`<p class="profile">Perfil típico: ${level.typicalProfile}</p>` : null}
            </div>
          `
        : html`<p class="empty">Sin nivel asignado.</p>`}

      ${level
        ? html`
            <p class="sub">Lo que se te reconoce</p>
            <ul class="expect">
              ${expectations.map(
                (row) => html`
                  <li>
                    <span class="dim">${row.dimension.name}</span>:
                    ${row.text
                      ? html`<span class="txt">${row.text}</span>`
                      : html`<span class="todo">pendiente de definir</span>`}
                  </li>
                `,
              )}
            </ul>
          `
        : null}

      ${addendums.length > 0
        ? html`
            <p class="sub">Enfoque por disciplina</p>
            <div class="addn">
              ${Object.values(addendumsByDiscipline).map(
                (rows) => html`
                  <p class="disc">${rows.at(0).discipline.name}</p>
                  <ul>
                    ${rows.map(
                      (a) => html`<li><span class="dim">${a.dimension.name}:</span> ${a.text}</li>`,
                    )}
                  </ul>
                `,
              )}
            </div>
          `
        : null}

      ${level
        ? html`
            <p class="sub">A qué aspirar</p>
            ${aspirations.length === 0
              ? html`<p class="empty">No hay siguientes niveles definidos desde aquí.</p>`
              : html`
                  <ul class="aspire">
                    ${aspirations.map(
                      (l) => html`
                        <li>
                          <details>
                            <summary>
                              <span><span class="code">${l.code}</span> · ${l.title}</span>
                              ${trackName(l.trackId) ? html`<span class="track">${trackName(l.trackId)}</span>` : null}
                            </summary>
                            ${l.description ? html`<p class="desc">${l.description}</p>` : null}
                          </details>
                        </li>
                      `,
                    )}
                  </ul>
                `}
          `
        : null}
    `;
  }

  /**
   * Sección «Mi Role Mirror»: el perfil calculado. Reutiliza <role-result> con
   * `hideTarget` para ocultar el comparador what-if (selector de rol objetivo):
   * la vista del ingeniero es de solo lectura y ese control no debe usarse como
   * edición. <role-result> no persiste nada de todas formas (solo emite eventos).
   * @returns {import('lit').TemplateResult}
   */
  _renderRoleMirror() {
    const profile = this.profile;
    if (!profile?.dominant) {
      return html`<p class="empty">Aún no tienes un perfil de Role Mirror.</p>`;
    }
    return html`
      <role-result .profile=${profile} .roles=${this.roles ?? []} .hideTarget=${true}></role-result>
    `;
  }

  /**
   * Sección «Mi mapa de carrera»: resumen de solo lectura del journey sobre la
   * isla. Muestra la isla (visual, sin acciones), progreso, ciudad actual,
   * ciudades dominadas agrupadas por comarca y la ruta marcada. Sin botones ni
   * escritura: <career-map> es presentacional y su evento `select-city` no se
   * enlaza a nada.
   * @returns {import('lit').TemplateResult}
   */
  _renderMap() {
    const island = this.island;
    const journey = this.journey;
    const hasJourney = Boolean(
      journey &&
        (journey.currentCity ||
          (journey.visitedCities?.length ?? 0) > 0 ||
          (journey.plannedRoute?.length ?? 0) > 0),
    );
    if (!island || !hasJourney) {
      return html`<p class="empty">Aún no tienes un mapa de carrera trazado.</p>`;
    }

    const s = stats(island, journey);
    const cityById = new Map(island.cities.map((c) => [c.id, c]));
    const cityName = (id) => cityById.get(id)?.name ?? id;
    const current = journey.currentCity ? cityById.get(journey.currentCity) : null;
    const visited = journey.visitedCities ?? [];
    const route = journey.plannedRoute ?? [];

    // Ciudades dominadas agrupadas por comarca (solo comarcas con visitadas).
    const dominatedByArea = (island.areas ?? [])
      .map((area) => ({
        area,
        cities: visited.map((id) => cityById.get(id)).filter((c) => c?.area === area.id),
      }))
      .filter((group) => group.cities.length > 0);

    return html`
      <div class="map-head">
        <span class="lvl">${s.level}</span>
        <span class="pts">${s.points}/${s.total} pts · ${s.pct}%</span>
      </div>
      <div class="progress"><span style=${`width:${s.pct}%`}></span></div>

      <career-map
        .map=${island}
        .journey=${journey}
        .reachable=${s.reachable}
        .selected=${null}
      ></career-map>

      <p class="sub">Ciudad actual</p>
      ${current
        ? html`<p class="now-city">${current.name}</p>`
        : html`<p class="empty">Sin ciudad actual marcada.</p>`}

      <p class="sub">Ciudades dominadas (${visited.length})</p>
      ${dominatedByArea.length === 0
        ? html`<p class="empty">Aún no has dominado ninguna ciudad.</p>`
        : html`
            <div class="by-area">
              ${dominatedByArea.map(
                (group) => html`
                  <div class="area">
                    <p class="area-name">${group.area.name}</p>
                    <ul class="cities">
                      ${group.cities.map((c) => html`<li>${c.name}</li>`)}
                    </ul>
                  </div>
                `,
              )}
            </div>
          `}

      ${route.length > 0
        ? html`
            <p class="sub">Tu ruta</p>
            <ol class="route">
              ${route.map((id) => html`<li>${cityName(id)}</li>`)}
            </ol>
          `
        : null}
    `;
  }

  render() {
    return html`
      <section class="career">
        <h2>Mi carrera</h2>
        ${this._renderCareer()}
      </section>
      <section class="rolemirror">
        <h2>Mi Role Mirror</h2>
        ${this._renderRoleMirror()}
      </section>
      <section class="map">
        <h2>Mi mapa de carrera</h2>
        ${this._renderMap()}
      </section>
    `;
  }
}

if (!customElements.get('engineer-space')) {
  customElements.define('engineer-space', EngineerSpace);
}
