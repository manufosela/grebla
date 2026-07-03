/**
 * <career-app>
 * Shell del Mapa de Carrera: selector de PERSONA del equipo, barra de progreso/
 * nivel, el mapa de la isla y un panel de acciones/evidencias para la ciudad
 * seleccionada. Igual que Role Mirror, el líder elige a quién edita y el journey
 * se persiste en el subárbol de esa persona.
 *
 * En el modo 3D (MC-6) el detalle es un PANEL DE CIUDADANÍA overlay sobre el
 * canvas (lateral en escritorio, hoja inferior en móvil): estado como insignia
 * de juego, prerequisitos que faltan, y las MISMAS acciones/evidencias/
 * recomendaciones que la vista plana (métodos de render compartidos, sin
 * duplicar lógica). El zoom al hacer clic lo anima <career-island-3d> por
 * sí solo; aquí solo se invoca `focusOverview()` desde el botón «Isla completa».
 *
 * Evidencias (MC-8): las listas (formaciones, cursos) se editan como CHIPS con
 * ✕ para quitar y un input con botón «+» (o Enter) para añadir de una en una —
 * nada de texto separado por comas. El campo `titulos` desaparece de la UI:
 * los títulos existentes se muestran fusionados dentro de cursos y, al editar
 * cursos, se escriben en `cursos` vaciando `titulos` (migración suave; el
 * modelo CityEvidence no cambia).
 *
 * Primera persona (MC-7): el botón «Explorar a pie» del HUD 3D llama a
 * `enterFirstPerson()` del componente de la isla; con puntero grueso (táctil)
 * queda deshabilitado como «modo de escritorio». El evento `mode-change`
 * reduce el HUD en fps: se ocultan la barra superior (persona/vistas/progreso)
 * y solo queda el botón «Salir (Esc)». El panel de ciudadanía funciona igual
 * (se abre con E/clic desde la isla, que suelta el pointer lock; al cerrarlo,
 * un clic en el canvas lo re-engancha).
 *
 * Propiedades (inyectadas desde client/career.js):
 *  - store: CareerStore
 *  - people: { id: string, name: string }[]   personas del equipo del líder
 */
import { LitElement, html, css } from 'lit';
import './career-map.js';
import './career-island-3d.js';
import {
  getJourney,
  toggleVisited,
  setCurrent,
  toggleRoute,
  setEvidence,
  stats,
} from '../../tools/career/application/usecases.js';
import { getCareerMap } from '../../lib/careerMap.js';
import { cityStatus, missingPrereqs } from '../../tools/career/domain/progress.js';

export class CareerApp extends LitElement {
  static properties = {
    store: { attribute: false },
    people: { attribute: false },
    personId: { state: true },
    error: { state: true },
    journey: { state: true },
    selected: { state: true },
    loading: { state: true },
    map: { state: true },
    viewMode: { state: true },
    mode3d: { state: true },
  };

  /** Clave de persistencia sencilla para el modo de vista. */
  static VIEW_MODE_KEY = 'grebla:career:viewMode';

