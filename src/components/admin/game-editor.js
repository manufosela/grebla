/**
 * <game-editor>
 * Editor del juego para el SUPERADMIN (JG-16): el contenido del Mapa de
 * Carrera deja de cambiarse solo por seeds. Dos pestañas:
 *
 *  - 🏝️ Islas: casas de cada isla del archipiélago (alta, edición y borrado
 *    con todos los campos MC-15 más el resumen didáctico JG-18: prereqs,
 *    summary, keyPoints, aiFocus, recursos — las etiquetas del formulario
 *    calcan las secciones de la tarjeta de casa). Al
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
import { LitElement, html, css, svg } from 'lit';
import '../app-modal.js';
import {
  getArchipelago,
  getCareerMap,
  saveCareerMap,
  deleteCareerMap,
  saveArchipelago,
  listAllCareerRoutes,
  saveCareerRoute,
  deleteCareerRoute,
} from '../../lib/careerMap.js';
import { START_ISLAND_ID } from '../../tools/career/data/archipelago.js';
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
import {
  ROUTE_TIER_KEYS,
  routeDocId,
  groupStopsByIsland,
  contiguousStops,
  appendStopToIsland,
} from '../../tools/career/domain/careerRoutes.js';
import { shapeForArea, houseShapePath, HOUSE_SHAPE_LABEL } from '../../tools/career/domain/houseShapes.js';

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

/** Coordenada de isla en el mar: entero 0..100 (por defecto 50). */
function clampCoord(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
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
      summary: '',
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
    summary: city.summary ?? '',
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
  // Como aiFocus: el resumen vacío se OMITE (no se guarda un '' que la
  // tarjeta tendría que distinguir del «sin resumen»).
  const summary = draft.summary.trim();
  if (summary) city.summary = summary;
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
    embedded: { attribute: false },
    _tab: { state: true },
    _arch: { state: true },
    _islands: { state: true },
    _routes: { state: true },
    _islandId: { state: true },
    _areaTab: { state: true },
    _islandDraft: { state: true },
    _confirmIsland: { state: true },
    _comarcaEdit: { state: true },
    _cityForm: { state: true },
    _cityFormTab: { state: true },
    _confirmCity: { state: true },
    _routeForm: { state: true },
    _routeFormTab: { state: true },
    _confirmRoute: { state: true },
    _addStop: { state: true },
    _saving: { state: true },
    _error: { state: true },
    _notice: { state: true },
  };

  static styles = css`
    :host {
      display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827);
      /* Fondo sutil de los campos (RMR-TSK-0267): los diferencia de la tarjeta
         sin rechinar; derivado del tema → vale en claro y oscuro. */
      --rm-field: color-mix(in srgb, var(--rm-text, #111827) 5%, var(--rm-surface, #fff));
    }
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

    /* ── Archipiélago → islas (tabs) → comarcas (sub-tabs) → casas (RMR-TSK-0257) ── */
    .arch-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }
    .arch-head h2 { margin: 0; }
    .add-island { border: 1px solid var(--rm-accent, #3b82f6); background: var(--rm-accent, #3b82f6); color: var(--rm-on-accent, #fff); border-radius: 999px; padding: 0.4rem 0.95rem; font: inherit; font-weight: 700; cursor: pointer; }
    .add-island:hover:not(:disabled) { filter: brightness(1.08); }
    .add-island:disabled { opacity: 0.5; cursor: default; }
    .island-tabs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; padding-bottom: 0.8rem; border-bottom: 2px solid var(--rm-border, #e5e7eb); }
    .itab { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-track, #f3f4f6); color: var(--rm-text, #374151); border-radius: 8px; padding: 0.4rem 0.8rem; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .itab:hover { border-color: var(--rm-accent, #3b82f6); }
    .itab.active { background: var(--rm-brand, #1e3a5f); border-color: var(--rm-brand, #1e3a5f); color: #fff; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); }
    .island-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
    .island-title-wrap { display: inline-flex; align-items: center; gap: 0.4rem; }
    .island-title { margin: 0; font-size: 1.2rem; color: var(--rm-brand, #1e3a5f); }
    .area-tabs { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-bottom: 1rem; }
    .atab { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280); border-radius: 999px; padding: 0.3rem 0.8rem; font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
    .atab:hover { color: var(--rm-text, #111827); border-color: var(--rm-accent, #3b82f6); }
    .atab.active { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: var(--rm-on-accent, #fff); }
    .atab .cnt { font-variant-numeric: tabular-nums; opacity: 0.75; margin-left: 0.2rem; }
    .shape-glyph { vertical-align: -1px; fill: currentColor; opacity: 0.85; }
    .island-xy { display: flex; gap: 0.8rem; }
    .island-xy label { flex: 1; }
    .comarca-actions, .comarca-edit { display: inline-flex; align-items: center; gap: 0.3rem; margin-left: 0.4rem; }
    .comarca-edit input { padding: 0.28rem 0.5rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 6px; font: inherit; font-size: 0.82rem; }
    .house-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.75rem; }
    .house-card { border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--rm-muted, #9ca3af); border-radius: 10px; background: var(--rm-surface, #fff); padding: 0.7rem 0.8rem; cursor: pointer; display: flex; flex-direction: column; gap: 0.35rem; transition: box-shadow 0.12s, transform 0.12s, border-color 0.12s; }
    .house-card:hover { box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12); transform: translateY(-2px); border-color: var(--rm-accent, #3b82f6); }
    .house-card:focus-visible { outline: 2px solid var(--rm-accent, #3b82f6); outline-offset: 2px; }
    .house-card.tech { border-left-color: #3b82f6; }
    .house-card.skill { border-left-color: #16a34a; }
    .house-card.milestone { border-left-color: #d97706; }
    .hc-top { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
    .hc-name { font-weight: 700; font-size: 0.95rem; color: var(--rm-text, #111827); }
    .hc-kind { flex: none; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; border-radius: 999px; padding: 0.08rem 0.5rem; color: #fff; }
    .hc-kind.tech { background: #3b82f6; }
    .hc-kind.skill { background: #16a34a; }
    .hc-kind.milestone { background: #d97706; }
    .hc-id { font-size: 0.72rem; color: var(--rm-muted, #6b7280); font-family: ui-monospace, SFMono-Regular, monospace; word-break: break-all; }
    .hc-meta { display: flex; align-items: center; gap: 0.7rem; font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin-top: auto; }
    .hc-meta .mini { margin-left: auto; }
    .island-form { display: grid; gap: 0.8rem; }
    .island-form label { display: grid; gap: 0.25rem; font-size: 0.85rem; font-weight: 600; color: var(--rm-text, #111827); }
    .island-form input { padding: 0.5rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; font: inherit; }
    .island-form small { font-weight: 400; }
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
      background: var(--rm-field, #eef2f6);
      color: var(--rm-text, #111827);
      font-size: 0.88rem;
      font-family: inherit;
      box-sizing: border-box;
    }
    select:focus, input:focus, textarea:focus { background: var(--rm-surface, #fff); outline: 2px solid var(--rm-accent, #3b82f6); outline-offset: 1px; border-color: var(--rm-accent, #3b82f6); }
    select:disabled, input:disabled, textarea:disabled { background: var(--rm-track, #f3f4f6); color: var(--rm-muted, #6b7280); cursor: not-allowed; }
    textarea { width: 100%; min-height: 4.5rem; resize: vertical; }
    /* Las opciones del multiselect no heredan el fondo del select en Chrome:
       sin esto quedan blancas en tema oscuro. El gradiente en :checked es el
       truco necesario para que Chrome respete el resaltado de seleccionadas. */
    option { background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); }
    option:checked {
      background: linear-gradient(var(--rm-accent, #3b82f6), var(--rm-accent, #3b82f6));
      color: var(--rm-on-accent, #fff);
      font-weight: 700;
    }
    label { font-size: 0.8rem; font-weight: 600; color: var(--rm-muted, #6b7280); display: block; margin-bottom: 0.25rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.75rem 1rem; margin-bottom: 0.75rem; }
    .field-wide { grid-column: 1 / -1; }
    .field input, .field select { width: 100%; }
    .field.check { display: flex; align-items: center; gap: 0.5rem; }
    .field.check label { margin-bottom: 0; }
    .field.check input[type='checkbox'] { width: auto; }
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
    .add-stop { display: flex; gap: 0.5rem; align-items: end; flex-wrap: wrap; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--rm-border, #e5e7eb); }
    .add-stop .field { min-width: 10rem; }
    /* ── Editor de ruta rediseñado (RMR-TSK-0265): pestañas + datos aireados ── */
    .rtabs { display: flex; gap: 1.1rem; margin: 0 0 1.1rem; border-bottom: 1px solid var(--rm-border, #e5e7eb); flex-wrap: wrap; }
    .rtab { border: 0; background: none; color: var(--rm-muted, #6b7280); font: inherit; font-size: 0.92rem; font-weight: 700; padding: 0.45rem 0.1rem; margin-bottom: -1px; border-bottom: 2px solid transparent; cursor: pointer; }
    .rtab.on { color: var(--rm-accent, #3b82f6); border-bottom-color: var(--rm-accent, #3b82f6); }
    .rtab:hover:not(.on) { color: var(--rm-text, #111827); }
    .rdatos { display: flex; flex-direction: column; gap: 0.5rem; }
    .rrow { display: flex; gap: 1.25rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
    .rcell { display: flex; flex-direction: column; gap: 0.3rem; min-width: 12rem; flex: 1; }
    .rlabel { font-size: 0.78rem; font-weight: 700; color: var(--rm-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 0.5rem; }
    .robadge { align-self: flex-start; background: var(--rm-track, #eef2f4); border: 1px solid var(--rm-border, #d1d5db); border-radius: 999px; padding: 0.3rem 0.85rem; font-weight: 700; font-size: 0.9rem; }
    .rhint { font-size: 0.78rem; color: var(--rm-muted, #6b7280); margin: 0.1rem 0 0; }
    .rhint code { background: var(--rm-track, #eef2f4); padding: 0.05rem 0.35rem; border-radius: 5px; font-size: 0.9em; }
    .rdatos input[type='text'], .rdatos textarea { width: 100%; box-sizing: border-box; }
    .rdatos textarea { min-height: 5rem; resize: vertical; }
    .rcheck { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; font-size: 0.9rem; }
    .rcheck input { width: auto; }
    /* Paradas agrupadas por isla */
    .rparadas { display: flex; flex-direction: column; }
    .stopgroups { display: flex; flex-direction: column; gap: 0.9rem; margin-top: 0.25rem; }
    .stopgroup { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; overflow: hidden; }
    .sghead { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.7rem; background: var(--rm-track, #f3f6f7); border-bottom: 1px solid var(--rm-border, #e5e7eb); }
    .sgbadge { font-weight: 800; font-size: 0.9rem; color: var(--rm-navy, #1e3a5f); }
    .sgcount { font-size: 0.76rem; color: var(--rm-muted, #6b7280); }
    .sgmove { margin-left: auto; display: flex; gap: 0.25rem; }
    .stopgroup .stops { margin: 0; padding: 0.25rem 0.5rem; }
    .stopgroup .stops li:last-child { border-bottom: 0; }
  `;

  constructor() {
    super();
    this.ready = false;
    this.embedded = false; // true cuando vive dentro del panel (oculta su cabecera)
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
    /** Comarca (área) activa dentro de la isla (RMR-TSK-0257). */
    this._areaTab = '';
    /** Borrador del popup de isla (alta o edición), o null si está cerrado. */
    this._islandDraft = null;
    /** Isla pendiente de confirmar borrado, o null. */
    this._confirmIsland = null;
    /** Edición inline de comarca: { areaId|null (null = nueva), name } o null. */
    this._comarcaEdit = null;
    /** @type {{ originalId: string|null, draft: ReturnType<typeof cityDraft>, errors: string[] }|null} */
    this._cityForm = null;
    /** @type {'datos'|'contenido'} pestaña activa del editor de casa (RMR-TSK-0267) */
    this._cityFormTab = 'datos';
    /** @type {import('../../tools/career/domain/types.js').City|null} casa pendiente de confirmar borrado */
    this._confirmCity = null;
    /** @type {{ originalId: string|null, draft: ReturnType<typeof routeDraft>, errors: string[] }|null} */
    this._routeForm = null;
    /** @type {'datos'|'paradas'} pestaña activa del editor de ruta (RMR-TSK-0265) */
    this._routeFormTab = 'datos';
    /** @type {import('../../tools/career/domain/careerRoutes.js').CareerRoute|null} ruta pendiente de confirmar borrado */
    this._confirmRoute = null;
    /** Selector de parada nueva del formulario de ruta. */
    this._addStop = { islandId: '', cityId: '' };
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
    // Preselecciona la comarca activa (RMR-TSK-0257), o la primera de la isla.
    draft.area = this._activeArea(this._island) || (this._island?.areas.at(0)?.id ?? '');
    this._cityIdTouched = false;
    this._cityFormTab = 'datos';
    this._cityForm = { originalId: null, draft, errors: [] };
  }

  /** @param {import('../../tools/career/domain/types.js').City} city */
  _openEditCity(city) {
    this._cityIdTouched = true;
    this._cityFormTab = 'datos';
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

  // ── Islas, comarcas y navegación (RMR-TSK-0257) ──────────────────────────

  /** Etiqueta corta de una isla para las pestañas (shortName o nombre sin «Isla »). */
  _islandShort(entry) {
    return (entry?.shortName ?? '').trim() || String(entry?.name ?? entry?.id ?? '').replace(/^Isla\s+/i, '');
  }

  /** Comarca activa de la isla (la seleccionada si existe, o la primera). */
  _activeArea(island) {
    const areas = island?.areas ?? [];
    if (this._areaTab && areas.some((a) => a.id === this._areaTab)) return this._areaTab;
    return areas.at(0)?.id ?? '';
  }

  _selectIsland(id) {
    this._islandId = id;
    this._areaTab = '';
    this._cityForm = null;
    this._comarcaEdit = null;
    this._error = '';
  }

  /** Guarda el mapa de la isla con nuevas comarcas (areas). */
  async _persistAreas(areas, successMsg) {
    const island = this._island;
    if (!island) return false;
    const nextMap = { ...island, areas };
    this._saving = true;
    this._error = '';
    try {
      await saveCareerMap(island.id, nextMap);
      this._islands = new Map(this._islands).set(island.id, nextMap);
      this._flash(successMsg);
      return true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron guardar las comarcas.';
      return false;
    } finally {
      this._saving = false;
    }
  }

  _startAddComarca() { this._comarcaEdit = { areaId: null, name: '' }; this._error = ''; }
  _startRenameComarca(area) { this._comarcaEdit = { areaId: area.id, name: area.name }; this._error = ''; }
  _cancelComarca() { this._comarcaEdit = null; }
  _setComarcaName(name) { this._comarcaEdit = { ...this._comarcaEdit, name }; }

  async _saveComarca() {
    const edit = this._comarcaEdit;
    const island = this._island;
    if (!edit || !island) return;
    const name = edit.name.trim();
    if (!name) { this._error = 'La comarca necesita un nombre.'; return; }
    let areas;
    if (edit.areaId) {
      areas = island.areas.map((a) => (a.id === edit.areaId ? { ...a, name } : a));
    } else {
      const id = slugify(name);
      if (!id) { this._error = 'Nombre de comarca inválido.'; return; }
      if (island.areas.some((a) => a.id === id)) { this._error = `Ya existe una comarca «${id}».`; return; }
      areas = [...island.areas, { id, name }];
    }
    const ok = await this._persistAreas(areas, edit.areaId ? 'Comarca renombrada.' : 'Comarca añadida.');
    if (ok) {
      if (!edit.areaId) this._areaTab = slugify(name);
      this._comarcaEdit = null;
    }
  }

  async _removeComarca(area) {
    const island = this._island;
    if (!island) return;
    const used = island.cities.filter((c) => c.area === area.id).length;
    if (used > 0) {
      this._error = `«${area.name}» tiene ${used} casa(s): muévelas o quítalas antes de borrar la comarca.`;
      return;
    }
    const areas = island.areas.filter((a) => a.id !== area.id);
    const ok = await this._persistAreas(areas, `Comarca «${area.name}» quitada.`);
    if (ok && this._areaTab === area.id) this._areaTab = areas.at(0)?.id ?? '';
  }

  _openAddIsland() { this._islandDraft = { editing: false, id: '', name: '', shortName: '', x: '50', y: '50' }; this._error = ''; }
  _openEditIsland() {
    const island = this._island;
    if (!island) return;
    const entry = this._archEntry;
    this._islandDraft = {
      editing: true, id: island.id, name: island.name, shortName: entry?.shortName ?? '',
      x: String(entry?.x ?? 50), y: String(entry?.y ?? 50),
    };
    this._error = '';
  }
  _closeIslandForm() { this._islandDraft = null; }
  _setIslandDraft(key, value) { this._islandDraft = { ...this._islandDraft, [key]: value }; }
  _saveIslandForm() { return this._islandDraft?.editing ? this._updateIsland() : this._createIsland(); }

  /** Actualiza nombre (doc + índice) y nombre corto (índice) de la isla actual. */
  async _updateIsland() {
    const d = this._islandDraft;
    const island = this._islands?.get(d?.id);
    if (!d || !island) return;
    const name = d.name.trim();
    const shortName = d.shortName.trim();
    if (!name) { this._error = 'La isla necesita nombre.'; return; }
    const x = clampCoord(d.x);
    const y = clampCoord(d.y);
    this._saving = true;
    this._error = '';
    try {
      const nextMap = { ...island, name };
      await saveCareerMap(d.id, nextMap);
      this._islands = new Map(this._islands).set(d.id, nextMap);
      const islands = this._arch.islands.map((i) => {
        if (i.id !== d.id) return i;
        const entry = { ...i, name, x, y };
        if (shortName) { entry.shortName = shortName; } else { delete entry.shortName; }
        return entry;
      });
      await saveArchipelago({ islands });
      this._arch = { islands };
      this._islandDraft = null;
      this._flash(`Isla «${name}» actualizada.`);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo actualizar la isla.';
    } finally {
      this._saving = false;
    }
  }

  _askDeleteIsland() {
    const island = this._island;
    if (!island) return;
    if (island.id === START_ISLAND_ID) { this._error = 'La isla de inicio no se puede borrar.'; return; }
    if (island.cities.length > 0) { this._error = `«${island.name}» tiene ${island.cities.length} casa(s): quítalas antes de borrar la isla.`; return; }
    this._islandDraft = null;
    this._confirmIsland = island;
  }

  async _confirmDeleteIsland() {
    const island = this._confirmIsland;
    if (!island) return;
    this._saving = true;
    this._error = '';
    try {
      const islands = this._arch.islands.filter((i) => i.id !== island.id);
      await saveArchipelago({ islands });
      await deleteCareerMap(island.id);
      this._arch = { islands };
      const next = new Map(this._islands);
      next.delete(island.id);
      this._islands = next;
      this._islandId = islands.at(0)?.id ?? '';
      this._areaTab = '';
      this._confirmIsland = null;
      this._flash(`Isla «${island.name}» borrada.`);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar la isla.';
    } finally {
      this._saving = false;
    }
  }

  async _createIsland() {
    const d = this._islandDraft;
    if (!d) return;
    const name = d.name.trim();
    const id = slugify(d.id.trim() || name);
    const shortName = d.shortName.trim();
    if (!id || !name) { this._error = 'La isla necesita id y nombre.'; return; }
    if (this._arch?.islands.some((i) => i.id === id)) { this._error = `Ya existe una isla con id «${id}».`; return; }
    const map = { id, name, areas: [], cities: [], startPort: { x: 50, y: 92 } };
    this._saving = true;
    this._error = '';
    try {
      await saveCareerMap(id, map);
      const entry = { id, name, discipline: id, x: clampCoord(d.x), y: clampCoord(d.y), citizenshipPct: 60, citiesTotal: 0 };
      if (shortName) entry.shortName = shortName;
      const islands = [...(this._arch?.islands ?? []), entry];
      await saveArchipelago({ islands });
      this._arch = { islands };
      this._islands = new Map(this._islands).set(id, map);
      this._islandId = id;
      this._areaTab = '';
      this._islandDraft = null;
      this._flash(`Isla «${name}» creada. Añádele comarcas y casas.`);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo crear la isla.';
    } finally {
      this._saving = false;
    }
  }

  // ── Pestaña Rutas: acciones ───────────────────────────────────────────────

  _openAddRoute() {
    const draft = routeDraft(null);
    draft.discipline = this._arch?.islands.at(0)?.discipline ?? '';
    this._routeForm = { originalId: null, draft, errors: [] };
    this._routeFormTab = 'datos';
    this._addStop = { islandId: this._arch?.islands.at(0)?.id ?? '', cityId: '' };
  }

  /** @param {import('../../tools/career/domain/careerRoutes.js').CareerRoute} route */
  _openEditRoute(route) {
    const draft = routeDraft(route);
    // Descruza cualquier ruta legada que intercale islas: al abrir queda contigua
    // por isla (RMR-TSK-0265). Sin islas cargadas aún, se deja tal cual.
    draft.stops = contiguousStops(draft.stops, [...(this._islands?.values() ?? [])]);
    this._routeForm = { originalId: route.routeId, draft, errors: [] };
    this._routeFormTab = 'datos';
    this._addStop = { islandId: this._arch?.islands.at(0)?.id ?? '', cityId: '' };
  }

  /** Cambia un campo simple del borrador de ruta. @param {string} field @param {unknown} value */
  _setRouteField(field, value) {
    if (!this._routeForm) return;
    this._routeForm = { ...this._routeForm, draft: { ...this._routeForm.draft, [field]: value } };
  }

  /** Grupos de paradas por isla del borrador actual (RMR-TSK-0265). */
  _stopGroups() {
    const stops = this._routeForm?.draft.stops ?? [];
    return groupStopsByIsland(stops, [...(this._islands?.values() ?? [])]);
  }

  /** Reordena una parada DENTRO de su isla (delta ±1): no se salta a otra isla,
   *  las islas quedan contiguas (RMR-TSK-0265). @param {number} groupIdx @param {number} localIdx @param {number} delta */
  _moveStopInGroup(groupIdx, localIdx, delta) {
    const groups = this._stopGroups();
    const group = groups[groupIdx];
    if (!group) return;
    const target = localIdx + delta;
    if (target < 0 || target >= group.stops.length) return;
    group.stops = group.stops.with(localIdx, group.stops[target]).with(target, group.stops[localIdx]);
    this._setRouteField('stops', groups.flatMap((g) => g.stops));
  }

  /** Mueve un GRUPO de isla entero (delta ±1): cambia el orden en que la ruta
   *  visita las islas, sin romper la contigüidad (RMR-TSK-0265). @param {number} groupIdx @param {number} delta */
  _moveIslandGroup(groupIdx, delta) {
    const groups = this._stopGroups();
    const target = groupIdx + delta;
    if (target < 0 || target >= groups.length) return;
    const next = groups.with(groupIdx, groups[target]).with(target, groups[groupIdx]);
    this._setRouteField('stops', next.flatMap((g) => g.stops));
  }

  /** Quita una parada por su id (RMR-TSK-0265). @param {string} cityId */
  _removeStopById(cityId) {
    const stops = this._routeForm?.draft.stops ?? [];
    this._setRouteField('stops', stops.filter((s) => s !== cityId));
  }

  /** Añade la casa del selector isla→casa al FINAL de las paradas de SU isla
   *  (RMR-TSK-0265): sin posición manual, siempre contiguo por isla. */
  _insertStop() {
    const { cityId } = this._addStop;
    if (!cityId || !this._routeForm) return;
    const next = appendStopToIsland(
      this._routeForm.draft.stops,
      cityId,
      [...(this._islands?.values() ?? [])],
    );
    this._setRouteField('stops', next);
    this._addStop = { ...this._addStop, cityId: '' };
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
      ${this.embedded
        ? null
        : html`<div class="bar">
            <h1>🎮 Editor del juego</h1>
            <a href="/admin">← Volver a gestión</a>
          </div>`}
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
        <div class="arch-head">
          <h2>🗺️ Archipiélago</h2>
          <button class="add-island" ?disabled=${this._saving} @click=${this._openAddIsland} title="Añadir una isla nueva">＋ Isla</button>
        </div>
        <nav class="island-tabs" role="tablist" aria-label="Islas del archipiélago">
          ${this._arch.islands.map((i) => html`
            <button role="tab" aria-selected=${i.id === this._islandId}
              class=${i.id === this._islandId ? 'itab active' : 'itab'}
              @click=${() => this._selectIsland(i.id)}
              title=${i.name}>${this._islandShort(i)}</button>`)}
        </nav>
        ${island ? this._renderIslandBody(island) : html`<p class="empty">Selecciona una isla o crea una nueva con «＋ Isla».</p>`}
      </section>
      ${this._islandDraft ? this._renderIslandFormModal() : null}
      ${this._renderDeleteIslandModal()}
      ${this._cityForm ? this._renderCityForm(island) : null}
    `;
  }

  /** @param {import('../../tools/career/domain/types.js').CareerMap} island */
  _renderIslandBody(island) {
    const areas = island.areas ?? [];
    const activeArea = this._activeArea(island);
    const cities = island.cities.filter((c) => c.area === activeArea);
    return html`
      <div class="island-head">
        <div class="island-title-wrap">
          <h3 class="island-title">${island.name}</h3>
          <button class="mini" title="Editar isla (nombre, nombre corto)" @click=${this._openEditIsland}>✎</button>
          ${island.id === START_ISLAND_ID
            ? null
            : html`<button class="mini danger" title="Borrar isla" ?disabled=${this._saving} @click=${this._askDeleteIsland}>✕</button>`}
        </div>
        <button class="primary" ?disabled=${this._saving || !areas.length} @click=${this._openAddCity} title=${areas.length ? '' : 'Añade una comarca antes de crear casas'}>＋ Añadir casa</button>
      </div>
      <nav class="area-tabs" role="tablist" aria-label="Comarcas de la isla">
        ${areas.map((a) => {
          const n = island.cities.filter((c) => c.area === a.id).length;
          return html`<button role="tab" aria-selected=${a.id === activeArea}
            class=${a.id === activeArea ? 'atab active' : 'atab'}
            @click=${() => { this._areaTab = a.id; }}>${this._renderShapeGlyph(shapeForArea(a.id, areas))} ${a.name} <span class="cnt">${n}</span></button>`;
        })}
        ${this._renderComarcaControls(activeArea, areas)}
      </nav>
      ${this._renderHousesOrEmpty(areas, cities)}
    `;
  }

  /** Casas de la comarca activa como tarjetas, o el estado vacío que toque. */
  _renderHousesOrEmpty(areas, cities) {
    if (areas.length === 0) {
      return html`<p class="empty">Esta isla no tiene comarcas todavía. Crea la primera para poder añadir casas.</p>`;
    }
    if (cities.length === 0) {
      return html`<p class="empty">Esta comarca no tiene casas. Añade la primera con «＋ Añadir casa».</p>`;
    }
    return html`<div class="house-grid">${cities.map((c) => this._renderHouseCard(c))}</div>`;
  }

  /** Glifo de la forma de casa de una comarca (pista visual, RMR-TSK-0259). */
  _renderShapeGlyph(shape) {
    const d = houseShapePath(shape, 10, 10, 7);
    const inner = d ? svg`<path d=${d} />` : svg`<circle cx="10" cy="10" r="7" />`;
    return svg`<svg class="shape-glyph" width="13" height="13" viewBox="0 0 20 20" role="img" aria-label=${HOUSE_SHAPE_LABEL[shape] ?? shape}>${inner}</svg>`;
  }

  /** Controles de comarca: editar en curso, o botones de renombrar/quitar/añadir. */
  _renderComarcaControls(activeArea, areas) {
    if (this._comarcaEdit) {
      return html`<span class="comarca-edit">
        <input type="text" .value=${this._comarcaEdit.name} placeholder="Nombre de la comarca"
          @input=${(e) => this._setComarcaName(e.target.value)}
          @keydown=${(e) => { if (e.key === 'Enter') this._saveComarca(); if (e.key === 'Escape') this._cancelComarca(); }} />
        <button class="mini primary" ?disabled=${this._saving} @click=${this._saveComarca}>Guardar</button>
        <button class="mini" @click=${this._cancelComarca}>Cancelar</button>
      </span>`;
    }
    const current = areas.find((a) => a.id === activeArea);
    return html`<span class="comarca-actions">
      ${current ? html`<button class="mini" title="Renombrar comarca" @click=${() => this._startRenameComarca(current)}>✎</button>
        <button class="mini danger" title="Quitar comarca" @click=${() => this._removeComarca(current)}>✕</button>` : null}
      <button class="mini add" title="Añadir comarca" @click=${this._startAddComarca}>＋ comarca</button>
    </span>`;
  }

  /** @param {import('../../tools/career/domain/types.js').City} city */
  _renderHouseCard(city) {
    return html`
      <div class="house-card ${city.kind}" role="button" tabindex="0"
        @click=${() => this._openEditCity(city)}
        @keydown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._openEditCity(city); } }}>
        <div class="hc-top">
          <span class="hc-name">${city.name}</span>
          <span class="hc-kind ${city.kind}">${KIND_LABEL[city.kind] ?? city.kind}</span>
        </div>
        <div class="hc-id">${city.id}${city.deprecated ? html` · <span class="badge dep">deprecada</span>` : null}</div>
        <div class="hc-meta">
          <span title="Peso">⚖️ ${city.weight}</span>
          <span title="Prerrequisitos">🔗 ${city.prereqs.length}</span>
          <button class="mini danger" ?disabled=${this._saving}
            @click=${(e) => { e.stopPropagation(); this._askDeleteCity(city); }}>Quitar</button>
        </div>
      </div>`;
  }

  /** Popup de isla: alta (RMR-TSK-0257) o edición (RMR-TSK-0258). */
  _renderIslandFormModal() {
    const d = this._islandDraft;
    const editing = d.editing === true;
    let saveLabel = editing ? 'Guardar cambios' : 'Crear isla';
    if (this._saving) saveLabel = 'Guardando…';
    const idHint = editing
      ? 'El id no se cambia: lo referencian casas, rutas y journeys.'
      : 'Id del doc y prefijo de las casas. No se puede cambiar luego.';
    return html`<app-modal .open=${true} heading=${editing ? 'Editar isla' : 'Añadir isla'} @close=${this._closeIslandForm}>
      <div class="island-form">
        <label>Nombre
          <input type="text" .value=${d.name} placeholder="p. ej. Frontend"
            @input=${(e) => this._setIslandDraft('name', e.target.value)} /></label>
        <label>Nombre corto (para la pestaña)
          <input type="text" .value=${d.shortName} placeholder="p. ej. FE"
            @input=${(e) => this._setIslandDraft('shortName', e.target.value)} /></label>
        <label>Id / disciplina
          <input type="text" .value=${d.id} ?disabled=${editing}
            placeholder="se genera del nombre si lo dejas vacío"
            @input=${(e) => this._setIslandDraft('id', e.target.value)} />
          <small class="muted">${idHint}</small></label>
        <div class="island-xy">
          <label>Posición X (mar)
            <input type="number" min="0" max="100" .value=${d.x}
              @input=${(e) => this._setIslandDraft('x', e.target.value)} /></label>
          <label>Posición Y (mar)
            <input type="number" min="0" max="100" .value=${d.y}
              @input=${(e) => this._setIslandDraft('y', e.target.value)} /></label>
        </div>
        <small class="muted">Dónde aparece la isla en el mapa del archipiélago (0–100).</small>
        ${this._error ? html`<p class="error">${this._error}</p>` : null}
      </div>
      <div class="modal-actions">
        <button ?disabled=${this._saving} @click=${this._closeIslandForm}>Cancelar</button>
        <button class="primary" ?disabled=${this._saving} @click=${this._saveIslandForm}>${saveLabel}</button>
      </div>
    </app-modal>`;
  }

  /** Confirmación de borrado de isla (RMR-TSK-0258). */
  _renderDeleteIslandModal() {
    const island = this._confirmIsland;
    if (!island) return null;
    const heading = `Borrar «${island.name}»`;
    return html`<app-modal .open=${true} heading=${heading} @close=${() => { this._confirmIsland = null; }}>
      <p>Se borrará la isla <strong>${island.id}</strong> del archipiélago y su documento.</p>
      <p class="muted">Solo se borran islas sin casas: sus rutas y journeys no se ven afectados.</p>
      <div class="modal-actions">
        <button ?disabled=${this._saving} @click=${() => { this._confirmIsland = null; }}>Cancelar</button>
        <button class="danger" ?disabled=${this._saving} @click=${this._confirmDeleteIsland}>${this._saving ? 'Borrando…' : 'Borrar isla'}</button>
      </div>
    </app-modal>`;
  }

  /** @param {import('../../tools/career/domain/types.js').CareerMap|null} island */
  _renderCityForm(island) {
    if (!island || !this._cityForm) return null;
    const { originalId, draft, errors } = this._cityForm;
    const idLocked = originalId !== null;
    const heading = originalId === null ? 'Añadir casa' : 'Editar casa';
    const others = island.cities.filter((c) => c.id !== originalId);
    // Avisos EN VIVO (no bloquean el guardado): p. ej. resumen didáctico corto.
    const { warnings } = validateCity(draftToCity(draft), { areas: island.areas, cities: others });
    const close = () => { this._cityForm = null; };
    const tab = this._cityFormTab === 'contenido' ? 'contenido' : 'datos';
    return html`
      <app-modal .open=${true} size="wide" heading=${heading} @close=${close}>
        <div class="rtabs" role="tablist" aria-label="Secciones de la casa">
          <button role="tab" aria-selected=${tab === 'datos'} class="rtab ${tab === 'datos' ? 'on' : ''}"
            @click=${() => { this._cityFormTab = 'datos'; }}>Datos</button>
          <button role="tab" aria-selected=${tab === 'contenido'} class="rtab ${tab === 'contenido' ? 'on' : ''}"
            @click=${() => { this._cityFormTab = 'contenido'; }}>Contenido didáctico</button>
        </div>
        <div role="tabpanel" ?hidden=${tab !== 'datos'}>
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
            <div class="field check">
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
          </div>
        </div>
        <div role="tabpanel" ?hidden=${tab !== 'contenido'}>
          <div class="grid">
            <div class="field field-wide">
              <label for="c-summary">¿Qué es? (resumen didáctico)</label>
              <textarea id="c-summary" .value=${draft.summary} @input=${(e) => this._setCityField('summary', e.target.value)}></textarea>
            </div>
            <div class="field field-wide">
              <label for="c-keypoints">Qué aprenderás (uno por línea)</label>
              <textarea id="c-keypoints" .value=${draft.keyPoints} @input=${(e) => this._setCityField('keyPoints', e.target.value)}></textarea>
            </div>
            <div class="field field-wide">
              <label for="c-aifocus">En la era IA</label>
              <textarea id="c-aifocus" .value=${draft.aiFocus} @input=${(e) => this._setCityField('aiFocus', e.target.value)}></textarea>
            </div>
          </div>
          <h3>Recursos para el viaje</h3>
          ${this._renderResourceRows(draft.resources)}
          <button class="mini" @click=${this._addResource}>+ Añadir recurso</button>
        </div>
        ${this._renderErrorList(errors)}
        ${warnings.map((w) => html`<p class="warn">⚠ ${w}</p>`)}
        <div class="modal-actions">
          <button ?disabled=${this._saving} @click=${close}>Cancelar</button>
          <button class="primary" ?disabled=${this._saving} @click=${this._saveCity}>
            ${this._saving ? 'Guardando…' : 'Guardar casa'}
          </button>
        </div>
      </app-modal>
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
    const editing = originalId !== null;
    const heading = editing ? 'Editar ruta' : 'Nueva ruta';
    const close = () => { this._routeForm = null; };
    const tab = this._routeFormTab === 'paradas' ? 'paradas' : 'datos';
    return html`
      <app-modal .open=${true} size="wide" heading=${heading} @close=${close}>
        <div class="rtabs" role="tablist" aria-label="Secciones de la ruta">
          <button role="tab" aria-selected=${tab === 'datos'} class="rtab ${tab === 'datos' ? 'on' : ''}"
            @click=${() => { this._routeFormTab = 'datos'; }}>Datos</button>
          <button role="tab" aria-selected=${tab === 'paradas'} class="rtab ${tab === 'paradas' ? 'on' : ''}"
            @click=${() => { this._routeFormTab = 'paradas'; }}>Paradas (${draft.stops.length})</button>
        </div>
        <div role="tabpanel">
          ${tab === 'datos' ? this._renderRouteDatos(draft, editing) : this._renderRouteParadas(draft)}
        </div>
        ${this._renderErrorList(errors)}
        <div class="modal-actions">
          <button ?disabled=${this._saving} @click=${close}>Cancelar</button>
          <button class="primary" ?disabled=${this._saving} @click=${this._saveRoute}>
            ${this._saving ? 'Guardando…' : 'Guardar ruta'}
          </button>
        </div>
      </app-modal>
    `;
  }

  /** Pestaña «Datos» del editor de ruta (RMR-TSK-0265): rol/hito como badges de
   *  solo lectura al editar (definen el id) o selects al crear; nombre visible
   *  separado del id técnico; descripción amplia; activa. */
  _renderRouteDatos(draft, editing) {
    const roleName = this._arch.islands.find((i) => (i.discipline ?? i.id) === draft.discipline)?.name ?? draft.discipline;
    let techId = '';
    try { techId = routeDocId(draft.discipline, draft.levelKey); } catch { techId = ''; }
    return html`
      <div class="rdatos">
        <div class="rrow">
          <div class="rcell">
            <span class="rlabel">Rol (disciplina)</span>
            ${editing
              ? html`<span class="robadge">${roleName}</span>`
              : html`<select aria-label="Rol" .value=${draft.discipline}
                  @change=${(e) => this._setRouteField('discipline', e.target.value)}>
                  ${this._arch.islands.map((i) => {
                    const d = i.discipline ?? i.id;
                    return html`<option value=${d} ?selected=${d === draft.discipline}>${i.name}</option>`;
                  })}
                </select>`}
          </div>
          <div class="rcell">
            <span class="rlabel">Hito</span>
            ${editing
              ? html`<span class="robadge">${TIER_LABEL[draft.levelKey] ?? draft.levelKey}</span>`
              : html`<select aria-label="Hito" .value=${draft.levelKey}
                  @change=${(e) => this._setRouteField('levelKey', e.target.value)}>
                  ${ROUTE_TIER_KEYS.map((k) => html`<option value=${k} ?selected=${k === draft.levelKey}>${TIER_LABEL[k]}</option>`)}
                </select>`}
          </div>
        </div>
        ${editing ? html`<p class="rhint">Rol e hito no se cambian: definen el ID de la ruta.</p>` : null}

        <label class="rlabel" for="r-name">Nombre visible de la ruta</label>
        <input id="r-name" type="text" placeholder="p. ej. Backend PHP · Grumete" .value=${draft.name}
          @input=${(e) => this._setRouteField('name', e.target.value)} />
        ${techId ? html`<p class="rhint">ID técnico: <code>${techId}</code> — se genera de rol + hito y no lo ven los jugadores.</p>` : null}

        <label class="rlabel" for="r-desc">Descripción</label>
        <textarea id="r-desc" rows="4" placeholder="Qué aprende y demuestra quien recorre esta ruta."
          .value=${draft.description} @input=${(e) => this._setRouteField('description', e.target.value)}></textarea>

        <label class="rcheck">
          <input type="checkbox" .checked=${draft.active}
            @change=${(e) => this._setRouteField('active', e.target.checked)} />
          <span>Activa (visible en el selector de rutas del juego)</span>
        </label>
      </div>
    `;
  }

  /** Pestaña «Paradas» del editor de ruta (RMR-TSK-0265): agrupadas por isla y
   *  contiguas; se reordena dentro de la isla o moviendo el grupo entero. */
  _renderRouteParadas(draft) {
    const islands = [...(this._islands?.values() ?? [])];
    const { warnings } = validateRoute({ ...draft }, islands);
    return html`
      <div class="rparadas">
        <p class="rhint">Las paradas van agrupadas por isla y se recorren de arriba abajo. Reordena dentro de cada isla con ↑↓; para cambiar el orden de las islas, mueve el grupo entero.</p>
        ${warnings.map((w) => html`<p class="warn">⚠ ${w}</p>`)}
        ${this._renderStopGroups()}
        ${this._renderAddStop()}
      </div>
    `;
  }

  /** Paradas agrupadas por isla (RMR-TSK-0265): cabecera con badge de isla +
   *  reordenar el grupo entero; dentro, ↑↓ mueve solo dentro de la isla. */
  _renderStopGroups() {
    const groups = this._stopGroups();
    if (groups.length === 0) return html`<p class="empty">Sin paradas: añade la primera abajo.</p>`;
    const index = buildCityIndex([...(this._islands?.values() ?? [])]);
    const islandName = new Map(this._arch.islands.map((i) => [i.id, i.name]));
    const flat = groups.flatMap((g) => g.stops);
    return html`
      <div class="stopgroups">
        ${groups.map((group, gi) => {
          const where = group.islandId ? (islandName.get(group.islandId) ?? group.islandId) : 'Isla desconocida';
          const plural = group.stops.length === 1 ? 'parada' : 'paradas';
          return html`
            <section class="stopgroup">
              <header class="sghead">
                <span class="sgbadge">🏝️ ${where}</span>
                <span class="sgcount">${group.stops.length} ${plural}</span>
                <span class="sgmove">
                  <button class="mini" title="Subir isla" aria-label="Subir la isla ${where}"
                    ?disabled=${gi === 0 || this._saving} @click=${() => this._moveIslandGroup(gi, -1)}>↑</button>
                  <button class="mini" title="Bajar isla" aria-label="Bajar la isla ${where}"
                    ?disabled=${gi === groups.length - 1 || this._saving} @click=${() => this._moveIslandGroup(gi, 1)}>↓</button>
                </span>
              </header>
              <ol class="stops">
                ${group.stops.map((stop, li) => {
                  const entry = index.get(stop);
                  return html`
                    <li>
                      <span class="n">${flat.indexOf(stop) + 1}</span>
                      <span class="what">
                        ${entry ? entry.city.name : html`<span class="error">${stop} (no existe)</span>`}
                      </span>
                      <button class="mini" title="Subir" aria-label="Subir ${stop}"
                        ?disabled=${li === 0 || this._saving} @click=${() => this._moveStopInGroup(gi, li, -1)}>↑</button>
                      <button class="mini" title="Bajar" aria-label="Bajar ${stop}"
                        ?disabled=${li === group.stops.length - 1 || this._saving} @click=${() => this._moveStopInGroup(gi, li, 1)}>↓</button>
                      <button class="mini danger" title="Quitar" aria-label="Quitar ${stop}"
                        ?disabled=${this._saving} @click=${() => this._removeStopById(stop)}>✕</button>
                    </li>
                  `;
                })}
              </ol>
            </section>
          `;
        })}
      </div>
    `;
  }

  _renderAddStop() {
    const { islandId, cityId } = this._addStop;
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
        <button ?disabled=${!cityId || this._saving} @click=${this._insertStop}>Añadir al final de su isla</button>
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
