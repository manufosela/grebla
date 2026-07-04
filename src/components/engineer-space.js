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
 *   3. Mi mapa        — «Mi ficha de ciudadanía» (MC-21): el MISMO componente
 *                       <player-card> del juego (badges con fecha, totales y
 *                       detalle por isla), alimentado con el journey + índice
 *                       del archipiélago + logros que carga el glue, todo en
 *                       solo lectura (mi-espacio NUNCA registra logros — la
 *                       migración de fechas la hace la vista de juego). Y el
 *                       resumen del journey de siempre: isla, ciudad actual,
 *                       ciudades dominadas por comarca y ruta marcada.
 *
 * El componente recibe todos los datos ya cargados por el glue (client/engineer.js)
 * y es de SOLO LECTURA salvo por una ÚNICA escritura muy acotada: en «Mi carrera»,
 * el ingeniero puede declarar su nivel objetivo de carrera (`careerTargetLevelId`)
 * vía `setCareerTarget`. Las reglas de Firestore limitan esa escritura a ese único
 * campo. Ninguna otra sección escribe. La cabecera de identidad la pinta la
 * página/glue de G2, aquí no se duplica.
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
import './career/player-card.js';
import {
  getLevel,
  expectationsForLevel,
  addendumsForDisciplines,
  aspirationalLevels,
} from '../tools/career/data/framework.js';
import { stats } from '../tools/career/application/usecases.js';
import { archipelagoProgress } from '../tools/career/domain/citizenship.js';
import { setCareerTarget } from '../lib/engineer.js';

/**
 * Pestañas de «Mi espacio». El id (clave) sincroniza con `location.hash`
 * (#carrera / #rolemirror / #mapa) para conservar la pestaña activa al recargar
 * o navegar atrás/adelante, igual que el patrón de <superadmin-panel>.
 * @type {ReadonlyArray<'carrera'|'rolemirror'|'mapa'>}
 */
const TABS = ['carrera', 'rolemirror', 'mapa'];

/**
 * Metadatos de cada pestaña: etiqueta de la barra, encabezado del panel y clase
 * CSS del panel (conserva los bordes de acento originales por sección).
 * @type {Record<typeof TABS[number], { label: string, heading: string, cls: string }>}
 */
const TAB_META = {
  carrera: { label: 'Mi carrera', heading: 'Mi carrera', cls: 'career' },
  rolemirror: { label: 'Mi Role Mirror', heading: 'Mi Role Mirror', cls: 'rolemirror' },
  mapa: { label: 'Mi mapa', heading: 'Mi mapa de carrera', cls: 'map' },
};

export class EngineerSpace extends LitElement {
  static properties = {
    person: { attribute: false },
    framework: { attribute: false },
    profile: { attribute: false },
    roles: { attribute: false },
    island: { attribute: false },
    journey: { attribute: false },
    archipelago: { attribute: false },
    achievements: { attribute: false },
    questions: { attribute: false },
    _tab: { state: true },
    _targetError: { state: true },
    _targetSaving: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }

    /* ── Barra de pestañas (patrón ARIA tablist) ── */
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280);
      border-radius: 999px; padding: 0.4rem 1rem; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    section:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }

    section {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    section > h2 { margin: 0 0 0.75rem; font-size: 1.2rem; }
    section.career { border-left: 4px solid var(--rm-accent, #2a9d8f); }
    section.rolemirror { border-left: 4px solid var(--rm-accent, #2a9d8f); }
    section.map { border-left: 4px solid var(--rm-coral, #f2887a); }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; margin: 0; }
    .playlink { color: var(--rm-accent, #2a9d8f); font-weight: 700; text-decoration: none; margin-left: 0.35rem; }
    .playlink:hover { text-decoration: underline; }
    .topmost { color: var(--rm-accent, #2a9d8f); font-size: 0.9rem; font-weight: 600; margin: 0.2rem 0 0; }

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
    .addn .folds { margin: 0.2rem 0 0; }

    /* ── Ítems plegables (expectativas y addendums) ── */
    .fold { border-top: 1px solid var(--rm-border, #eef0f2); }
    .fold summary { cursor: pointer; padding: 0.45rem 0; font-size: 0.85rem; }
    .fold summary::-webkit-details-marker { color: var(--rm-muted, #9ca3af); }
    .fold summary:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
    .fold .dim { font-weight: 700; }
    .fold-body { font-size: 0.83rem; color: var(--rm-text, #111827); margin: 0.1rem 0 0.5rem; padding-left: 1.1rem; }
    .fold-empty { display: flex; gap: 0.4rem; align-items: baseline; padding: 0.45rem 0; font-size: 0.85rem; }
    .fold-empty .todo { color: var(--rm-muted, #9ca3af); font-style: italic; }
    @media (prefers-reduced-motion: no-preference) {
      .fold[open] .fold-body { animation: fold-in 0.16s ease-out; }
      @keyframes fold-in { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: none; } }
    }

    .aspire { list-style: none; margin: 0; padding: 0; }
    .aspire > li { border-top: 1px solid var(--rm-border, #eef0f2); }
    .aspire summary { cursor: pointer; padding: 0.45rem 0; font-size: 0.88rem; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
    .aspire summary::-webkit-details-marker { color: var(--rm-muted, #9ca3af); }
    .aspire .code { font-weight: 700; }
    .aspire .track { color: var(--rm-muted, #6b7280); font-size: 0.78rem; }
    .aspire .desc { font-size: 0.82rem; color: var(--rm-muted, #4b5563); margin: 0 0 0.5rem; padding-left: 1.1rem; }

    /* ── Evolución / Próximos pasos (única escritura del ingeniero) ── */
    .next-single { border-top: 1px solid var(--rm-border, #eef0f2); padding: 0.5rem 0 0.2rem; }
    .next-single .lvl { margin: 0; font-size: 0.9rem; }
    .next-single .code { font-weight: 700; }
    .next-single .track { color: var(--rm-muted, #6b7280); font-size: 0.78rem; margin-left: 0.4rem; }
    .next-single .desc { font-size: 0.82rem; color: var(--rm-muted, #4b5563); margin: 0.2rem 0 0.5rem; }
    .target-picker { border: 0; margin: 0; padding: 0; }
    .target-legend { font-size: 0.85rem; font-weight: 700; color: var(--rm-text, #111827); padding: 0; margin: 0 0 0.3rem; }
    .target-opt { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.4rem 0; border-top: 1px solid var(--rm-border, #eef0f2); font-size: 0.88rem; cursor: pointer; }
    .target-opt input { margin: 0; accent-color: var(--rm-accent, #2a9d8f); cursor: pointer; }
    .target-opt input:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .target-opt .code { font-weight: 700; }
    .target-opt .track { color: var(--rm-muted, #6b7280); font-size: 0.78rem; }
    .target-btn {
      font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer;
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827); border-radius: 999px; padding: 0.3rem 0.9rem; margin-top: 0.5rem;
    }
    .target-btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .target-btn:hover:not(:disabled) { filter: brightness(0.97); }
    .target-btn:disabled { opacity: 0.6; cursor: default; }
    .target-btn:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .target-current { margin: 0.6rem 0 0; font-size: 0.9rem; font-weight: 700; color: var(--rm-accent, #2a9d8f); }
    .target-current .code { font-weight: 800; }
    .target-error { margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--rm-coral, #c2410c); }

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
    /** @type {import('../tools/career/domain/types.js').Archipelago|null} índice del archipiélago (ficha MC-21) */
    this.archipelago = null;
    /** @type {import('../tools/career/domain/achievements.js').Achievements|null} logros registrados (ficha MC-21) */
    this.achievements = null;
    /** @type {import('../tools/career/domain/wizard.js').WizardQuestion[]} consultas al brujo (ficha MC-22) */
    this.questions = [];
    /** @type {string|null} aviso in-place si falla la escritura del objetivo */
    this._targetError = null;
    /** @type {boolean} true mientras se persiste el objetivo (deshabilita controles) */
    this._targetSaving = false;
    /** @type {typeof TABS[number]} pestaña activa (inicializada desde el hash) */
    this._tab = TABS.includes(/** @type {any} */ (location.hash.slice(1)))
      ? /** @type {typeof TABS[number]} */ (location.hash.slice(1))
      : 'carrera';
    // Mantiene la pestaña activa sincronizada con el hash (recarga / atrás-adelante).
    this._onHashChange = () => {
      const t = location.hash.slice(1);
      if (TABS.includes(/** @type {any} */ (t))) this._tab = /** @type {typeof TABS[number]} */ (t);
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this._onHashChange);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this._onHashChange);
    super.disconnectedCallback();
  }

  /**
   * Cambia de pestaña escribiendo el hash (para conservar la selección al
   * recargar y en el historial). El listener de `hashchange` actualiza `_tab`;
   * si el hash ya coincide, se fija directamente.
   * @param {typeof TABS[number]} tab
   * @returns {void}
   */
  _setTab(tab) {
    if (location.hash.slice(1) !== tab) location.hash = tab;
    else this._tab = tab;
  }

  /**
   * Navegación por teclado de la barra de pestañas (patrón ARIA tablist con
   * activación automática): ←/→ recorren las pestañas de forma circular y
   * Home/End saltan a la primera/última, moviendo el foco a la nueva pestaña.
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  _onTabsKeydown(e) {
    const i = TABS.indexOf(this._tab);
    let next = i;
    if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    const tab = TABS[next];
    this._setTab(tab);
    // Tras el re-render, mueve el foco a la pestaña recién activada.
    this.updateComplete.then(() => {
      /** @type {HTMLElement|null} */ (this.renderRoot.querySelector(`#tab-${tab}`))?.focus();
    });
  }

  /**
   * Ítem plegable (dimensión → texto) como `<details>` nativo. Si no hay texto
   * (pendiente de definir), devuelve una fila estática sin desplegable: el
   * titular ya comunica el estado y no hay cuerpo que revelar.
   * @param {string} name Titular (nombre de la dimensión) mostrado en el summary.
   * @param {string} [text] Texto completo revelado al desplegar.
   * @returns {import('lit').TemplateResult}
   */
  _fold(name, text) {
    return text
      ? html`
          <details class="fold">
            <summary><span class="dim">${name}</span></summary>
            <p class="fold-body">${text}</p>
          </details>
        `
      : html`
          <div class="fold fold-empty">
            <span class="dim">${name}</span>
            <span class="todo">pendiente de definir</span>
          </div>
        `;
  }

  /**
   * Barra de pestañas accesible (tablist con roving tabindex): solo la pestaña
   * activa es tabulable; las flechas mueven el foco y la selección.
   * @returns {import('lit').TemplateResult}
   */
  _renderTabs() {
    return html`
      <div class="tabs" role="tablist" aria-label="Secciones de mi espacio" @keydown=${this._onTabsKeydown}>
        ${TABS.map((tab) => {
          const selected = this._tab === tab;
          return html`
            <button
              id="tab-${tab}"
              class="tab ${selected ? 'active' : ''}"
              type="button"
              role="tab"
              aria-selected=${selected ? 'true' : 'false'}
              aria-controls="panel-${tab}"
              tabindex=${selected ? '0' : '-1'}
              @click=${() => this._setTab(tab)}
            >${TAB_META[tab].label}</button>
          `;
        })}
      </div>
    `;
  }

  /**
   * Declara el nivel objetivo de carrera del propio ingeniero (o lo retira con
   * `null`). Persiste con `setCareerTarget` —la ÚNICA escritura del ingeniero— y,
   * si tiene éxito, refleja el nuevo estado reemplazando `this.person` por un
   * objeto nuevo (identidad distinta, para que Lit vuelva a renderizar). Ante
   * error deja un aviso in-place y NO altera el estado local: la UI se mantiene
   * coherente con lo realmente persistido (el radio/botón vuelve a su valor).
   * @param {string|null} levelId  id del nivel objetivo, o null para quitarlo
   * @returns {Promise<void>}
   */
  async _selectTarget(levelId) {
    const person = this.person;
    if (!person) return;
    // Sin cambios: evita una escritura redundante (y el rechazo de las reglas por
    // un diff vacío al re-seleccionar el objetivo ya vigente).
    if ((person.careerTargetLevelId ?? null) === levelId) return;
    this._targetError = null;
    this._targetSaving = true;
    try {
      await setCareerTarget(person.id, levelId);
      this.person = { ...person, careerTargetLevelId: levelId };
    } catch {
      this._targetError = 'No se pudo guardar tu objetivo. Vuelve a intentarlo en unos minutos.';
    } finally {
      this._targetSaving = false;
    }
  }

  /**
   * Sección «Evolución / Próximos pasos»: los niveles a los que el ingeniero puede
   * aspirar desde su nivel actual y la declaración de su objetivo de carrera (única
   * escritura permitida). Debajo, las metas (expectativas) del nivel objetivo.
   * @param {CareerFramework|null} fw
   * @returns {import('lit').TemplateResult}
   */
  _renderNextSteps(fw) {
    const person = this.person;
    const options = aspirationalLevels(fw, person.levelId);
    const targetId = person.careerTargetLevelId ?? null;
    const targetLevel = targetId ? getLevel(fw, targetId) : null;
    // Nivel cuyas metas se muestran: el objetivo declarado o, si solo hay un
    // siguiente nivel, ese único siguiente (aún sin fijar).
    const metaLevelId = targetId ?? (options.length === 1 ? options.at(0).id : null);

    return html`
      <p class="sub">Evolución / Próximos pasos</p>
      ${options.length === 0
        ? html`<p class="topmost">🎯 Estás en el nivel más alto de tu itinerario: no hay más niveles por escalar ni vías a las que saltar.</p>`
        : this._renderTargetChooser(fw, options, targetId)}
      ${this._targetError ? html`<p class="target-error" role="alert">${this._targetError}</p>` : null}
      ${targetLevel
        ? html`<p class="target-current">Tu objetivo: <span class="code">${targetLevel.code}</span> · ${targetLevel.title}</p>`
        : null}
      ${metaLevelId ? this._renderTargetGoals(fw, metaLevelId) : null}
    `;
  }

  /**
   * Selector del objetivo de carrera. Con un único siguiente nivel se presenta como
   * «tu siguiente paso» con un botón para fijarlo/quitarlo; con varios, un grupo de
   * radios accesible (fieldset+legend, navegable por teclado) que persiste al marcar.
   * @param {CareerFramework|null} fw
   * @param {import('../tools/career/data/framework.js').AspirationalLevel[]} options
   * @param {string|null} targetId  objetivo declarado actualmente (o null)
   * @returns {import('lit').TemplateResult}
   */
  _renderTargetChooser(fw, options, targetId) {
    const trackName = (trackId) => (fw?.tracks ?? []).find((t) => t.id === trackId)?.name ?? '';
    if (options.length === 1) {
      const opt = options.at(0);
      const isTarget = targetId === opt.id;
      return html`
        <div class="next-single">
          <p class="lvl">
            <span class="code">${opt.code}</span> · ${opt.title}
            ${trackName(opt.trackId) ? html`<span class="track">${trackName(opt.trackId)}</span>` : null}
          </p>
          ${opt.description ? html`<p class="desc">${opt.description}</p>` : null}
          ${isTarget
            ? html`<button type="button" class="target-btn" ?disabled=${this._targetSaving} @click=${() => this._selectTarget(null)}>Quitar objetivo</button>`
            : html`<button type="button" class="target-btn primary" ?disabled=${this._targetSaving} @click=${() => this._selectTarget(opt.id)}>Fijar como objetivo</button>`}
        </div>
      `;
    }
    return html`
      <fieldset class="target-picker">
        <legend class="target-legend">Marca tu objetivo de carrera</legend>
        ${options.map(
          (opt) => html`
            <label class="target-opt">
              <input
                type="radio"
                name="career-target"
                .checked=${targetId === opt.id}
                ?disabled=${this._targetSaving}
                @change=${() => this._selectTarget(opt.id)}
              />
              <span>
                <span class="code">${opt.code}</span> · ${opt.title}
                ${trackName(opt.trackId) ? html`<span class="track">${trackName(opt.trackId)}</span>` : null}
              </span>
            </label>
          `,
        )}
      </fieldset>
      ${targetId
        ? html`<button type="button" class="target-btn" ?disabled=${this._targetSaving} @click=${() => this._selectTarget(null)}>Quitar objetivo</button>`
        : null}
    `;
  }

  /**
   * Metas del nivel objetivo: sus expectativas por dimensión, plegadas como
   * `<details>` (mismo patrón summary/detalle que «Lo que se te reconoce»).
   * @param {CareerFramework|null} fw
   * @param {string} levelId  id del nivel objetivo
   * @returns {import('lit').TemplateResult}
   */
  _renderTargetGoals(fw, levelId) {
    const goals = expectationsForLevel(fw, levelId);
    return html`
      <p class="sub">Lo que tendrás que demostrar</p>
      <div class="expect">
        ${goals.map((row) => this._fold(row.dimension.name, row.text))}
      </div>
    `;
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

    const expectations = level ? expectationsForLevel(fw, person.levelId) : [];
    const addendums = addendumsForDisciplines(fw, disciplineIds);
    const addendumsByDiscipline = Object.groupBy(addendums, (a) => a.discipline.id);

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
            <div class="expect">
              ${expectations.map((row) => this._fold(row.dimension.name, row.text))}
            </div>
          `
        : null}

      ${addendums.length > 0
        ? html`
            <p class="sub">Enfoque por disciplina</p>
            <div class="addn">
              ${Object.values(addendumsByDiscipline).map(
                (rows) => html`
                  <p class="disc">${rows.at(0).discipline.name}</p>
                  <div class="folds">
                    ${rows.map((a) => this._fold(a.dimension.name, a.text))}
                  </div>
                `,
              )}
            </div>
          `
        : null}

      ${level ? this._renderNextSteps(fw) : null}
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
   * Bloque «Mi ficha de ciudadanía» (MC-21): el MISMO <player-card> del juego,
   * en solo lectura, con la progresión derivada del journey + índice del
   * archipiélago y los logros registrados (fechas). Sin índice o sin journey
   * todavía no se pinta (el resto de la pestaña ya comunica el estado vacío).
   * @returns {import('lit').TemplateResult|null}
   */
  _renderCitizenshipCard() {
    if (!this.archipelago || !this.journey) return null;
    const progress = archipelagoProgress(this.journey, this.archipelago.islands);
    return html`
      <p class="sub">Mi ficha de ciudadanía</p>
      <player-card
        .playerName=${this.person?.name ?? ''}
        .progress=${progress}
        .achievements=${this.achievements}
        .visitedIslands=${this.journey.visitedIslands ?? []}
        .questions=${this.questions ?? []}
      ></player-card>
    `;
  }

  /**
   * Sección «Mi mapa de carrera»: la ficha de ciudadanía (MC-21) y el resumen
   * de solo lectura del journey sobre la isla. Muestra la isla (visual, sin
   * acciones), progreso, ciudad actual, ciudades dominadas agrupadas por
   * comarca y la ruta marcada. Sin botones ni escritura: <career-map> es
   * presentacional y su evento `select-city` no se enlaza a nada.
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
      // El ingeniero JUEGA (JG-1): sin plan trazado, la salida natural es ir
      // al juego a trazarlo con su propia cuenta.
      return html`<p class="empty">
        Aún no tienes un mapa de carrera trazado.
        <a class="playlink" href="/tools/career-map">🎮 Empieza a jugar tu mapa</a>
      </p>`;
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
      ${this._renderCitizenshipCard()}
      <p class="sub">Mi isla actual</p>
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
    const meta = TAB_META[this._tab];
    // Cada pestaña reutiliza su método de render existente (sin duplicar lógica).
    const panel = {
      carrera: () => this._renderCareer(),
      rolemirror: () => this._renderRoleMirror(),
      mapa: () => this._renderMap(),
    }[this._tab];

    return html`
      ${this._renderTabs()}
      <section
        id="panel-${this._tab}"
        class="${meta.cls}"
        role="tabpanel"
        aria-labelledby="tab-${this._tab}"
        tabindex="0"
      >
        <h2>${meta.heading}</h2>
        ${panel()}
      </section>
    `;
  }
}

if (!customElements.get('engineer-space')) {
  customElements.define('engineer-space', EngineerSpace);
}
