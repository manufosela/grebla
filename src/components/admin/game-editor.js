/**
 * <game-editor>
 * Editor del juego para el SUPERADMIN (JG-16): el contenido del Mapa de
 * Carrera deja de cambiarse solo por seeds. Dos pestañas:
 *
 *  - 🏝️ Islas: casas de cada isla del archipiélago (alta, edición y borrado
 *    con todos los campos MC-15: prereqs, keyPoints, aiFocus, recursos). Al
 *    guardar se sobrescribe el doc /careerMap/{islandId} y, si cambia el nº
 *    de casas no deprecadas, se actualiza `citiesTotal` en _archipelago.
 *  - 🗺️ Rutas: itinerarios de rol y nivel (/careerRoutes, JG-14) agrupados
 *    por rol: metadatos + paradas ORDENADAS (subir/bajar/quitar/insertar) con
 *    aviso inline si el orden viola prereqs intra-isla.
 *
 * Cliente puro (sin functions): las reglas de /careerMap/** y /careerRoutes/**
 * ya limitan la escritura al superadmin. Las validaciones viven en el dominio
 * (tools/career/domain/mapEditor.js) y aquí solo hay estado de UI e IO.
 *
 * Propiedades:
 *  - ready: boolean  (lo activa el glue cuando hay sesión de superadmin)
 */
import { LitElement, html, css } from 'lit';
import '../app-modal.js';
import {
  getArchipelago,
  getCareerMap,
  saveCareerMap,
  saveArchipelago,
  listAllCareerRoutes,
  saveCareerRoute,
  deleteCareerRoute,
} from '../../lib/careerMap.js';
import { RESOURCE_KINDS } from '../../tools/career/domain/types.js';
import {
  validateCity,
  validateRoute,
  routesAffectedByCity,
  buildCityIndex,
  activeCitiesTotal,
  CITY_KINDS,
  CITY_WEIGHT_MIN,
  CITY_WEIGHT_MAX,
} from '../../tools/career/domain/mapEditor.js';
import { ROUTE_TIER_KEYS, routeDocId } from '../../tools/career/domain/careerRoutes.js';
import { insertRouteAt } from '../../tools/career/domain/route.js';

/** Rótulos humanos del tipo de casa. */
const KIND_LABEL = Object.freeze({ tech: 'Tecnología', skill: 'Skill', milestone: 'Hito' });
/** Rótulos humanos de los hitos de ruta: los RANGOS PIRATAS del juego (las
 * keys internas de los docs no cambian). */
const TIER_LABEL = Object.freeze({ peritus: 'Grumete', veteranus: 'Corsario', magister: 'Capitán' });

/**
 * Genera un slug a partir de un texto: minúsculas, sin acentos, separadores
 * a guiones. @param {string} text @returns {string}
 */
function slugify(text) {
  return String(text ?? '')
    .normalize('NFD').replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase().trim()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replace(/^-/u, '')
    .replace(/-$/u, '');
}

/** Borrador del formulario de casa a partir de una casa existente (o vacío).
 * @param {import('../../tools/career/domain/types.js').City|null} city
 * @param {string} discipline Prefijo de id de la isla (para el alta).
 */
function cityDraft(city, discipline) {
  if (!city) {
    return {
      id: discipline ? `${discipline}/` : '',
      name: '',
      kind: 'tech',
      area: '',
      weight: '2',
      x: '50',
      y: '50',
      prereqs: [],
      keyPoints: '',
      aiFocus: '',
      resources: [],
      deprecated: false,
    };
  }
  return {
    id: city.id,
    name: city.name,
    kind: city.kind,
    area: city.area,
    weight: String(city.weight),
    x: String(city.x),
    y: String(city.y),
    prereqs: [...(city.prereqs ?? [])],
    keyPoints: (city.keyPoints ?? []).join('\n'),
    aiFocus: city.aiFocus ?? '',
    // El formato de los libros no se edita aquí pero se conserva (no se pierde
    // al guardar una casa que ya lo traía).
    resources: (city.resources ?? []).map((r) => ({ ...r })),
    deprecated: city.deprecated === true,
  };
}

/** Casa reconstruida desde el borrador del formulario (números parseados).
 * @param {ReturnType<typeof cityDraft>} draft
 * @returns {import('../../tools/career/domain/types.js').City}
 */
function draftToCity(draft) {
  /** @type {import('../../tools/career/domain/types.js').City} */
  const city = {
    id: draft.id.trim(),
    name: draft.name.trim(),
    kind: /** @type {any} */ (draft.kind),
    area: draft.area,
    x: Number(draft.x),
    y: Number(draft.y),
    weight: Number(draft.weight),
    prereqs: [...draft.prereqs],
  };
  if (draft.deprecated) city.deprecated = true;
  const keyPoints = draft.keyPoints.split('\n').map((p) => p.trim()).filter(Boolean);
  if (keyPoints.length) city.keyPoints = keyPoints;
  const aiFocus = draft.aiFocus.trim();
  if (aiFocus) city.aiFocus = aiFocus;
  const resources = draft.resources
    .map((r) => {
      /** @type {Record<string, unknown>} */
      const out = { kind: r.kind, label: String(r.label ?? '').trim() };
      const url = String(r.url ?? '').trim();
      if (url) out.url = url;
      if (r.format) out.format = r.format;
      return out;
    })
    .filter((r) => r.label);
  if (resources.length) city.resources = /** @type {any} */ (resources);
  return city;
}