  static styles = css`
    :host { display: flex; flex-direction: column; min-height: 0; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    /* En modo 3D el canvas es el protagonista: ocupa todo el alto disponible y
       el panel de ciudadanía y el HUD flotan SOBRE él (overlay). */
    .stage3d { position: relative; display: flex; flex: 1 1 auto; min-height: 0; }
    career-island-3d.stage { flex: 1 1 auto; min-height: 0; }
    .hud { position: absolute; top: 0.75rem; left: 0.75rem; z-index: 2; display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .hud button { box-shadow: 0 2px 8px rgba(17, 24, 39, 0.12); }
    .hud button:disabled { opacity: 0.6; cursor: not-allowed; }
    .citypanel {
      position: absolute;
      z-index: 3;
      top: 0.75rem;
      right: 0.75rem;
      bottom: 0.75rem;
      width: min(360px, calc(100% - 1.5rem));
      box-sizing: border-box;
      overflow-y: auto;
      overscroll-behavior: contain;
      background: color-mix(in srgb, var(--rm-surface, #fff) 90%, transparent);
      backdrop-filter: blur(6px);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1rem 1.25rem;
      box-shadow: 0 10px 30px rgba(17, 24, 39, 0.18);
      outline: none;
    }
    /* En móvil el panel pasa a hoja inferior: el mapa sigue visible encima. */
    @media (max-width: 760px) {
      .citypanel { top: auto; left: 0.5rem; right: 0.5rem; bottom: 0.5rem; width: auto; max-height: 60%; }
    }
    .citypanel header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
    .citypanel h3 { margin: 0; font-size: 1.05rem; }
    .citypanel .kind { margin-bottom: 0; }
    .close { border: none; background: transparent; font-size: 1.05rem; line-height: 1; padding: 0.25rem 0.45rem; color: var(--rm-muted, #6b7280); }
    .close:hover { color: var(--rm-text, #111827); background: var(--rm-track, #e9f0f2); }
    .badges { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.6rem 0 0.75rem; }
    .badge { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; border: 1px solid transparent; }
    .badge.visited { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .badge.available { background: var(--rm-coral, #f2887a); color: #fff; }
    .badge.blocked { background: var(--rm-track, #d7dee2); color: var(--rm-text, #374151); }
    .badge.deprecated { background: var(--rm-danger, #dc2626); color: #fff; }
    .badge.route { border-color: var(--rm-navy, #1e3a5f); color: var(--rm-navy, #1e3a5f); }
    .badge.current { border-color: var(--rm-coral-600, #e26d5e); color: var(--rm-coral-600, #e26d5e); }
    .blockedby { font-size: 0.78rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    label { font-size: 0.8rem; color: var(--rm-muted, #6b7280); font-weight: 600; display: inline-flex; gap: 0.4rem; align-items: center; }
    select { padding: 0.4rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font-size: 0.9rem; }
    .viewswitch { display: inline-flex; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; overflow: hidden; }
    .viewswitch button { border: none; border-radius: 0; background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280); font-size: 0.8rem; font-weight: 700; padding: 0.4rem 0.7rem; cursor: pointer; }
    .viewswitch button + button { border-left: 1px solid var(--rm-border, #d1d5db); }
    .viewswitch button.active { background: var(--rm-accent, #2a9d8f); color: #fff; }
    .viewswitch button:focus-visible { outline: 2px solid var(--rm-navy, #1e3a5f); outline-offset: -2px; }
    .stat { display: flex; align-items: baseline; gap: 0.6rem; }
    .lvl { font-weight: 800; color: var(--rm-accent, #2a9d8f); }
    .pts { font-size: 0.85rem; color: var(--rm-muted, #6b7280); font-variant-numeric: tabular-nums; }
    .progress { height: 8px; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; margin-bottom: 1rem; }
    .progress span { display: block; height: 100%; background: var(--rm-accent, #2a9d8f); border-radius: 999px; transition: width 0.3s ease; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(220px, 1fr); gap: 1.5rem; align-items: start; }
    @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    .panel { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb); border-radius: var(--rm-radius, 12px); padding: 1rem 1.25rem; }
    .panel h3 { margin: 0 0 0.2rem; }
    .kind { font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; text-transform: capitalize; }
    .actions { display: flex; flex-direction: column; gap: 0.5rem; }
    button { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.5rem 0.8rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .pre { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); margin: 0.75rem 0 0; }
    .hint { font-size: 0.85rem; color: var(--rm-muted, #9ca3af); }
    .legend { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; margin-top: 1rem; font-size: 0.72rem; color: var(--rm-muted, #6b7280); }
    .legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
    .legend .d { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .legend .d.visited { background: var(--rm-accent, #2a9d8f); }
    .legend .d.reachable { background: var(--rm-coral, #f2887a); }
    .legend .d.locked { background: var(--rm-track, #d7dee2); }
    .legend .d.deprecated { background: var(--rm-danger, #dc2626); opacity: 0.55; }
    .legend .r { width: 10px; height: 10px; border-radius: 50%; display: inline-block; border: 2px solid; }
    .legend .r.current { border-color: var(--rm-coral-600, #e26d5e); }
    .legend .r.target { border-color: var(--rm-navy, #1e3a5f); }
    .empty { color: var(--rm-muted, #9ca3af); padding: 1rem 0; }
    .error { color: var(--rm-danger, #dc2626); }
    .ev { margin-top: 1rem; border-top: 1px solid var(--rm-border, #eef0f2); padding-top: 0.75rem; }
    .ev summary { margin: 0 0 0.5rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); cursor: pointer; font-weight: 700; }
    .ev label { display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.75rem; color: var(--rm-muted, #6b7280); }
    .ev input { width: 100%; box-sizing: border-box; margin-top: 0.2rem; padding: 0.4rem 0.5rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); font-size: 0.85rem; color: var(--rm-text, #111827); background: var(--rm-surface, #fff); }
    /* Listas de evidencias como chips (MC-8): ✕ para quitar, «+» para añadir. */
    .evlist { margin-bottom: 0.6rem; }
    .evtitle { display: block; font-weight: 600; font-size: 0.75rem; color: var(--rm-muted, #6b7280); margin-bottom: 0.25rem; }
    .chips { list-style: none; display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0 0 0.35rem; padding: 0; }
    .chip { display: inline-flex; align-items: center; gap: 0.25rem; background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.15rem 0.3rem 0.15rem 0.6rem; font-size: 0.78rem; color: var(--rm-text, #111827); }
    .chip-x { border: none; background: transparent; cursor: pointer; padding: 0.05rem 0.3rem; font-size: 0.7rem; line-height: 1; color: var(--rm-muted, #6b7280); border-radius: 999px; }
    .chip-x:hover { color: var(--rm-danger, #dc2626); background: rgba(220, 38, 38, 0.1); }
    .evadd { display: flex; gap: 0.35rem; }
    .evadd input { width: auto; flex: 1 1 auto; min-width: 0; margin-top: 0; }
    .evadd .plus { flex: 0 0 auto; padding: 0.3rem 0.75rem; font-weight: 700; font-size: 0.9rem; line-height: 1; }
    .legend-wrap { margin-top: 1rem; }
    .legend-wrap summary { font-size: 0.78rem; color: var(--rm-muted, #6b7280); cursor: pointer; font-weight: 700; }
    .recs { margin: 0.75rem 0 0; padding: 0; list-style: none; font-size: 0.78rem; }
    .recs li { margin: 0.2rem 0; color: var(--rm-muted, #6b7280); }
    .recs a { color: var(--rm-accent, #2a9d8f); }
    .dep { font-size: 0.78rem; color: var(--rm-danger, #dc2626); font-weight: 600; margin: 0 0 0.5rem; }
  `;

  constructor() {
    super();
    this.store = null;
    /** @type {{ id: string, name: string }[]} */
    this.people = [];
    this.personId = null;
    this.error = '';
    this.journey = { visitedCities: [], currentCity: null, plannedRoute: [], evidences: {} };
    this.selected = null;
    this.loading = false;
    /** @type {import('../../tools/career/domain/types.js').CareerMap|null} */
    this.map = null;
    this._loadedPerson = null;
    this._mapLoaded = false;
    // Modo de vista: '3d' (isla Three.js, por defecto) o 'flat' (plano,
    // fallback). La 2.5D se retiró en MC-8.
    this.viewMode = this._readViewMode();
    // Modo de cámara del 3D (MC-7): 'aerial' | 'fps'; lo comunica la isla.
    this.mode3d = 'aerial';
    // Puntero grueso (táctil): la primera persona necesita ratón y teclado; el
    // botón queda deshabilitado como «modo de escritorio» (controles táctiles,
    // futura mejora). Guardado con typeof por el render estático de Astro.
    this._coarsePointer =
      typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  }

  /** Lee la preferencia de modo de vista sin romper SSR/estático. El valor
   * legado 'island' (2.5D, retirada en MC-8) cae al 3D. */
  _readViewMode() {
    if (typeof localStorage === 'undefined') return '3d';
    const stored = localStorage.getItem(CareerApp.VIEW_MODE_KEY);
    return stored === 'flat' ? 'flat' : '3d';
  }