/** Borrador del formulario de ruta a partir de una ruta existente (o vacío).
 * @param {import('../../tools/career/domain/careerRoutes.js').CareerRoute|null} route
 */
function routeDraft(route) {
  if (!route) {
    return { discipline: '', levelKey: 'peritus', name: '', description: '', active: true, stops: [] };
  }
  return {
    discipline: route.discipline,
    levelKey: route.levelKey,
    name: route.name,
    description: route.description,
    active: route.active,
    stops: [...route.stops],
  };
}

export class GameEditor extends LitElement {
  static properties = {
    ready: { attribute: false },
    _tab: { state: true },
    _arch: { state: true },
    _islands: { state: true },
    _routes: { state: true },
    _islandId: { state: true },
    _cityForm: { state: true },
    _confirmCity: { state: true },
    _routeForm: { state: true },
    _confirmRoute: { state: true },
    _addStop: { state: true },
    _saving: { state: true },
    _error: { state: true },
    _notice: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    h1 { font-size: 1.4rem; margin: 0; }
    .bar { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      border-radius: 999px;
      padding: 0.45rem 1rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: var(--rm-on-accent, #fff); }
    section {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.05rem; margin: 0 0 0.75rem; }
    h3 { font-size: 0.95rem; margin: 1rem 0 0.5rem; }
    .toolbar { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    button {
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      border-radius: 8px;
      padding: 0.45rem 0.9rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    button.primary { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: var(--rm-on-accent, #fff); }
    button.danger { color: var(--rm-danger, #dc2626); }
    button.danger:hover { border-color: var(--rm-danger, #dc2626); }
    button.mini { padding: 0.15rem 0.5rem; font-size: 0.78rem; border-radius: 6px; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    select, input[type='text'], input[type='url'], input[type='number'], textarea {
      padding: 0.45rem 0.6rem;
      border-radius: 8px;
      border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827);
      font-size: 0.88rem;
      font-family: inherit;
      box-sizing: border-box;
    }
    textarea { width: 100%; min-height: 4.5rem; resize: vertical; }
    /* Las opciones del multiselect no heredan el fondo del select en Chrome:
       sin esto quedan blancas en tema oscuro. El gradiente en :checked es el
       truco necesario para que Chrome respete el resaltado de seleccionadas. */
    option { background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    option:checked {
      background: linear-gradient(var(--rm-accent, #3b82f6), var(--rm-accent, #3b82f6));
      color: var(--rm-on-accent, #fff);
      font-weight: 700;
    }
    label { font-size: 0.8rem; font-weight: 600; color: var(--rm-muted, #6b7280); display: block; margin-bottom: 0.25rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.75rem 1rem; margin-bottom: 0.75rem; }
    .field-wide { grid-column: 1 / -1; }
    .field input, .field select { width: 100%; }
    .muted { color: var(--rm-muted, #9ca3af); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .notice { color: var(--rm-success, #16a34a); font-size: 0.85rem; font-weight: 600; }
    .warn {
      color: var(--rm-warning, #b45309);
      background: var(--rm-warning-bg, rgba(245, 158, 11, 0.12));
      border-radius: 8px;
      padding: 0.4rem 0.6rem;
      font-size: 0.82rem;
      margin: 0.25rem 0;
    }
    ul.plain { list-style: none; margin: 0.5rem 0; padding: 0; }
    .badge { display: inline-block; padding: 0.12rem 0.55rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
    .badge.off { background: var(--rm-track, #f3f4f6); color: var(--rm-muted, #6b7280); }
    .badge.dep { background: var(--rm-danger, #dc2626); color: #fff; }
    .stops { list-style: none; margin: 0.5rem 0; padding: 0; counter-reset: stop; }
    .stops li {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--rm-border, #eef0f2);
      font-size: 0.86rem;
    }
    .stops .n {
      min-width: 1.8rem; text-align: center; font-weight: 700;
      background: var(--rm-track, #f3f4f6); border-radius: 6px; padding: 0.1rem 0;
      font-variant-numeric: tabular-nums;
    }
    .stops .what { flex: 1; min-width: 0; }
    .stops .isl { font-size: 0.75rem; }
    .res-row { display: grid; grid-template-columns: 2fr 2fr 8rem auto; gap: 0.5rem; margin-bottom: 0.4rem; align-items: center; }
    .prereqs { width: 100%; min-height: 7rem; }
    .form-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
    .route-group { margin-bottom: 1.25rem; }
    .route-group h3 { margin-top: 0; }
    .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
    .empty { color: var(--rm-muted, #9ca3af); padding: 0.75rem 0; }
    .add-stop { display: flex; gap: 0.5rem; align-items: end; flex-wrap: wrap; margin-top: 0.5rem; }
    .add-stop .field { min-width: 10rem; }
    .pos { width: 6rem; }
  `;

  constructor() {
    super();
    this.ready = false;
    this._loaded = false;
    /** @type {'islands'|'routes'} */
    this._tab = 'islands';
    /** @type {import('../../tools/career/domain/types.js').Archipelago|null} */
    this._arch = null;
    /** @type {Map<string, import('../../tools/career/domain/types.js').CareerMap>|null} */
    this._islands = null;
    /** @type {import('../../tools/career/domain/careerRoutes.js').CareerRoute[]|null} */
    this._routes = null;
    this._islandId = '';
    /** @type {{ originalId: string|null, draft: ReturnType<typeof cityDraft>, errors: string[] }|null} */
    this._cityForm = null;
    /** @type {import('../../tools/career/domain/types.js').City|null} casa pendiente de confirmar borrado */
    this._confirmCity = null;
    /** @type {{ originalId: string|null, draft: ReturnType<typeof routeDraft>, errors: string[] }|null} */
    this._routeForm = null;
    /** @type {import('../../tools/career/domain/careerRoutes.js').CareerRoute|null} ruta pendiente de confirmar borrado */
    this._confirmRoute = null;
    /** Selector de parada nueva del formulario de ruta. */
    this._addStop = { islandId: '', cityId: '', position: '' };
    this._saving = false;
    this._error = '';
    this._notice = '';
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._noticeTimer = null;
    /** Id de casa tocado a mano en el alta: deja de autogenerarse del nombre. */
    this._cityIdTouched = false;
  }

  disconnectedCallback() {
    if (this._noticeTimer) clearTimeout(this._noticeTimer);
    super.disconnectedCallback();
  }

  updated() {
    if (this.ready && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  /** Carga índice, contenido de TODAS las islas y catálogo de rutas. */
  async _load() {
    this._error = '';
    try {
      const [arch, routes] = await Promise.all([getArchipelago(), listAllCareerRoutes()]);
      const maps = await Promise.all(arch.islands.map((i) => getCareerMap(i.id, i.name)));
      this._arch = arch;
      this._islands = new Map(maps.map((m) => [m.id, m]));
      this._routes = routes;
      this._islandId = arch.islands.at(0)?.id ?? '';
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el contenido del juego.';
    }
  }

  /** Isla seleccionada en la pestaña Islas. */
  get _island() {
    return this._islands?.get(this._islandId) ?? null;
  }

  /** Entrada del índice del archipiélago de la isla seleccionada. */
  get _archEntry() {
    return this._arch?.islands.find((i) => i.id === this._islandId) ?? null;
  }

  /** Muestra un aviso de éxito que se borra solo. @param {string} text */
  _flash(text) {
    this._notice = text;
    if (this._noticeTimer) clearTimeout(this._noticeTimer);
    this._noticeTimer = setTimeout(() => { this._notice = ''; }, 4000);
  }

  // ── Pestaña Islas: acciones ────────────────────────────────────────────────

  _openAddCity() {
    const discipline = this._archEntry?.discipline ?? this._islandId;
    const draft = cityDraft(null, discipline);
    draft.area = this._island?.areas.at(0)?.id ?? '';
    this._cityIdTouched = false;
    this._cityForm = { originalId: null, draft, errors: [] };
  }

  /** @param {import('../../tools/career/domain/types.js').City} city */
  _openEditCity(city) {
    this._cityIdTouched = true;
    this._cityForm = { originalId: city.id, draft: cityDraft(city, ''), errors: [] };
  }

  /** Cambia un campo simple del borrador de casa. @param {string} field @param {unknown} value */
  _setCityField(field, value) {
    if (!this._cityForm) return;
    this._cityForm = { ...this._cityForm, draft: { ...this._cityForm.draft, [field]: value } };
  }

  /** El nombre autogenera el slug del id SOLO en el alta (id aún no tocado a mano). @param {string} name */
  _onCityName(name) {
    if (!this._cityForm) return;
    const { originalId, draft } = this._cityForm;
    const next = { ...draft, name };
    if (originalId === null && !this._cityIdTouched) {
      const discipline = this._archEntry?.discipline ?? this._islandId;
      next.id = `${discipline}/${slugify(name)}`;
    }
    this._cityForm = { ...this._cityForm, draft: next };
  }

  /** @param {HTMLSelectElement} select */
  _onPrereqsChange(select) {
    this._setCityField('prereqs', [...select.selectedOptions].map((o) => o.value));
  }

  _addResource() {
    if (!this._cityForm) return;
    const resources = [...this._cityForm.draft.resources, { kind: 'doc', label: '', url: '' }];
    this._setCityField('resources', resources);
  }

  /** @param {number} index @param {string} field @param {string} value */
  _setResource(index, field, value) {
    if (!this._cityForm) return;
    const resources = this._cityForm.draft.resources.with(index, {
      ...this._cityForm.draft.resources[index],
      [field]: value,
    });
    this._setCityField('resources', resources);
  }

  /** @param {number} index */
  _removeResource(index) {
    if (!this._cityForm) return;
    this._setCityField('resources', this._cityForm.draft.resources.toSpliced(index, 1));
  }

  /** Guarda la casa del formulario (alta o edición) en el doc de la isla. */
  async _saveCity() {
    const form = this._cityForm;
    const island = this._island;
    if (!form || !island) return;
    const city = draftToCity(form.draft);
    const others = island.cities.filter((c) => c.id !== form.originalId);
    const check = validateCity(city, { areas: island.areas, cities: others });
    if (check.errors.length > 0) {
      this._cityForm = { ...form, errors: check.errors };
      return;
    }
    const at = island.cities.findIndex((c) => c.id === form.originalId);
    const cities = at >= 0 ? island.cities.with(at, city) : [...island.cities, city];
    const saved = await this._persistCities(cities, `Casa «${city.name}» guardada.`);
    if (saved) this._cityForm = null;
  }

  /** @param {import('../../tools/career/domain/types.js').City} city */
  _askDeleteCity(city) {
    this._confirmCity = city;
  }

  async _confirmDeleteCity() {
    const city = this._confirmCity;
    const island = this._island;
    if (!city || !island) return;
    const cities = island.cities.filter((c) => c.id !== city.id);
    const saved = await this._persistCities(cities, `Casa «${city.name}» eliminada.`);
    if (saved) this._confirmCity = null;
  }

  /**
   * Persiste la lista de casas de la isla seleccionada y mantiene el
   * `citiesTotal` del índice si el nº de casas no deprecadas cambió.
   * @param {import('../../tools/career/domain/types.js').City[]} cities
   * @param {string} successMsg
   * @returns {Promise<boolean>} true si se guardó.
   */
  async _persistCities(cities, successMsg) {
    const island = this._island;
    const arch = this._arch;
    if (!island || !arch) return false;
    const nextMap = { ...island, cities };
    this._saving = true;
    this._error = '';
    try {
      await saveCareerMap(island.id, nextMap);
      this._islands = new Map(this._islands).set(island.id, nextMap);
      await this._syncCitiesTotal(cities);
      this._flash(successMsg);
      return true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar la isla.';
      return false;
    } finally {
      this._saving = false;
    }
  }

  /** Actualiza `citiesTotal` en /careerMap/_archipelago si cambió (MC-20).
   * @param {import('../../tools/career/domain/types.js').City[]} cities */
  async _syncCitiesTotal(cities) {
    const entry = this._archEntry;
    const total = activeCitiesTotal(cities);
    if (!entry || !this._arch || entry.citiesTotal === total) return;
    const islands = this._arch.islands.map((i) => (i.id === entry.id ? { ...i, citiesTotal: total } : i));
    await saveArchipelago({ islands });
    this._arch = { islands };
  }

  // ── Pestaña Rutas: acciones ───────────────────────────────────────────────

  _openAddRoute() {
    const draft = routeDraft(null);
    draft.discipline = this._arch?.islands.at(0)?.discipline ?? '';
    this._routeForm = { originalId: null, draft, errors: [] };
    this._addStop = { islandId: this._arch?.islands.at(0)?.id ?? '', cityId: '', position: '' };
  }

  /** @param {import('../../tools/career/domain/careerRoutes.js').CareerRoute} route */
  _openEditRoute(route) {
    this._routeForm = { originalId: route.routeId, draft: routeDraft(route), errors: [] };
    this._addStop = { islandId: this._arch?.islands.at(0)?.id ?? '', cityId: '', position: '' };
  }

  /** Cambia un campo simple del borrador de ruta. @param {string} field @param {unknown} value */
  _setRouteField(field, value) {
    if (!this._routeForm) return;
    this._routeForm = { ...this._routeForm, draft: { ...this._routeForm.draft, [field]: value } };
  }

  /** Mueve la parada `index` una posición (delta ±1). @param {number} index @param {number} delta */
  _moveStop(index, delta) {
    const stops = this._routeForm?.draft.stops ?? [];
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    const next = stops.with(index, stops[target]).with(target, stops[index]);
    this._setRouteField('stops', next);
  }

  /** @param {number} index */
  _removeStop(index) {
    const stops = this._routeForm?.draft.stops ?? [];
    this._setRouteField('stops', stops.toSpliced(index, 1));
  }

  /** Añade la casa del selector isla→casa en la posición pedida (1-based;
   * vacía = al final). Reutiliza insertRouteAt (JG-9): mueve sin duplicar. */
  _insertStop() {
    const { cityId, position } = this._addStop;
    if (!cityId || !this._routeForm) return;
    const raw = position.trim();
    const index = raw === '' ? undefined : Number(raw) - 1;
    if (index !== undefined && !Number.isInteger(index)) return;
    this._setRouteField('stops', insertRouteAt(this._routeForm.draft.stops, cityId, index));
    this._addStop = { ...this._addStop, cityId: '', position: '' };
  }

  /** Guarda la ruta del formulario (alta o edición) en /careerRoutes. */
  async _saveRoute() {
    const form = this._routeForm;
    if (!form || !this._islands) return;
    const draft = form.draft;
    const routeId = form.originalId ?? routeDocId(draft.discipline, draft.levelKey);
    const route = {
      routeId,
      discipline: draft.discipline,
      levelKey: /** @type {any} */ (draft.levelKey),
      name: draft.name.trim(),
      description: draft.description.trim(),
      stops: [...draft.stops],
      active: draft.active,
    };
    const check = validateRoute(route, [...this._islands.values()]);
    const errors = [...check.errors];
    if (form.originalId === null && this._routes?.some((r) => r.routeId === routeId)) {
      errors.push(`Ya existe la ruta "${routeId}" para ese rol e hito: edítala en su lugar.`);
    }
    if (errors.length > 0) {
      this._routeForm = { ...form, errors };
      return;
    }
    this._saving = true;
    this._error = '';
    try {
      await saveCareerRoute(route);
      const rest = (this._routes ?? []).filter((r) => r.routeId !== routeId);
      this._routes = [...rest, route];
      this._routeForm = null;
      this._flash(`Ruta «${route.name}» guardada.`);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar la ruta.';
    } finally {
      this._saving = false;
    }
  }

  async _confirmDeleteRoute() {
    const route = this._confirmRoute;
    if (!route) return;
    this._saving = true;
    this._error = '';
    try {
      await deleteCareerRoute(route.routeId);
      this._routes = (this._routes ?? []).filter((r) => r.routeId !== route.routeId);
      this._confirmRoute = null;
      this._flash(`Ruta «${route.name}» borrada.`);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar la ruta.';
    } finally {
      this._saving = false;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render() {
    if (!this.ready) return html`<p class="empty">Comprobando permisos…</p>`;
    if (!this._arch || !this._islands || !this._routes) {
      const pending = this._error === '';
      return html`
        ${pending ? html`<p class="empty">Cargando el contenido del juego…</p>` : null}
        ${this._error ? html`<p class="error">${this._error}</p>` : null}
      `;
    }
    const islandsClass = this._tab === 'islands' ? 'tab active' : 'tab';
    const routesClass = this._tab === 'routes' ? 'tab active' : 'tab';
    return html`
      <div class="bar">
        <h1>🎮 Editor del juego</h1>
        <a href="/admin">← Volver a gestión</a>
      </div>
      <nav class="tabs" aria-label="Secciones del editor">
        <button class=${islandsClass} @click=${() => { this._tab = 'islands'; }}>🏝️ Islas</button>
        <button class=${routesClass} @click=${() => { this._tab = 'routes'; }}>🗺️ Rutas</button>
      </nav>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._notice ? html`<p class="notice" role="status">${this._notice}</p>` : null}
      ${this._tab === 'islands' ? this._renderIslandsTab() : this._renderRoutesTab()}
      ${this._renderDeleteCityModal()}
      ${this._renderDeleteRouteModal()}
    `;
  }

  // ── Render: pestaña Islas ────────────────────────────────────────────────

  _renderIslandsTab() {
    const island = this._island;
    return html`
      <section>
        <h2>Casas por isla</h2>
        <div class="toolbar">
          <label for="island">Isla</label>
          <select
            id="island"
            .value=${this._islandId}
            @change=${(e) => { this._islandId = e.target.value; this._cityForm = null; }}
          >
            ${this._arch.islands.map((i) => {
              const label = `${i.name} — ${i.discipline ?? i.id}`;
              return html`<option value=${i.id} ?selected=${i.id === this._islandId}>${label}</option>`;
            })}
          </select>
          <button class="primary" ?disabled=${!island || this._saving} @click=${this._openAddCity}>
            Añadir casa
          </button>
        </div>
        ${this._renderCityTable(island)}
      </section>
      ${this._cityForm ? this._renderCityForm(island) : null}
    `;
  }

  /** @param {import('../../tools/career/domain/types.js').CareerMap|null} island */
  _renderCityTable(island) {
    if (!island) return html`<p class="empty">Selecciona una isla.</p>`;
    if (island.cities.length === 0) {
      return html`<p class="empty">La isla no tiene casas todavía: añade la primera.</p>`;
    }
    const areaName = new Map(island.areas.map((a) => [a.id, a.name]));
    return html`
      <table>
        <thead>
          <tr><th>Casa</th><th>Comarca</th><th>Tipo</th><th>Peso</th><th>Prereqs</th><th></th></tr>
        </thead>
        <tbody>
          ${island.cities.map((city) => this._renderCityRow(city, areaName))}
        </tbody>
      </table>
    `;
  }

  /** @param {import('../../tools/career/domain/types.js').City} city @param {Map<string,string>} areaName */
  _renderCityRow(city, areaName) {
    return html`
      <tr>
        <td>
          ${city.name}
          ${city.deprecated ? html` <span class="badge dep">deprecada</span>` : null}
          <div class="muted">${city.id}</div>
        </td>
        <td>${areaName.get(city.area) ?? city.area}</td>
        <td>${KIND_LABEL[city.kind] ?? city.kind}</td>
        <td>${city.weight}</td>
        <td>${city.prereqs.length}</td>
        <td>
          <button class="mini" ?disabled=${this._saving} @click=${() => this._openEditCity(city)}>Editar</button>
          <button class="mini danger" ?disabled=${this._saving} @click=${() => this._askDeleteCity(city)}>Quitar</button>
        </td>
      </tr>
    `;
  }

  /** @param {import('../../tools/career/domain/types.js').CareerMap|null} island */
  _renderCityForm(island) {
    if (!island || !this._cityForm) return null;
    const { originalId, draft, errors } = this._cityForm;
    const idLocked = originalId !== null;
    const heading = originalId === null ? 'Añadir casa' : `Editar «${originalId}»`;
    const others = island.cities.filter((c) => c.id !== originalId);
    return html`
      <section>
        <h2>${heading}</h2>
        <div class="grid">
          <div class="field">
            <label for="c-name">Nombre</label>
            <input id="c-name" type="text" .value=${draft.name} @input=${(e) => this._onCityName(e.target.value)} />
          </div>
          <div class="field">
            <label for="c-id">Id (disciplina/slug)</label>
            <input
              id="c-id" type="text" .value=${draft.id}
              ?disabled=${idLocked}
              title=${idLocked ? 'El id no se cambia: lo referencian prereqs, rutas y journeys.' : ''}
              @input=${(e) => { this._cityIdTouched = true; this._setCityField('id', e.target.value); }}
            />
          </div>
          <div class="field">
            <label for="c-kind">Tipo</label>
            <select id="c-kind" .value=${draft.kind} @change=${(e) => this._setCityField('kind', e.target.value)}>
              ${CITY_KINDS.map((k) => html`<option value=${k} ?selected=${k === draft.kind}>${KIND_LABEL[k]}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="c-area">Comarca</label>
            <select id="c-area" .value=${draft.area} @change=${(e) => this._setCityField('area', e.target.value)}>
              ${island.areas.map((a) => html`<option value=${a.id} ?selected=${a.id === draft.area}>${a.name}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="c-weight">Peso (${CITY_WEIGHT_MIN}-${CITY_WEIGHT_MAX})</label>
            <input id="c-weight" type="number" min=${CITY_WEIGHT_MIN} max=${CITY_WEIGHT_MAX} .value=${draft.weight}
              @input=${(e) => this._setCityField('weight', e.target.value)} />
          </div>
          <div class="field">
            <label for="c-x">Posición x (0-100)</label>
            <input id="c-x" type="number" min="0" max="100" .value=${draft.x} @input=${(e) => this._setCityField('x', e.target.value)} />
          </div>
          <div class="field">
            <label for="c-y">Posición y (0-100)</label>
            <input id="c-y" type="number" min="0" max="100" .value=${draft.y} @input=${(e) => this._setCityField('y', e.target.value)} />
          </div>
          <div class="field">
            <label for="c-dep">Deprecada</label>
            <input id="c-dep" type="checkbox" .checked=${draft.deprecated}
              @change=${(e) => this._setCityField('deprecated', e.target.checked)} />
          </div>
          <div class="field field-wide">
            <label for="c-prereqs">Prerequisitos (casas de esta isla; Ctrl/Cmd para varios)</label>
            <select id="c-prereqs" class="prereqs" multiple @change=${(e) => this._onPrereqsChange(e.target)}>
              ${others.map((c) => html`<option value=${c.id} ?selected=${draft.prereqs.includes(c.id)}>${c.name}</option>`)}
            </select>
          </div>
          <div class="field field-wide">
            <label for="c-keypoints">Puntos fundamentales (uno por línea)</label>
            <textarea id="c-keypoints" .value=${draft.keyPoints} @input=${(e) => this._setCityField('keyPoints', e.target.value)}></textarea>
          </div>
          <div class="field field-wide">
            <label for="c-aifocus">Lente era-IA (aiFocus)</label>
            <textarea id="c-aifocus" .value=${draft.aiFocus} @input=${(e) => this._setCityField('aiFocus', e.target.value)}></textarea>
          </div>
        </div>
        <h3>Recursos</h3>
        ${this._renderResourceRows(draft.resources)}
        <button class="mini" @click=${this._addResource}>+ Añadir recurso</button>
        ${this._renderErrorList(errors)}
        <div class="form-actions">
          <button class="primary" ?disabled=${this._saving} @click=${this._saveCity}>
            ${this._saving ? 'Guardando…' : 'Guardar casa'}
          </button>
          <button ?disabled=${this._saving} @click=${() => { this._cityForm = null; }}>Cancelar</button>
        </div>
      </section>
    `;
  }

  /** @param {Array<{kind: string, label: string, url?: string}>} resources */
  /** Lista de errores de validación de un formulario (vacía → nada). */
  _renderErrorList(errors) {
    if (errors.length === 0) return null;
    const items = errors.map((e) => html`<li class="error">${e}</li>`);
    return html`<ul class="plain">${items}</ul>`;
  }

  _renderResourceRows(resources) {
    if (resources.length === 0) return html`<p class="empty">Sin recursos: añade el primero.</p>`;
    return html`
      ${resources.map(
        (res, i) => html`
          <div class="res-row">
            <input type="text" placeholder="Título" aria-label="Título del recurso" .value=${res.label}
              @input=${(e) => this._setResource(i, 'label', e.target.value)} />
            <input type="url" placeholder="https://…" aria-label="URL del recurso" .value=${res.url ?? ''}
              @input=${(e) => this._setResource(i, 'url', e.target.value)} />
            <select aria-label="Tipo del recurso" .value=${res.kind} @change=${(e) => this._setResource(i, 'kind', e.target.value)}>
              ${RESOURCE_KINDS.map((k) => html`<option value=${k} ?selected=${k === res.kind}>${k}</option>`)}
            </select>
            <button class="mini danger" @click=${() => this._removeResource(i)}>Quitar</button>
          </div>
        `,
      )}
    `;
  }

  _renderDeleteCityModal() {
    const city = this._confirmCity;
    if (!city) return null;
    const affected = routesAffectedByCity(city.id, this._routes ?? []);
    const heading = `Quitar «${city.name}»`;
    return html`
      <app-modal .open=${true} heading=${heading} @close=${() => { this._confirmCity = null; }}>
        <p>Se eliminará la casa <strong>${city.id}</strong> de la isla.</p>
        ${affected.length > 0
          ? html`
              <p class="warn">Estas rutas del catálogo pasan por la casa y se quedarán con una parada inexistente hasta que las edites:</p>
              <ul>${affected.map((r) => html`<li>${r.name}</li>`)}</ul>
            `
          : html`<p class="muted">Ninguna ruta del catálogo pasa por esta casa.</p>`}
        <p class="warn">Los journeys que ya la tenían visitada conservarán su certificado huérfano (no se toca el progreso de nadie).</p>
        <div class="modal-actions">
          <button ?disabled=${this._saving} @click=${() => { this._confirmCity = null; }}>Cancelar</button>
          <button class="danger" ?disabled=${this._saving} @click=${this._confirmDeleteCity}>
            ${this._saving ? 'Quitando…' : 'Quitar casa'}
          </button>
        </div>
      </app-modal>
    `;
  }

  // ── Render: pestaña Rutas ────────────────────────────────────────────────

  _renderRoutesTab() {
    return html`
      <section>
        <h2>Rutas de rol y nivel</h2>
        <div class="toolbar">
          <button class="primary" ?disabled=${this._saving} @click=${this._openAddRoute}>Nueva ruta</button>
        </div>
        ${this._renderRouteGroups()}
      </section>
      ${this._routeForm ? this._renderRouteForm() : null}
    `;
  }

  _renderRouteGroups() {
    const routes = this._routes ?? [];
    if (routes.length === 0) return html`<p class="empty">Aún no hay rutas: crea la primera.</p>`;
    /** @type {Map<string, typeof routes>} */
    const byRole = new Map();
    for (const route of routes) {
      const list = byRole.get(route.discipline) ?? [];
      byRole.set(route.discipline, [...list, route]);
    }
    const tierOrder = (r) => ROUTE_TIER_KEYS.indexOf(r.levelKey);
    const groups = [...byRole.entries()].toSorted((a, b) => a[0].localeCompare(b[0], 'es'));
    return html`
      ${groups.map(([discipline, list]) => {
        const roleName = this._arch.islands.find((i) => i.discipline === discipline)?.name ?? discipline;
        const ordered = list.toSorted((a, b) => tierOrder(a) - tierOrder(b));
        return html`
          <div class="route-group">
            <h3>${roleName}</h3>
            <table>
              <thead><tr><th>Ruta</th><th>Hito</th><th>Paradas</th><th>Estado</th><th></th></tr></thead>
              <tbody>${ordered.map((route) => this._renderRouteRow(route))}</tbody>
            </table>
          </div>
        `;
      })}
    `;
  }

  /** @param {import('../../tools/career/domain/careerRoutes.js').CareerRoute} route */
  _renderRouteRow(route) {
    return html`
      <tr>
        <td>${route.name}<div class="muted">${route.routeId}</div></td>
        <td>${TIER_LABEL[route.levelKey] ?? route.levelKey}</td>
        <td>${route.stops.length}</td>
        <td>${route.active ? 'Activa' : html`<span class="badge off">Retirada</span>`}</td>
        <td>
          <button class="mini" ?disabled=${this._saving} @click=${() => this._openEditRoute(route)}>Editar</button>
          <button class="mini danger" ?disabled=${this._saving} @click=${() => { this._confirmRoute = route; }}>Borrar</button>
        </td>
      </tr>
    `;
  }

  _renderRouteForm() {
    const { originalId, draft, errors } = this._routeForm;
    const heading = originalId === null ? 'Nueva ruta' : `Editar «${originalId}»`;
    const islands = [...(this._islands?.values() ?? [])];
    // Solo interesan los AVISOS en vivo (orden vs prereqs); los errores se
    // calculan y muestran al pulsar Guardar.
    const { warnings } = validateRoute({ ...draft }, islands);
    return html`
      <section>
        <h2>${heading}</h2>
        <div class="grid">
          <div class="field">
            <label for="r-discipline">Rol (disciplina)</label>
            <select id="r-discipline" .value=${draft.discipline} ?disabled=${originalId !== null}
              @change=${(e) => this._setRouteField('discipline', e.target.value)}>
              ${this._arch.islands.map((i) => {
                const d = i.discipline ?? i.id;
                return html`<option value=${d} ?selected=${d === draft.discipline}>${i.name}</option>`;
              })}
            </select>
          </div>
          <div class="field">
            <label for="r-tier">Hito</label>
            <select id="r-tier" .value=${draft.levelKey} ?disabled=${originalId !== null}
              @change=${(e) => this._setRouteField('levelKey', e.target.value)}>
              ${ROUTE_TIER_KEYS.map((k) => html`<option value=${k} ?selected=${k === draft.levelKey}>${TIER_LABEL[k]}</option>`)}
            </select>
          </div>
          <div class="field">
            <label for="r-name">Nombre</label>
            <input id="r-name" type="text" placeholder="Backend PHP · Peritus" .value=${draft.name}
              @input=${(e) => this._setRouteField('name', e.target.value)} />
          </div>
          <div class="field">
            <label for="r-active">Activa (visible en el selector)</label>
            <input id="r-active" type="checkbox" .checked=${draft.active}
              @change=${(e) => this._setRouteField('active', e.target.checked)} />
          </div>
          <div class="field field-wide">
            <label for="r-desc">Descripción</label>
            <textarea id="r-desc" .value=${draft.description} @input=${(e) => this._setRouteField('description', e.target.value)}></textarea>
          </div>
        </div>
        <h3>Paradas en orden de visita (${draft.stops.length})</h3>
        ${warnings.map((w) => html`<p class="warn">⚠ ${w}</p>`)}
        ${this._renderStopsList(draft.stops)}
        ${this._renderAddStop()}
        ${this._renderErrorList(errors)}
        <div class="form-actions">
          <button class="primary" ?disabled=${this._saving} @click=${this._saveRoute}>
            ${this._saving ? 'Guardando…' : 'Guardar ruta'}
          </button>
          <button ?disabled=${this._saving} @click=${() => { this._routeForm = null; }}>Cancelar</button>
        </div>
      </section>
    `;
  }

  /** @param {string[]} stops */
  _renderStopsList(stops) {
    if (stops.length === 0) return html`<p class="empty">Sin paradas: añádelas con el selector de abajo.</p>`;
    const index = buildCityIndex([...(this._islands?.values() ?? [])]);
    const islandName = new Map(this._arch.islands.map((i) => [i.id, i.name]));
    return html`
      <ol class="stops">
        ${stops.map((stop, i) => {
          const entry = index.get(stop);
          const where = entry ? (islandName.get(entry.islandId) ?? entry.islandId) : 'no existe';
          const detail = `— ${where} · ${stop}`;
          const upLabel = `Subir la parada ${stop}`;
          const downLabel = `Bajar la parada ${stop}`;
          const removeLabel = `Quitar la parada ${stop}`;
          return html`
            <li>
              <span class="n">${i + 1}</span>
              <span class="what">
                ${entry ? entry.city.name : html`<span class="error">${stop}</span>`}
                <span class="muted isl">${detail}</span>
              </span>
              <button class="mini" title="Subir" aria-label=${upLabel}
                ?disabled=${i === 0 || this._saving} @click=${() => this._moveStop(i, -1)}>↑</button>
              <button class="mini" title="Bajar" aria-label=${downLabel}
                ?disabled=${i === stops.length - 1 || this._saving} @click=${() => this._moveStop(i, 1)}>↓</button>
              <button class="mini danger" title="Quitar" aria-label=${removeLabel}
                ?disabled=${this._saving} @click=${() => this._removeStop(i)}>✕</button>
            </li>
          `;
        })}
      </ol>
    `;
  }

  _renderAddStop() {
    const { islandId, cityId, position } = this._addStop;
    const cities = this._islands?.get(islandId)?.cities ?? [];
    return html`
      <div class="add-stop">
        <div class="field">
          <label for="s-island">Isla</label>
          <select id="s-island" .value=${islandId}
            @change=${(e) => { this._addStop = { ...this._addStop, islandId: e.target.value, cityId: '' }; }}>
            ${this._arch.islands.map((i) => html`<option value=${i.id} ?selected=${i.id === islandId}>${i.name}</option>`)}
          </select>
        </div>
        <div class="field">
          <label for="s-city">Casa</label>
          <select id="s-city" .value=${cityId}
            @change=${(e) => { this._addStop = { ...this._addStop, cityId: e.target.value }; }}>
            <option value="" ?selected=${cityId === ''}>— elige una casa —</option>
            ${cities.map((c) => html`<option value=${c.id} ?selected=${c.id === cityId}>${c.name}</option>`)}
          </select>
        </div>
        <div class="field">
          <label for="s-pos">Posición (vacío = al final)</label>
          <input id="s-pos" class="pos" type="number" min="1" .value=${position}
            @input=${(e) => { this._addStop = { ...this._addStop, position: e.target.value }; }} />
        </div>
        <button ?disabled=${!cityId || this._saving} @click=${this._insertStop}>Añadir parada</button>
      </div>
    `;
  }

  _renderDeleteRouteModal() {
    const route = this._confirmRoute;
    if (!route) return null;
    const heading = `Borrar «${route.name}»`;
    return html`
      <app-modal .open=${true} heading=${heading} @close=${() => { this._confirmRoute = null; }}>
        <p>Se borrará la ruta <strong>${route.routeId}</strong> del catálogo (${route.stops.length} paradas).</p>
        <p class="warn">Quien tenga un reto activo sobre esta ruta lo conserva en su journey; simplemente dejará de ofrecerse a nuevos jugadores. Para retirarla sin borrarla, desmarca «Activa».</p>
        <div class="modal-actions">
          <button ?disabled=${this._saving} @click=${() => { this._confirmRoute = null; }}>Cancelar</button>
          <button class="danger" ?disabled=${this._saving} @click=${this._confirmDeleteRoute}>
            ${this._saving ? 'Borrando…' : 'Borrar ruta'}
          </button>
        </div>
      </app-modal>
    `;
  }
}

if (!customElements.get('game-editor')) {
  customElements.define('game-editor', GameEditor);
}