  /** @param {'3d'|'flat'} mode */
  _setViewMode(mode) {
    if (mode !== '3d') this.mode3d = 'aerial'; // el modo a pie no sobrevive al cambio de vista
    this.viewMode = mode;
    if (typeof localStorage !== 'undefined') localStorage.setItem(CareerApp.VIEW_MODE_KEY, mode);
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (changed.has('personId')) this.selected = null;
    if (this.store && !this._mapLoaded) {
      this._mapLoaded = true;
      this._loadMap();
    }
    if (this.store && this.personId && this._loadedPerson !== this.personId) {
      this._loadedPerson = this.personId;
      this._load();
    }
    // Accesibilidad del panel de ciudadanía (3D): al abrirse recibe el foco
    // (tabindex="-1"), de modo que Escape lo cierra sin pasos intermedios.
    if (changed.has('selected') && this.selected && this.viewMode === '3d') {
      this.renderRoot.querySelector('.citypanel')?.focus();
    }
  }

  /** Carga el mapa (la isla) desde Firestore una sola vez; con fallback a la semilla. */
  async _loadMap() {
    try {
      this.map = await getCareerMap();
    } catch (err) {
      this._mapLoaded = false;
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el mapa de carrera.';
    }
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      this.journey = await getJourney(this.store, this.personId);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el mapa de esta persona.';
    } finally {
      this.loading = false;
    }
  }

  get _map() {
    return this.map;
  }

  _changePerson(event) {
    this.personId = event.target.value || null;
    this.error = '';
  }

  _onSelect(event) {
    this.selected = event.detail.cityId;
  }

  async _act(action) {
    if (!this.personId || !this.selected) return;
    const map = this._map;
    this.error = '';
    try {
      if (action === 'toggle') this.journey = await toggleVisited(this.store, this.personId, map, this.journey, this.selected);
      else if (action === 'current') this.journey = await setCurrent(this.store, this.personId, this.journey, this.selected);
      else if (action === 'route') this.journey = await toggleRoute(this.store, this.personId, this.journey, this.selected);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo actualizar.';
    }
  }

  /** Persiste el objeto de evidencias completo de la ciudad seleccionada. */
  async _persistEvidence(next) {
    this.error = '';
    try {
      this.journey = await setEvidence(this.store, this.personId, this.journey, this.selected, next);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron guardar las evidencias.';
    }
  }

  /** Guarda la experiencia previa (años) de la ciudad seleccionada. @param {string} value */
  async _saveExperience(value) {
    if (!this.personId || !this.selected) return;
    const prev = this.journey.evidences?.[this.selected] ?? {};
    await this._persistEvidence({
      ...prev,
      priorExperienceYears: value === '' ? undefined : Number(value),
    });
  }

  /**
   * Guarda una LISTA de evidencias (chips). Al editar cursos, los títulos
   * antiguos ya vienen fusionados en `values` (los muestra la UI dentro de
   * cursos), así que el campo legado `titulos` se vacía: migración suave al
   * editar, sin tocar journeys que nadie edita.
   * @param {'formaciones'|'cursos'} field
   * @param {string[]} values
   */
  async _saveEvidenceList(field, values) {
    if (!this.personId || !this.selected) return;
    const prev = this.journey.evidences?.[this.selected] ?? {};
    const next = { ...prev, [field]: values };
    if (field === 'cursos' && (prev.titulos ?? []).length > 0) next.titulos = [];
    await this._persistEvidence(next);
  }

  /**
   * Añade el valor del input de una lista de chips (botón «+» o Enter) y lo
   * limpia. Los duplicados exactos se ignoran sin error.
   * @param {'formaciones'|'cursos'} field
   * @param {string[]} values Lista actual mostrada.
   * @param {HTMLInputElement} input
   */
  _addEvidenceItem(field, values, input) {
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    if (values.includes(value)) return;
    this._saveEvidenceList(field, [...values, value]);
  }

  /**
   * Quita un chip de una lista de evidencias.
   * @param {'formaciones'|'cursos'} field
   * @param {string[]} values Lista actual mostrada.
   * @param {number} index
   */
  _removeEvidenceItem(field, values, index) {
    this._saveEvidenceList(field, values.toSpliced(index, 1));
  }

  /**
   * Cierra el panel de ciudadanía: deselecciona SIN mover la cámara (el usuario
   * sigue donde estaba) y devuelve el foco al HUD para no perder el teclado.
   * En fps el foco cae en «Salir (Esc)»; un clic en el canvas retoma el lock.
   */
  _closeCityPanel() {
    this.selected = null;
    this.updateComplete.then(() => this.renderRoot.querySelector('.hud button')?.focus());
  }

  /** Escape dentro del panel de ciudadanía lo cierra. @param {KeyboardEvent} event */
  _onPanelKeydown(event) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this._closeCityPanel();
  }

  /** Botón HUD «Isla completa»: vuelta animada al encuadre aéreo de la isla. */
  _focusOverview() {
    this.renderRoot.querySelector('career-island-3d')?.focusOverview();
  }

  /** La isla comunica su modo de cámara ('aerial'|'fps'): el HUD se adapta. */
  _onModeChange(event) {
    this.mode3d = event.detail.mode;
  }

  /** Botón HUD «Explorar a pie»: entra en primera persona (solo escritorio). */
  _enterFps() {
    if (this._coarsePointer) return;
    this.renderRoot.querySelector('career-island-3d')?.enterFirstPerson();
  }

  /** Botón HUD «Salir (Esc)»: vuelta a la vista aérea con transición. */
  _exitFps() {
    this.renderRoot.querySelector('career-island-3d')?.exitFirstPerson();
  }

  /**
   * Conmutador de vista Isla 3D / Plano. El plano queda como fallback
   * (también automático si no hay WebGL); la 2.5D se retiró en MC-8.
   */
  _renderViewSwitch() {
    const modes = [
      { id: '3d', label: 'Isla 3D' },
      { id: 'flat', label: 'Plano' },
    ];
    return html`<div class="viewswitch" role="group" aria-label="Modo de vista del mapa">
      ${modes.map(
        (m) => html`<button
          type="button"
          class=${this.viewMode === m.id ? 'active' : ''}
          aria-pressed=${this.viewMode === m.id}
          @click=${() => this._setViewMode(m.id)}
        >${m.label}</button>`,
      )}
    </div>`;
  }

  /** WebGL no disponible: cae a la vista plana SIN persistir (permite reintentar). */
  _onWebglUnavailable() {
    this.viewMode = 'flat';
  }

  // ---- Detalle de ciudad COMPARTIDO entre vistas (grid y panel 3D) -----------

  /**
   * Acciones de journey sobre la ciudad (visitada/actual/ruta). Si la ciudad
   * está en desuso solo se muestra la nota (no es visitable), como hasta ahora.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityActions(sel) {
    if (sel.deprecated) {
      return html`<p class="dep">Tecnología en desuso — no forma parte de la ruta.</p>`;
    }
    const visited = this.journey.visitedCities ?? [];
    const inRoute = (this.journey.plannedRoute ?? []).includes(sel.id);
    return html`<div class="actions">
      <button class="primary" @click=${() => this._act('toggle')}>
        ${visited.includes(sel.id) ? 'Quitar de visitadas' : 'Marcar como visitada'}
      </button>
      <button @click=${() => this._act('current')}>Marcar como ciudad actual</button>
      <button @click=${() => this._act('route')}>${inRoute ? 'Quitar de la ruta' : 'Añadir a la ruta'}</button>
    </div>`;
  }

  /** Recomendaciones formativas de la ciudad (enlaces cuando tienen url). */
  _renderCityRecs(sel) {
    if (!(sel.recommendations ?? []).length) return null;
    return html`<ul class="recs">
      ${sel.recommendations.map(
        (r) => html`<li>${r.kind}: ${r.url ? html`<a href=${r.url} target="_blank" rel="noopener">${r.label}</a>` : r.label}</li>`,
      )}
    </ul>`;
  }

  /**
   * Evidencias de ciudadanía de la ciudad (editables; ocultas si está en
   * desuso). Las listas se editan como chips (MC-8); los títulos legados se
   * muestran fusionados dentro de cursos (ver _saveEvidenceList).
   */
  _renderCityEvidences(sel) {
    if (sel.deprecated) return null;
    const ev = this.journey.evidences?.[sel.id] ?? {};
    const cursos = [...(ev.cursos ?? []), ...(ev.titulos ?? [])];
    return html`<details class="ev">
      <summary>Evidencias</summary>
      <label>Experiencia previa (años)
        <input
          type="number"
          min="0"
          step="0.5"
          .value=${ev.priorExperienceYears ?? ''}
          @change=${(e) => this._saveExperience(e.target.value)}
        />
      </label>
      ${this._renderEvidenceList('formaciones', 'Formaciones', ev.formaciones ?? [])}
      ${this._renderEvidenceList('cursos', 'Cursos y títulos', cursos)}
    </details>`;
  }

  /**
   * Lista de evidencias editable como chips: cada valor con su ✕ para quitar,
   * y un input con botón «+» (o Enter) para añadir de una en una.
   * @param {'formaciones'|'cursos'} field
   * @param {string} label
   * @param {string[]} values
   */
  _renderEvidenceList(field, label, values) {
    const add = (input) => this._addEvidenceItem(field, values, input);
    return html`<div class="evlist">
      <span class="evtitle">${label}</span>
      ${values.length
        ? html`<ul class="chips">
            ${values.map(
              (value, i) => html`<li class="chip">
                <span>${value}</span>
                <button
                  type="button"
                  class="chip-x"
                  aria-label="Quitar ${value} de ${label}"
                  title="Quitar"
                  @click=${() => this._removeEvidenceItem(field, values, i)}
                >✕</button>
              </li>`,
            )}
          </ul>`
        : null}
      <div class="evadd">
        <input
          type="text"
          placeholder="Añadir…"
          aria-label="Añadir a ${label}"
          @keydown=${(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            add(e.target);
          }}
        />
        <button
          type="button"
          class="plus"
          aria-label="Añadir a ${label}"
          title="Añadir"
          @click=${(e) => add(e.target.closest('.evadd').querySelector('input'))}
        >+</button>
      </div>
    </div>`;
  }

  /** Insignias de juego del estado de ciudadanía (panel del modo 3D). */
  static STATUS_BADGES = Object.freeze({
    visited: 'Ciudadano',
    available: 'Visado disponible',
    blocked: 'Bloqueada',
    deprecated: 'En desuso',
  });

  /**
   * Panel de ciudadanía overlay del modo 3D: título de juego, insignias de
   * estado, explicación del bloqueo (prereqs que faltan, con sus nombres) y el
   * mismo detalle (acciones/recomendaciones/evidencias) que las otras vistas.
   * @param {import('../../tools/career/domain/types.js').City} sel
   */
  _renderCityPanel(sel) {
    const map = this._map;
    const st = cityStatus(map, sel.id, this.journey);
    const status = st === 'unknown' ? 'blocked' : st;
    const areaName = map.areas.find((a) => a.id === sel.area)?.name;
    const inRoute = (this.journey.plannedRoute ?? []).includes(sel.id);
    const isCurrent = this.journey.currentCity === sel.id;
    const missing = missingPrereqs(map, sel.id, this.journey.visitedCities ?? []).map(
      (id) => map.cities.find((c) => c.id === id)?.name ?? id,
    );
    return html`<aside
      class="citypanel"
      role="dialog"
      aria-label="Ciudadanía de ${sel.name}"
      tabindex="-1"
      @keydown=${this._onPanelKeydown}
    >
      <header>
        <div>
          <h3>Ciudadanía de ${sel.name}</h3>
          <p class="kind">${areaName ? html`${areaName} · ` : null}${sel.kind} · ${sel.weight} pts</p>
        </div>
        <button class="close" aria-label="Cerrar panel" title="Cerrar (Esc)" @click=${this._closeCityPanel}>✕</button>
      </header>
      <div class="badges">
        <span class="badge ${status}">${CareerApp.STATUS_BADGES[status]}</span>
        ${isCurrent ? html`<span class="badge current">Actual</span>` : null}
        ${inRoute ? html`<span class="badge route">En ruta</span>` : null}
      </div>
      ${status === 'blocked' && missing.length
        ? html`<p class="blockedby">Para conseguir el visado te falta: ${missing.join(', ')}.</p>`
        : null}
      ${this._renderCityActions(sel)}
      ${this._renderCityRecs(sel)}
      ${this._renderCityEvidences(sel)}
    </aside>`;
  }

  _renderPersonSelect() {
    return html`<label>Persona
      <select @change=${this._changePerson}>
        <option value="" ?selected=${!this.personId}>— Elige una persona —</option>
        ${(this.people ?? []).map(
          (p) => html`<option value=${p.id} ?selected=${p.id === this.personId}>${p.name}</option>`,
        )}
      </select>
    </label>`;
  }

  render() {
    if (this.error && !this.store) return html`<p class="error">${this.error}</p>`;
    if (!this.store) return html`<p class="empty">Cargando…</p>`;

    if (!this.personId) {
      return html`
        <div class="bar">${this._renderPersonSelect()}</div>
        ${this.error ? html`<p class="error">${this.error}</p>` : null}
        <p class="empty">Elige una persona de tu equipo para ver y editar su mapa de carrera en la isla.</p>
      `;
    }

    if (this.loading || !this.map) {
      return html`
        <div class="bar">${this._renderPersonSelect()}</div>
        <p class="empty">Cargando el mapa de esta persona…</p>
      `;
    }

    const map = this._map;
    const s = stats(map, this.journey);
    const sel = this.selected ? map.cities.find((c) => c.id === this.selected) : null;
    const fps = this.viewMode === '3d' && this.mode3d === 'fps';
    return html`
      ${fps
        ? null
        : html`
            <div class="bar">
              ${this._renderPersonSelect()}
              ${this._renderViewSwitch()}
              <div class="stat"><span class="lvl">${s.level}</span><span class="pts">${s.points}/${s.total} pts · ${s.pct}%</span></div>
            </div>
            <div class="progress"><span style=${`width:${s.pct}%`}></span></div>
          `}
      ${this.error ? html`<p class="error">${this.error}</p>` : null}

      ${this.viewMode === '3d'
        ? html`<div class="stage3d">
            <career-island-3d
              class="stage"
              .map=${map}
              .journey=${this.journey}
              .reachable=${s.reachable}
              .selected=${this.selected}
              @select-city=${this._onSelect}
              @webgl-unavailable=${this._onWebglUnavailable}
              @mode-change=${this._onModeChange}
            ></career-island-3d>
            <div class="hud">
              ${fps
                ? html`<button
                    @click=${this._exitFps}
                    title="Volver a la vista aérea de la isla"
                  >Salir (Esc)</button>`
                : html`
                    <button
                      @click=${this._focusOverview}
                      title="Volver a la vista aérea de toda la isla"
                    >Isla completa</button>
                    <button
                      @click=${this._enterFps}
                      ?disabled=${this._coarsePointer}
                      title=${this._coarsePointer
                        ? 'Modo de escritorio: requiere ratón y teclado'
                        : 'Recorre la isla a pie en primera persona (WASD + ratón)'}
                    >🚶 Explorar a pie${this._coarsePointer ? ' (modo de escritorio)' : ''}</button>
                  `}
            </div>
            ${sel ? this._renderCityPanel(sel) : null}
          </div>`
        : html`<div class="grid">
        <career-map
          .map=${map}
          .journey=${this.journey}
          .reachable=${s.reachable}
          .selected=${this.selected}
          @select-city=${this._onSelect}
        ></career-map>

        <div class="panel">
          ${sel
            ? html`
                <h3>${sel.name}</h3>
                <p class="kind">${sel.kind} · ${sel.weight} pts</p>
                ${this._renderCityActions(sel)}
                ${(sel.prereqs ?? []).length
                  ? html`<p class="pre">Requiere: ${sel.prereqs.map((p) => map.cities.find((c) => c.id === p)?.name).join(', ')}</p>`
                  : null}
                ${this._renderCityRecs(sel)}
                ${this._renderCityEvidences(sel)}
              `
            : html`<p class="hint">Haz clic en una ciudad de la isla para ver sus acciones y evidencias.</p>`}
          <details class="legend-wrap">
            <summary>Leyenda</summary>
            <div class="legend">
              <span><i class="d visited"></i>Visitada</span>
              <span><i class="d reachable"></i>Disponible</span>
              <span><i class="d locked"></i>Bloqueada</span>
              <span><i class="d deprecated"></i>En desuso</span>
              <span><i class="r current"></i>Actual</span>
              <span><i class="r target"></i>En ruta</span>
            </div>
          </details>
        </div>
      </div>`}
    `;
  }
}

if (!customElements.get('career-app')) {
  customElements.define('career-app', CareerApp);
}
