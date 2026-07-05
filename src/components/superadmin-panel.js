/**
 * <superadmin-panel>
 * Vista de gestión del superadmin (separada de la vista de líder). Lista los
 * líderes de la instancia (alta por email vía Cloud Function, baja) y permite
 * ver el equipo de cada líder (personas y su perfil Role Mirror) en LECTURA.
 * Si el superadmin es además líder, "Usar como líder" lo lleva a las herramientas.
 * También gestiona el catálogo de accesos (pestaña Usuarios): quién tiene
 * acceso (superadmin/viewer/líder) y permite cambiar el rol de cada uno.
 *
 * Propiedades:
 *  - ready: boolean  (lo activa el glue cuando hay sesión de gestión)
 *  - isLeader: boolean  (si el superadmin también es líder → botón "Usar como líder")
 *  - readOnly: boolean  (viewer: mismo panel, sin controles mutables ni pestaña Usuarios)
 */
import { LitElement, html, css } from 'lit';
import './app-modal.js';
import { listLeaders, addLeaderByEmail, removeLeader } from '../lib/leaders.js';
import { addViewerByEmail } from '../lib/viewers.js';
import { listCatalog, createGlobal, promoteToGlobal, removeFromCatalog } from '../lib/catalog.js';
import { listAllUsers, setUserRole, listLinkedUids, assignUserToLeader } from '../lib/users.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';
import { getPersonProfile } from '../lib/firestore.js';
import { getCareerMap, saveCareerMap, getArchipelago, saveArchipelago } from '../lib/careerMap.js';
import { emptyCareerMap } from '../tools/career/data/maps.js';
import { RESOURCE_KINDS, RESOURCE_FORMATS } from '../tools/career/domain/types.js';
import { getFramework, saveFramework } from '../lib/careerFramework.js';

const CITY_KINDS = ['tech', 'skill', 'milestone'];
const REC_KINDS = ['curso', 'formacion', 'doc', 'titulo'];

/**
 * Genera un id estable a partir de un texto (nombre/código): minúsculas, sin
 * acentos, separadores → guiones. @param {string} text @returns {string}
 */
function slugify(text) {
  return String(text ?? '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Devuelve un id único añadiendo sufijos -2, -3… si `base` ya existe.
 * @param {string} base @param {Set<string>} existing @returns {string}
 */
function uniqueId(base, existing) {
  const root = base || 'item';
  let id = root;
  let n = 2;
  while (existing.has(id)) { id = `${root}-${n}`; n += 1; }
  return id;
}

/** Siguiente `order` disponible (max + 1). @param {ReadonlyArray<{order:number}>} items @returns {number} */
function nextOrder(items) {
  return items.reduce((max, it) => Math.max(max, Number(it.order) || 0), 0) + 1;
}

/** @type {Record<import('../lib/accessRoles.js').AccessRole, string>} */
const ROLE_LABEL = { superadmin: 'Superadmin', viewer: 'Viewer', leader: 'Líder', none: 'Sin rol' };
const ROLE_COLOR = { superadmin: '#dc2626', viewer: '#6b7280', leader: '#3b82f6', none: '#9ca3af' };
const loginFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' });
/** @param {unknown} ts Firestore Timestamp | number | null */
function formatLogin(ts) {
  const ms = ts && typeof (/** @type {any} */ (ts).toMillis) === 'function'
    ? /** @type {any} */ (ts).toMillis()
    : (typeof ts === 'number' ? ts : 0);
  return ms ? loginFmt.format(new Date(ms)) : '—';
}

const VIEW_FLAG = 'grebla-view';
const TABS = ['leaders', 'areas', 'guilds', 'labels', 'careerMap', 'careerFramework', 'users'];

export class SuperadminPanel extends LitElement {
  static properties = {
    ready: { attribute: false },
    isLeader: { attribute: false },
    readOnly: { attribute: false },
    _tab: { state: true },
    leaders: { state: true },
    selected: { state: true },
    team: { state: true },
    teamLoading: { state: true },
    _email: { state: true },
    _error: { state: true },
    _areas: { state: true },
    _guilds: { state: true },
    _labels: { state: true },
    _newCat: { state: true },
    _careerMap: { state: true },
    _archipelago: { state: true },
    _mapIsland: { state: true },
    _newIsland: { state: true },
    _newArea: { state: true },
    _newCity: { state: true },
    _confirmArea: { state: true },
    _confirmCity: { state: true },
    _mapError: { state: true },
    _mapNotice: { state: true },
    _mapSaving: { state: true },
    _framework: { state: true },
    _fwNew: { state: true },
    _fwExpLevel: { state: true },
    _fwAddDiscipline: { state: true },
    _fwConfirm: { state: true },
    _fwError: { state: true },
    _fwNotice: { state: true },
    _fwSaving: { state: true },
    _users: { state: true },
    _newUserEmail: { state: true },
    _newUserRole: { state: true },
    _confirmRoleChange: { state: true },
    _usersError: { state: true },
    _usersNotice: { state: true },
    _linkedUids: { state: true },
    _assignFor: { state: true },
    _assignLeader: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .bar h1 { font-size: 1.4rem; margin: 0; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280);
      border-radius: 999px; padding: 0.4rem 1rem; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: #fff; }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.1rem; margin: 0 0 1rem; }
    .toolbar { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    input {
      padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db);
      font: inherit; font-size: 0.9rem; min-width: 16rem; background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
    }
    button {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.45rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: #fff; }
    button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #6b7280); font-weight: 600; }
    tbody tr.clickable { cursor: pointer; }
    tbody tr.clickable:hover { background: var(--rm-surface-hover, #f9fafb); }
    tr.sel { background: var(--rm-surface-hover, #eef2ff); }
    .muted { color: var(--rm-muted, #9ca3af); }
    .badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; color: #fff; }
    .del-btn { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-danger, #dc2626); border-radius: 6px; padding: 0.2rem 0.6rem; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
    .ord-btn { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 6px; padding: 0.2rem 0.5rem; font-size: 0.8rem; font-weight: 700; line-height: 1; cursor: pointer; }
    .ord-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.88rem; padding: 0.5rem 0; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .notice { color: var(--rm-accent, #2a9d8f); font-size: 0.85rem; font-weight: 600; }
    .ro-note { font-size: 0.78rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.75rem; }
    .sub { font-size: 0.95rem; margin: 1.25rem 0 0.6rem; color: var(--rm-text, #111827); cursor: pointer; }
    details { margin-bottom: 0.5rem; }
    details.city .city-head { cursor: pointer; }
    .confirm { font-size: 0.78rem; color: var(--rm-muted, #6b7280); white-space: nowrap; }
    .confirm button { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.78rem; padding: 0 0.25rem; color: var(--rm-text, #111827); }
    .confirm .yes { color: var(--rm-danger, #dc2626); }
    .row-actions { display: inline-flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
    .act { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 6px; padding: 0.25rem 0.6rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .act:hover { border-color: var(--rm-accent, #3b82f6); color: var(--rm-accent, #3b82f6); }
    .badge.linked { background: #0d9488; margin-left: 0.35rem; }
    .assign-body { display: flex; flex-direction: column; gap: 0.9rem; }
    .assign-field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; font-weight: 600; color: var(--rm-muted, #6b7280); }
    .assign-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
    select { padding: 0.4rem 0.5rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); font: inherit; font-size: 0.85rem; }
    .cities { display: grid; gap: 0.9rem; }
    .city { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.8rem 1rem; background: var(--rm-surface, #fff); }
    .city-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.6rem; }
    .city-head .cid { font-weight: 700; font-family: ui-monospace, monospace; font-size: 0.85rem; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; }
    .fields label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    .fields label.check { flex-direction: row; align-items: center; gap: 0.4rem; }
    .fields label.full { grid-column: 1 / -1; }
    .fields input, .fields select { min-width: 0; font-size: 0.85rem; }
    .fields input[type="checkbox"] { width: auto; min-width: 0; }
    .recs-edit { margin-top: 0.75rem; border-top: 1px solid var(--rm-border, #eef0f2); padding-top: 0.6rem; }
    .recs-head { display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: var(--rm-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.4rem; }
    .recs-head button { padding: 0.2rem 0.5rem; font-size: 0.75rem; }
    .rec-row { display: grid; grid-template-columns: 7rem 1fr 1fr auto; gap: 0.4rem; margin-bottom: 0.4rem; align-items: center; }
    .rec-row input { min-width: 0; }
    @media (max-width: 640px) { .rec-row { grid-template-columns: 1fr; } }
    /* Recursos de la tarjeta (MC-15): tipo + etiqueta + url + formato (libros). */
    .res-row { display: grid; grid-template-columns: 6rem 1fr 1fr 6rem auto; gap: 0.4rem; margin-bottom: 0.4rem; align-items: center; }
    .res-row input, .res-row select { min-width: 0; }
    @media (max-width: 640px) { .res-row { grid-template-columns: 1fr; } }
    textarea {
      font: inherit; font-size: 0.85rem; width: 100%; box-sizing: border-box;
      padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px;
      background: var(--rm-surface, #fff); color: var(--rm-text, #111827); resize: vertical;
    }
    textarea:disabled { opacity: 0.6; cursor: not-allowed; }
    .matrix { display: grid; gap: 0.7rem; }
    .matrix-row { display: grid; grid-template-columns: 12rem 1fr; gap: 0.7rem; align-items: start; }
    .matrix-dim { padding-top: 0.4rem; font-size: 0.8rem; font-weight: 600; color: var(--rm-text, #111827); }
    .matrix-pick { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    @media (max-width: 640px) { .matrix-row { grid-template-columns: 1fr; } }
  `;

  constructor() {
    super();
    this.ready = false;
    this.isLeader = false;
    this.readOnly = false;
    /** @type {'leaders'|'areas'|'guilds'|'labels'|'careerMap'|'careerFramework'|'users'} pestaña activa */
    this._tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'leaders';
    this._onHashChange = () => {
      const t = location.hash.slice(1);
      if (TABS.includes(t)) this._tab = t;
    };
    /** @type {import('../lib/leaders.js').Leader[]} */
    this.leaders = [];
    /** @type {import('../lib/leaders.js').Leader|null} */
    this.selected = null;
    /** @type {Array<Object>} */
    this.team = [];
    this.teamLoading = false;
    this._email = '';
    this._error = '';
    /** @type {import('../lib/catalog.js').CatalogItem[]} */
    this._areas = [];
    /** @type {import('../lib/catalog.js').CatalogItem[]} */
    this._guilds = [];
    /** @type {import('../lib/catalog.js').CatalogItem[]} */
    this._labels = [];
    this._newCat = { areas: '', guilds: '', labels: '' };
    /** @type {import('../tools/career/domain/types.js').CareerMap|null} */
    this._careerMap = null;
    /** @type {import('../tools/career/domain/types.js').Archipelago|null} índice de islas (MC-14) */
    this._archipelago = null;
    /** @type {string} isla seleccionada en el editor del mapa (MC-14) */
    this._mapIsland = 'island';
    this._newIsland = { id: '', name: '' };
    this._newArea = { id: '', name: '' };
    this._newCity = { id: '', name: '' };
    this._confirmArea = null;
    this._confirmCity = null;
    this._mapError = '';
    this._mapNotice = '';
    this._mapSaving = false;
    /** @type {import('../tools/career/data/framework.js').CareerFramework|null} */
    this._framework = null;
    this._fwNew = { track: '', discipline: '', dimension: '', levelCode: '', levelTitle: '' };
    /** @type {string} nivel seleccionado en la matriz de expectativas ('' → primero por orden) */
    this._fwExpLevel = '';
    /** @type {string} disciplina seleccionada en los addendums ('' → primera por orden) */
    this._fwAddDiscipline = '';
    /** @type {{ kind: 'tracks'|'levels'|'disciplines'|'dimensions', id: string }|null} */
    this._fwConfirm = null;
    this._fwError = '';
    this._fwNotice = '';
    this._fwSaving = false;
    /** @type {import('../lib/accessRoles.js').AccessUser[]} */
    this._users = [];
    this._newUserEmail = '';
    /** @type {'viewer'|'leader'} rol inicial para el alta por email */
    this._newUserRole = 'viewer';
    /** @type {{ uid: string, role: import('../lib/accessRoles.js').AccessRole|'none' }|null} */
    this._confirmRoleChange = null;
    this._usersError = '';
    this._usersNotice = '';
    /** @type {string[]} uids ya vinculados a una persona (para no ofrecer "Asignar") */
    this._linkedUids = [];
    /** @type {import('../lib/accessRoles.js').AccessUser|null} usuario del modal "Asignar a equipo" */
    this._assignFor = null;
    /** @type {string} líder seleccionado en el modal "Asignar a equipo" */
    this._assignLeader = '';
    this._loaded = false;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('hashchange', this._onHashChange);
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this._onHashChange);
    super.disconnectedCallback();
  }

  /** @param {typeof TABS[number]} tab */
  _setTab(tab) {
    // Escribe el hash (recarga y atrás/adelante conservan la pestaña); el
    // listener de hashchange sincroniza _tab. Si el hash ya coincide, fija _tab.
    if (location.hash.slice(1) !== tab) location.hash = tab;
    else this._tab = tab;
  }

  updated() {
    if (this.ready && !this._loaded) {
      this._loaded = true;
      this._loadLeaders();
      this._loadCatalogs();
      this._loadCareerMap();
      this._loadFramework();
      // El viewer no gestiona usuarios: no hace falta cargar la pestaña.
      if (!this.readOnly) this._loadUsers();
    }
  }

  async _loadCatalogs() {
    try {
      const [areas, guilds, labels] = await Promise.all([
        listCatalog('areas'),
        listCatalog('guilds'),
        listCatalog('labels'),
      ]);
      this._areas = areas;
      this._guilds = guilds;
      this._labels = labels;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los catálogos.';
    }
  }

  /** @param {import('../lib/catalog.js').CatalogKind} kind */
  async _createGlobalItem(kind) {
    const name = (this._newCat[kind] || '').trim();
    if (!name) return;
    this._error = '';
    try {
      await createGlobal(kind, name);
      this._newCat = { ...this._newCat, [kind]: '' };
      await this._loadCatalogs();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo crear.';
    }
  }

  /** @param {import('../lib/catalog.js').CatalogKind} kind @param {string} id */
  async _promote(kind, id) {
    this._error = '';
    try {
      await promoteToGlobal(kind, id);
      await this._loadCatalogs();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo promover.';
    }
  }

  /** @param {import('../lib/catalog.js').CatalogKind} kind @param {string} id */
  async _removeCatalogItem(kind, id) {
    this._error = '';
    try {
      await removeFromCatalog(kind, id);
      await this._loadCatalogs();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo eliminar.';
    }
  }

  // ── Mapa de carrera (editor, multi-isla MC-14) ─────────────────────────────

  /** Nombre de una isla en el índice del archipiélago. @param {string} islandId */
  _islandName(islandId) {
    return (this._archipelago?.islands ?? []).find((i) => i.id === islandId)?.name ?? '';
  }

  /** Carga el índice del archipiélago (una vez) y el mapa de la isla seleccionada. */
  async _loadCareerMap() {
    this._mapError = '';
    try {
      this._archipelago ??= await getArchipelago();
      this._careerMap = await getCareerMap(this._mapIsland, this._islandName(this._mapIsland));
    } catch (err) {
      this._mapError = err instanceof Error ? err.message : 'No se pudo cargar el mapa de carrera.';
    }
  }

  /** Cambia la isla en edición y carga su mapa. @param {string} islandId */
  async _selectIsland(islandId) {
    if (islandId === this._mapIsland) return;
    this._mapIsland = islandId;
    this._careerMap = null; // «Cargando…» mientras llega la isla nueva
    this._mapNotice = '';
    this._confirmArea = null;
    this._confirmCity = null;
    await this._loadCareerMap();
  }

  /**
   * «Nueva isla» (MC-14): la añade al índice del archipiélago (posición al
   * centro del mar, editable después) y crea su doc vacío en /careerMap; luego
   * la deja seleccionada para editarla.
   */
  async _addIsland() {
    const id = slugify(this._newIsland.id || this._newIsland.name);
    const name = this._newIsland.name.trim();
    this._mapError = '';
    if (!id || !name) { this._mapError = 'La isla necesita id y nombre.'; return; }
    const islands = this._archipelago?.islands ?? [];
    if (id === '_archipelago' || islands.some((i) => i.id === id)) {
      this._mapError = `Ya existe la isla «${id}» (o el id está reservado).`;
      return;
    }
    this._mapSaving = true;
    try {
      const next = { islands: [...islands, { id, name, x: 50, y: 50 }] };
      await saveArchipelago(next);
      await saveCareerMap(id, emptyCareerMap(id, name));
      this._archipelago = next;
      this._newIsland = { id: '', name: '' };
      this._mapNotice = `Isla «${name}» creada.`;
      this._mapIsland = id;
      this._careerMap = null;
      await this._loadCareerMap();
    } catch (err) {
      this._mapError = err instanceof Error ? err.message : 'No se pudo crear la isla.';
    } finally {
      this._mapSaving = false;
    }
  }

  /**
   * Edición mínima del índice (MC-14): nombre y posición x/y de la isla
   * seleccionada en el mapa del mar. Se aplica en local; «Guardar índice»
   * persiste el documento completo.
   * @param {Partial<import('../tools/career/domain/types.js').IslandRef>} patch
   */
  _patchIslandRef(patch) {
    const islands = (this._archipelago?.islands ?? []).map((i) =>
      i.id === this._mapIsland ? { ...i, ...patch } : i,
    );
    this._archipelago = { islands };
    this._mapNotice = '';
  }

  /** Persiste el índice del archipiélago (nombre/posición editados). */
  async _saveArchipelago() {
    this._mapError = '';
    this._mapSaving = true;
    try {
      await saveArchipelago(this._archipelago ?? { islands: [] });
      this._mapNotice = 'Índice del archipiélago guardado.';
    } catch (err) {
      this._mapError = err instanceof Error ? err.message : 'No se pudo guardar el índice.';
    } finally {
      this._mapSaving = false;
    }
  }

  /** Reemplaza el mapa de trabajo (copia inmutable para refrescar Lit). @param {Partial<import('../tools/career/domain/types.js').CareerMap>} patch */
  _patchMap(patch) {
    this._careerMap = { ...this._careerMap, ...patch };
    this._mapNotice = '';
  }

  /** @param {number} idx @param {Partial<import('../tools/career/domain/types.js').City>} patch */
  _patchCity(idx, patch) {
    const cities = this._careerMap.cities.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    this._patchMap({ cities });
  }

  _addArea() {
    const id = this._newArea.id.trim();
    const name = this._newArea.name.trim();
    this._mapError = '';
    if (!id || !name) { this._mapError = 'La comarca necesita id y nombre.'; return; }
    if (this._careerMap.areas.some((a) => a.id === id)) { this._mapError = `Ya existe la comarca «${id}».`; return; }
    this._patchMap({ areas: [...this._careerMap.areas, { id, name }] });
    this._newArea = { id: '', name: '' };
  }

  /** @param {string} id @param {string} name */
  _renameArea(id, name) {
    this._patchMap({ areas: this._careerMap.areas.map((a) => (a.id === id ? { ...a, name } : a)) });
  }

  /** @param {string} id */
  _deleteArea(id) {
    this._mapError = '';
    const inUse = this._careerMap.cities.filter((c) => c.area === id);
    if (inUse.length) {
      this._confirmArea = null;
      this._mapError = `No se puede borrar «${id}»: ${inUse.length} casa(s) la usan. Reasígnalas antes.`;
      return;
    }
    this._patchMap({ areas: this._careerMap.areas.filter((a) => a.id !== id) });
    this._confirmArea = null;
  }

  _addCity() {
    const id = this._newCity.id.trim();
    const name = this._newCity.name.trim();
    this._mapError = '';
    if (!id || !name) { this._mapError = 'La casa necesita id y nombre.'; return; }
    if (this._careerMap.cities.some((c) => c.id === id)) { this._mapError = `Ya existe la casa «${id}».`; return; }
    const area = this._careerMap.areas[0]?.id ?? '';
    /** @type {import('../tools/career/domain/types.js').City} */
    const city = { id, name, kind: 'tech', area, x: 50, y: 50, weight: 1, prereqs: [] };
    this._patchMap({ cities: [...this._careerMap.cities, city] });
    this._newCity = { id: '', name: '' };
  }

  /** @param {string} id */
  _deleteCity(id) {
    // Quita la ciudad y la elimina de los prereqs de las demás.
    const cities = this._careerMap.cities
      .filter((c) => c.id !== id)
      .map((c) => (c.prereqs.includes(id) ? { ...c, prereqs: c.prereqs.filter((p) => p !== id) } : c));
    this._patchMap({ cities });
    this._confirmCity = null;
  }

  /** @param {number} idx @param {HTMLSelectElement} select */
  _setPrereqs(idx, select) {
    const prereqs = [...select.selectedOptions].map((o) => o.value);
    this._patchCity(idx, { prereqs });
  }

  /** @param {number} idx */
  _addRecommendation(idx) {
    const city = this._careerMap.cities[idx];
    const recommendations = [...(city.recommendations ?? []), { kind: 'doc', label: '', url: '' }];
    this._patchCity(idx, { recommendations });
  }

  /** @param {number} idx @param {number} recIdx @param {Partial<import('../tools/career/domain/types.js').Recommendation>} patch */
  _patchRecommendation(idx, recIdx, patch) {
    const recommendations = (this._careerMap.cities[idx].recommendations ?? []).map((r, i) => (i === recIdx ? { ...r, ...patch } : r));
    this._patchCity(idx, { recommendations });
  }

  /** @param {number} idx @param {number} recIdx */
  _removeRecommendation(idx, recIdx) {
    const recommendations = (this._careerMap.cities[idx].recommendations ?? []).filter((_, i) => i !== recIdx);
    this._patchCity(idx, { recommendations });
  }

  // ── Contenido de la tarjeta de la ciudad (MC-15) ────────────────────────────
  // keyPoints/aiFocus se editan en crudo (el saneo — trim, líneas vacías fuera,
  // kinds inválidos descartados — lo aplica serializeCareerMap al guardar).

  /** Añade una fila de recurso vacía a la ciudad. @param {number} idx */
  _addResource(idx) {
    const city = this._careerMap.cities[idx];
    const resources = [...(city.resources ?? []), { kind: 'curso', label: '', url: '' }];
    this._patchCity(idx, { resources });
  }

  /**
   * Edita un recurso de la ciudad. Al cambiar el tipo a algo que no es libro,
   * el formato (papel/online) deja de tener sentido y se retira.
   * @param {number} idx @param {number} resIdx @param {Partial<import('../tools/career/domain/types.js').Resource>} patch
   */
  _patchResource(idx, resIdx, patch) {
    const resources = (this._careerMap.cities[idx].resources ?? []).map((r, i) => {
      if (i !== resIdx) return r;
      const next = { ...r, ...patch };
      if (next.kind !== 'libro') delete next.format;
      return next;
    });
    this._patchCity(idx, { resources });
  }

  /** Quita un recurso de la ciudad. @param {number} idx @param {number} resIdx */
  _removeResource(idx, resIdx) {
    const resources = (this._careerMap.cities[idx].resources ?? []).filter((_, i) => i !== resIdx);
    this._patchCity(idx, { resources });
  }

  /** Valida el mapa antes de guardar. @returns {string|null} mensaje de error o null */
  _validateMap() {
    const { areas, cities } = this._careerMap;
    const areaIds = new Set(areas.map((a) => a.id));
    const cityIds = new Set();
    for (const c of cities) {
      if (!c.id.trim() || !c.name.trim()) return 'Hay casas sin id o sin nombre.';
      if (cityIds.has(c.id)) return `Casa duplicada: «${c.id}».`;
      cityIds.add(c.id);
      if (c.area && !areaIds.has(c.area)) return `La casa «${c.id}» apunta a una comarca inexistente.`;
      if (c.x < 0 || c.x > 100 || c.y < 0 || c.y > 100) return `La casa «${c.id}» tiene una posición fuera de 0..100.`;
    }
    return null;
  }

  async _saveCareerMap() {
    this._mapError = '';
    this._mapNotice = '';
    const invalid = this._validateMap();
    if (invalid) { this._mapError = invalid; return; }
    this._mapSaving = true;
    try {
      await saveCareerMap(this._mapIsland, this._careerMap);
      this._mapNotice = 'Mapa guardado.';
    } catch (err) {
      this._mapError = err instanceof Error ? err.message : 'No se pudo guardar el mapa.';
    } finally {
      this._mapSaving = false;
    }
  }

  // ── Framework de carrera (editor) ──────────────────────────────────────────

  async _loadFramework() {
    this._fwError = '';
    try {
      this._framework = await getFramework();
    } catch (err) {
      this._fwError = err instanceof Error ? err.message : 'No se pudo cargar el framework de carrera.';
    }
  }

  /** Reemplaza el framework de trabajo (copia inmutable para refrescar Lit). @param {Partial<import('../tools/career/data/framework.js').CareerFramework>} patch */
  _patchFramework(patch) {
    this._framework = { ...this._framework, ...patch };
    this._fwNotice = '';
  }

  /** @param {'tracks'|'levels'|'disciplines'|'dimensions'} kind @param {string} id */
  _isFwConfirm(kind, id) {
    return this._fwConfirm?.kind === kind && this._fwConfirm?.id === id;
  }

  /** @param {'tracks'|'levels'|'disciplines'|'dimensions'} kind @param {string} id @param {Record<string, unknown>} patch */
  _patchFwItem(kind, id, patch) {
    const list = /** @type {Array<any>} */ (this._framework[kind]).map((it) => (it.id === id ? { ...it, ...patch } : it));
    this._patchFramework({ [kind]: list });
  }

  /** Sube (-1) o baja (+1) un item intercambiando su `order` con el vecino. @param {'tracks'|'levels'|'disciplines'|'dimensions'} kind @param {string} id @param {-1|1} dir */
  _moveFwItem(kind, id, dir) {
    const sorted = /** @type {Array<any>} */ (this._framework[kind]).toSorted((a, b) => a.order - b.order);
    const pos = sorted.findIndex((it) => it.id === id);
    const swapPos = pos + dir;
    if (pos < 0 || swapPos < 0 || swapPos >= sorted.length) return;
    const a = sorted[pos];
    const b = sorted[swapPos];
    const list = /** @type {Array<any>} */ (this._framework[kind]).map((it) => {
      if (it.id === a.id) return { ...it, order: b.order };
      if (it.id === b.id) return { ...it, order: a.order };
      return it;
    });
    this._patchFramework({ [kind]: list });
  }

  /** Añade un track/disciplina/dimensión con id autogenerado y único. @param {'tracks'|'disciplines'|'dimensions'} kind @param {'track'|'discipline'|'dimension'} field @param {string} singular */
  _addNamed(kind, field, singular) {
    const name = this._fwNew[field].trim();
    this._fwError = '';
    if (!name) { this._fwError = `El ${singular} necesita un nombre.`; return; }
    const list = /** @type {Array<any>} */ (this._framework[kind]);
    const id = uniqueId(slugify(name), new Set(list.map((it) => it.id)));
    this._patchFramework({ [kind]: [...list, { id, name, order: nextOrder(list), description: '' }] });
    this._fwNew = { ...this._fwNew, [field]: '' };
  }

  _addLevel() {
    const code = this._fwNew.levelCode.trim();
    const title = this._fwNew.levelTitle.trim();
    this._fwError = '';
    if (!code || !title) { this._fwError = 'El nivel necesita código y título.'; return; }
    const levels = this._framework.levels;
    const id = uniqueId(slugify(code) || slugify(title), new Set(levels.map((l) => l.id)));
    const trackId = this._framework.tracks[0]?.id ?? '';
    /** @type {import('../tools/career/data/framework.js').Level} */
    const level = { id, code, title, trackId, order: nextOrder(levels), description: '', typicalProfile: '', branchesFrom: null };
    this._patchFramework({ levels: [...levels, level] });
    this._fwNew = { ...this._fwNew, levelCode: '', levelTitle: '' };
  }

  /** @param {'tracks'|'levels'|'disciplines'|'dimensions'} kind @param {string} id */
  _deleteFwItem(kind, id) {
    this._fwError = '';
    // Un track en uso no se puede borrar: reasignar los niveles antes.
    if (kind === 'tracks') {
      const inUse = this._framework.levels.filter((l) => l.trackId === id);
      if (inUse.length) {
        this._fwConfirm = null;
        this._fwError = `No se puede borrar el track «${id}»: ${inUse.length} nivel(es) lo usan. Reasígnalos antes.`;
        return;
      }
    }
    const list = /** @type {Array<any>} */ (this._framework[kind]).filter((it) => it.id !== id);
    /** @type {Record<string, unknown>} */
    const patch = { [kind]: list };
    // Al borrar un nivel, limpia los branchesFrom que apuntaban a él.
    if (kind === 'levels') {
      patch.levels = list.map((l) => (l.branchesFrom === id ? { ...l, branchesFrom: null } : l));
    }
    this._patchFramework(patch);
    this._fwConfirm = null;
  }

  /** Valida el framework antes de guardar. @returns {string|null} mensaje de error o null */
  _validateFramework() {
    const fw = this._framework;
    for (const [kind, label] of /** @type {const} */ ([['tracks', 'track'], ['disciplines', 'disciplina'], ['dimensions', 'dimensión']])) {
      const seen = new Set();
      for (const it of fw[kind]) {
        if (!it.id.trim() || !it.name.trim()) return `Hay ${label}s sin id o sin nombre.`;
        if (seen.has(it.id)) return `${label} duplicad@: «${it.id}».`;
        seen.add(it.id);
      }
    }
    const trackIds = new Set(fw.tracks.map((t) => t.id));
    const levelIds = new Set();
    for (const l of fw.levels) {
      if (!l.id.trim() || !l.title.trim()) return 'Hay niveles sin id o sin título.';
      if (levelIds.has(l.id)) return `Nivel duplicado: «${l.id}».`;
      levelIds.add(l.id);
      if (!trackIds.has(l.trackId)) return `El nivel «${l.id}» apunta a un track inexistente.`;
    }
    for (const l of fw.levels) {
      if (l.branchesFrom && !levelIds.has(l.branchesFrom)) return `El nivel «${l.id}» ramifica desde un nivel inexistente.`;
    }
    return null;
  }

  async _saveFramework() {
    this._fwError = '';
    this._fwNotice = '';
    const invalid = this._validateFramework();
    if (invalid) { this._fwError = invalid; return; }
    this._fwSaving = true;
    try {
      await saveFramework(this._framework);
      this._fwNotice = 'Framework guardado.';
    } catch (err) {
      this._fwError = err instanceof Error ? err.message : 'No se pudo guardar el framework.';
    } finally {
      this._fwSaving = false;
    }
  }

  // ── Matriz de expectativas (Nivel × Dimensión) ─────────────────────────────

  /** Texto de la celda {levelId, dimensionId} o '' si no existe. @param {string} levelId @param {string} dimensionId @returns {string} */
  _expectationText(levelId, dimensionId) {
    return this._framework.expectations.find((e) => e.levelId === levelId && e.dimensionId === dimensionId)?.text ?? '';
  }

  /** Crea/actualiza (o elimina si queda vacío) la celda de expectativa. @param {string} levelId @param {string} dimensionId @param {string} value */
  _setExpectation(levelId, dimensionId, value) {
    const list = this._framework.expectations;
    const idx = list.findIndex((e) => e.levelId === levelId && e.dimensionId === dimensionId);
    let next;
    if (!value.trim()) {
      next = idx >= 0 ? list.filter((_, i) => i !== idx) : list;
    } else if (idx >= 0) {
      next = list.map((e, i) => (i === idx ? { ...e, text: value } : e));
    } else {
      next = [...list, { levelId, dimensionId, text: value }];
    }
    this._patchFramework({ expectations: next });
  }

  // ── Addendums por disciplina (Disciplina × Dimensión) ──────────────────────

  /** Texto del addendum {disciplineId, dimensionId} o '' si no existe. @param {string} disciplineId @param {string} dimensionId @returns {string} */
  _addendumText(disciplineId, dimensionId) {
    return this._framework.addendums.find((a) => a.disciplineId === disciplineId && a.dimensionId === dimensionId)?.text ?? '';
  }

  /** Crea/actualiza (o elimina si queda vacío) el addendum. @param {string} disciplineId @param {string} dimensionId @param {string} value */
  _setAddendum(disciplineId, dimensionId, value) {
    const list = this._framework.addendums;
    const idx = list.findIndex((a) => a.disciplineId === disciplineId && a.dimensionId === dimensionId);
    let next;
    if (!value.trim()) {
      next = idx >= 0 ? list.filter((_, i) => i !== idx) : list;
    } else if (idx >= 0) {
      next = list.map((a, i) => (i === idx ? { ...a, text: value } : a));
    } else {
      next = [...list, { disciplineId, dimensionId, text: value }];
    }
    this._patchFramework({ addendums: next });
  }

  /** @param {string} uid */
  _leaderLabel(uid) {
    const l = this.leaders.find((x) => x.uid === uid);
    return l?.displayName ?? l?.email ?? uid;
  }

  async _loadLeaders() {
    this._error = '';
    try {
      this.leaders = await listLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los líderes.';
    }
  }

  async _addLeader() {
    const email = this._email.trim();
    if (!email) return;
    this._error = '';
    try {
      await addLeaderByEmail(email);
      this._email = '';
      await this._loadLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo añadir el líder.';
    }
  }

  /** @param {string} uid */
  async _removeLeader(uid) {
    this._error = '';
    try {
      await removeLeader(uid);
      if (this.selected?.uid === uid) this.selected = null;
      await this._loadLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo quitar el líder.';
    }
  }

  // ── Usuarios (accesos: superadmin / viewer / líder) ─────────────────────────

  async _loadUsers() {
    this._usersError = '';
    try {
      const [users, linkedUids] = await Promise.all([listAllUsers(), listLinkedUids()]);
      this._users = users;
      this._linkedUids = linkedUids;
    } catch (err) {
      this._usersError = err instanceof Error ? err.message : 'No se pudieron cargar los usuarios.';
    }
  }

  /**
   * ¿Está la cuenta ya vinculada a una persona? Si lo está, no se ofrece
   * "Asignar a equipo" (se muestra un chip informativo).
   * @param {import('../lib/accessRoles.js').AccessUser} user
   * @returns {boolean}
   */
  _isLinked(user) {
    return this._linkedUids.includes(user.uid);
  }

  /** @param {import('../lib/accessRoles.js').AccessUser} user */
  _openAssign(user) {
    this._assignFor = user;
    this._assignLeader = '';
    this._usersError = '';
    this._usersNotice = '';
  }

  _closeAssign() {
    this._assignFor = null;
    this._assignLeader = '';
  }

  /**
   * Crea una persona vinculada al usuario dentro del equipo del líder elegido y
   * refresca la lista (el usuario pasará a estar vinculado).
   */
  async _assign() {
    const user = this._assignFor;
    const leaderUid = this._assignLeader;
    if (!user || !leaderUid) return;
    this._usersError = '';
    try {
      await assignUserToLeader(user, leaderUid);
      this._assignFor = null;
      this._assignLeader = '';
      this._usersNotice = 'Usuario asignado a un equipo.';
      await this._loadUsers();
    } catch (err) {
      this._usersError = err instanceof Error ? err.message : 'No se pudo asignar el usuario.';
    }
  }

  async _addUser() {
    const email = this._newUserEmail.trim();
    if (!email) return;
    this._usersError = '';
    this._usersNotice = '';
    try {
      if (this._newUserRole === 'leader') {
        await addLeaderByEmail(email);
      } else {
        await addViewerByEmail(email);
      }
      this._newUserEmail = '';
      this._usersNotice = 'Usuario añadido.';
      await Promise.all([this._loadUsers(), this._loadLeaders()]);
    } catch (err) {
      this._usersError = err instanceof Error ? err.message : 'No se pudo añadir el usuario.';
    }
  }

  /**
   * @param {import('../lib/accessRoles.js').AccessUser} user
   * @param {import('../lib/accessRoles.js').AccessRole|'none'} role
   */
  async _changeUserRole(user, role) {
    this._usersError = '';
    this._usersNotice = '';
    try {
      await setUserRole(user.uid, role, { displayName: user.displayName, email: user.email });
      this._confirmRoleChange = null;
      this._usersNotice = 'Rol actualizado.';
      await Promise.all([this._loadUsers(), this._loadLeaders()]);
    } catch (err) {
      this._usersError = err instanceof Error ? err.message : 'No se pudo cambiar el rol.';
    }
  }

  /** @param {import('../lib/accessRoles.js').AccessRole|'none'} role */
  _roleChangeLabel(role) {
    return role === 'none' ? 'Quitar acceso' : ROLE_LABEL[role];
  }

  /** @param {import('../lib/leaders.js').Leader} leader */
  async _openTeam(leader) {
    this.selected = leader;
    this.team = [];
    this.teamLoading = true;
    this._error = '';
    try {
      const { persistence } = await createTeamContainer({ mode: 'firestore', leaderUid: leader.uid });
      const people = await listActivePeople(persistence);
      this.team = await Promise.all(
        people.map(async (p) => ({ ...p, profile: await getPersonProfile(p.id) })),
      );
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el equipo.';
    } finally {
      this.teamLoading = false;
    }
  }

  _useAsLeader() {
    sessionStorage.setItem(VIEW_FLAG, 'leader');
    location.assign('/');
  }

  /**
   * @param {import('../lib/catalog.js').CatalogKind} kind
   * @param {import('../lib/catalog.js').CatalogItem[]} items
   * @param {string} title @param {string} placeholder
   */
  _renderCatalog(kind, items, title, placeholder) {
    const globals = items.filter((i) => !i.ownerLeaderUid);
    const personals = items.filter((i) => i.ownerLeaderUid);
    return html`
      <section>
        <h2>${title}</h2>
        ${this.readOnly
          ? null
          : html`<div class="toolbar">
              <input
                type="text"
                placeholder=${placeholder}
                .value=${this._newCat[kind]}
                @input=${(e) => { this._newCat = { ...this._newCat, [kind]: e.target.value }; }}
              />
              <button class="primary" ?disabled=${!this._newCat[kind].trim()} @click=${() => this._createGlobalItem(kind)}>Crear global</button>
            </div>`}
        ${globals.length === 0
          ? html`<p class="empty">Aún no hay globales.</p>`
          : html`<table>
              <thead><tr><th>Global</th><th></th></tr></thead>
              <tbody>
                ${globals.map(
                  (i) => html`<tr>
                    <td>${i.name}</td>
                    <td>${this.readOnly ? null : html`<button class="del-btn" @click=${() => this._removeCatalogItem(kind, i.id)}>Borrar</button>`}</td>
                  </tr>`,
                )}
              </tbody>
            </table>`}
        ${personals.length === 0
          ? null
          : html`
              <p class="ro-note">Personales de líderes — promuévelos a global para compartirlos con todos:</p>
              <table>
                <thead><tr><th>Nombre</th><th>Líder</th><th></th></tr></thead>
                <tbody>
                  ${personals.map(
                    (i) => html`<tr>
                      <td>${i.name}</td>
                      <td class="muted">${this._leaderLabel(i.ownerLeaderUid)}</td>
                      <td>
                        ${this.readOnly
                          ? null
                          : html`
                              <button @click=${() => this._promote(kind, i.id)}>Promover a global</button>
                              <button class="del-btn" @click=${() => this._removeCatalogItem(kind, i.id)}>Borrar</button>
                            `}
                      </td>
                    </tr>`,
                  )}
                </tbody>
              </table>`}
      </section>
    `;
  }

  _renderTabContent() {
    switch (this._tab) {
      case 'leaders':
        return html`${this._renderLeaders()} ${this.selected ? this._renderTeam() : null}`;
      case 'areas':
        return this._renderCatalog('areas', this._areas, 'Áreas de conocimiento (organización)', 'Nueva área global…');
      case 'guilds':
        return this._renderCatalog('guilds', this._guilds, 'Gremios (organización)', 'Nuevo gremio global…');
      case 'labels':
        return this._renderCatalog('labels', this._labels, 'Labels (organización)', 'Nuevo label global…');
      case 'careerMap':
        return this._renderCareerMap();
      case 'careerFramework':
        return this._renderFramework();
      case 'users':
        return this._renderUsers();
      default:
        return null;
    }
  }

  render() {
    return html`
      <div class="bar">
        <h1>Gestión de la organización</h1>
        ${this.readOnly ? html`<span class="badge" style="background:var(--rm-muted, #6b7280)">Modo solo lectura (viewer)</span>` : null}
        ${this.isLeader && !this.readOnly
          ? html`<button class="primary" @click=${this._useAsLeader}>Usar como líder →</button>`
          : null}
      </div>
      <nav class="tabs" aria-label="Secciones de gestión">
        <button class="tab ${this._tab === 'leaders' ? 'active' : ''}" @click=${() => this._setTab('leaders')}>Líderes</button>
        <button class="tab ${this._tab === 'areas' ? 'active' : ''}" @click=${() => this._setTab('areas')}>Áreas</button>
        <button class="tab ${this._tab === 'guilds' ? 'active' : ''}" @click=${() => this._setTab('guilds')}>Gremios</button>
        <button class="tab ${this._tab === 'labels' ? 'active' : ''}" @click=${() => this._setTab('labels')}>Labels</button>
        <button class="tab ${this._tab === 'careerMap' ? 'active' : ''}" @click=${() => this._setTab('careerMap')}>Mapa de carrera</button>
        <button class="tab ${this._tab === 'careerFramework' ? 'active' : ''}" @click=${() => this._setTab('careerFramework')}>Carrera</button>
        ${this.readOnly
          ? null
          : html`<button class="tab ${this._tab === 'users' ? 'active' : ''}" @click=${() => this._setTab('users')}>Usuarios</button>`}
      </nav>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._renderTabContent()}
    `;
  }

  _renderCareerMap() {
    const map = this._careerMap;
    return html`
      <section>
        <h2>Mapa de carrera</h2>
        <p class="ro-note">Edita cada isla del archipiélago: comarcas y casas (hitos, skills y tecnologías). Los cambios se aplican al guardar.</p>
        ${this._mapError ? html`<p class="error">${this._mapError}</p>` : null}
        ${this._mapNotice ? html`<p class="notice">${this._mapNotice}</p>` : null}
        ${this._renderIslandPicker()}
        ${!map
          ? html`<p class="empty">Cargando el mapa…</p>`
          : html`
              ${this._renderAreas(map)}
              ${this._renderCities(map)}
              ${this.readOnly
                ? null
                : html`
                    <div class="toolbar" style="margin-top:1rem">
                      <button class="primary" ?disabled=${this._mapSaving} @click=${() => this._saveCareerMap()}>
                        ${this._mapSaving ? 'Guardando…' : `Guardar mapa (${this._islandName(this._mapIsland) || this._mapIsland})`}
                      </button>
                    </div>
                  `}
            `}
      </section>
    `;
  }

  /**
   * Selector de isla del archipiélago (MC-14), alta de islas nuevas y edición
   * mínima del índice (nombre y posición x/y en el mapa del mar).
   */
  _renderIslandPicker() {
    const islands = this._archipelago?.islands ?? [];
    const current = islands.find((i) => i.id === this._mapIsland) ?? null;
    return html`
      <details open>
        <summary class="sub">Archipiélago (${islands.length} islas)</summary>
        <div class="toolbar">
          <label>Isla en edición
            <select @change=${(e) => this._selectIsland(e.target.value)}>
              ${islands.map(
                (i) => html`<option value=${i.id} ?selected=${i.id === this._mapIsland}>
                  ${i.name} (${i.id})${i.startIsland ? ' · inicio' : ''}
                </option>`,
              )}
            </select>
          </label>
          ${this.readOnly || !current
            ? null
            : html`
                <input type="text" style="width:12rem" placeholder="Nombre en el mapa del mar" .value=${current.name}
                  @input=${(e) => this._patchIslandRef({ name: e.target.value })} />
                <label>x <input type="number" min="0" max="100" step="1" style="width:4.5rem" .value=${String(current.x)}
                  @input=${(e) => this._patchIslandRef({ x: Number(e.target.value) })} /></label>
                <label>y <input type="number" min="0" max="100" step="1" style="width:4.5rem" .value=${String(current.y)}
                  @input=${(e) => this._patchIslandRef({ y: Number(e.target.value) })} /></label>
                <button ?disabled=${this._mapSaving} @click=${() => this._saveArchipelago()}>Guardar índice</button>
              `}
        </div>
        ${this.readOnly
          ? null
          : html`<div class="toolbar">
              <input type="text" placeholder="id (p. ej. data-engineer)" .value=${this._newIsland.id}
                @input=${(e) => { this._newIsland = { ...this._newIsland, id: e.target.value }; }} />
              <input type="text" placeholder="Nombre (p. ej. Isla Data Engineer)" .value=${this._newIsland.name}
                @input=${(e) => { this._newIsland = { ...this._newIsland, name: e.target.value }; }} />
              <button class="primary" ?disabled=${this._mapSaving || !this._newIsland.name.trim()} @click=${() => this._addIsland()}>Nueva isla</button>
            </div>`}
      </details>
    `;
  }

  /** @param {import('../tools/career/domain/types.js').CareerMap} map */
  _renderAreas(map) {
    return html`
      <details open>
      <summary class="sub">Comarcas (${map.areas.length})</summary>
      ${this.readOnly
        ? null
        : html`<div class="toolbar">
            <input type="text" placeholder="id (p. ej. frontend)" .value=${this._newArea.id}
              @input=${(e) => { this._newArea = { ...this._newArea, id: e.target.value }; }} />
            <input type="text" placeholder="Nombre" .value=${this._newArea.name}
              @input=${(e) => { this._newArea = { ...this._newArea, name: e.target.value }; }} />
            <button class="primary" ?disabled=${!this._newArea.id.trim() || !this._newArea.name.trim()} @click=${() => this._addArea()}>Añadir comarca</button>
          </div>`}
      ${map.areas.length === 0
        ? html`<p class="empty">Aún no hay comarcas.</p>`
        : html`<table>
            <thead><tr><th>Id</th><th>Nombre</th><th></th></tr></thead>
            <tbody>
              ${map.areas.map(
                (a) => html`<tr>
                  <td class="muted">${a.id}</td>
                  <td><input type="text" .value=${a.name} ?disabled=${this.readOnly} @input=${(e) => this._renameArea(a.id, e.target.value)} /></td>
                  <td>${this.readOnly
                    ? null
                    : this._confirmArea === a.id
                      ? html`<span class="confirm">¿Borrar?
                          <button class="yes" @click=${() => this._deleteArea(a.id)}>Sí</button>
                          <button @click=${() => { this._confirmArea = null; }}>No</button>
                        </span>`
                      : html`<button class="del-btn" @click=${() => { this._confirmArea = a.id; this._mapError = ''; }}>Borrar</button>`}
                  </td>
                </tr>`,
              )}
            </tbody>
          </table>`}
      </details>
    `;
  }

  /** @param {import('../tools/career/domain/types.js').CareerMap} map */
  _renderCities(map) {
    return html`
      <details open>
      <summary class="sub">Casas (${map.cities.length})</summary>
      ${this.readOnly
        ? null
        : html`<div class="toolbar">
            <input type="text" placeholder="id (p. ej. react)" .value=${this._newCity.id}
              @input=${(e) => { this._newCity = { ...this._newCity, id: e.target.value }; }} />
            <input type="text" placeholder="Nombre" .value=${this._newCity.name}
              @input=${(e) => { this._newCity = { ...this._newCity, name: e.target.value }; }} />
            <button class="primary" ?disabled=${!this._newCity.id.trim() || !this._newCity.name.trim()} @click=${() => this._addCity()}>Añadir casa</button>
          </div>`}
      ${map.cities.length === 0
        ? html`<p class="empty">Aún no hay casas.</p>`
        : html`<div class="cities">${map.cities.map((c, idx) => this._renderCity(map, c, idx))}</div>`}
      </details>
    `;
  }

  /**
   * @param {import('../tools/career/domain/types.js').CareerMap} map
   * @param {import('../tools/career/domain/types.js').City} c
   * @param {number} idx
   */
  _renderCity(map, c, idx) {
    return html`
      <details class="city">
        <summary class="city-head">
          <span class="cid">${c.name || c.id} <span class="muted">(${c.id})</span>${c.deprecated ? html` · <span class="muted">deprecada</span>` : null}</span>
          <span @click=${(e) => e.stopPropagation()}>
            ${this.readOnly
              ? null
              : this._confirmCity === c.id
                ? html`<span class="confirm">¿Borrar casa?
                    <button class="yes" @click=${() => this._deleteCity(c.id)}>Sí</button>
                    <button @click=${() => { this._confirmCity = null; }}>No</button>
                  </span>`
                : html`<button class="del-btn" @click=${() => { this._confirmCity = c.id; this._mapError = ''; }}>Borrar</button>`}
          </span>
        </summary>
        <div class="fields">
          <label>Nombre
            <input type="text" .value=${c.name} ?disabled=${this.readOnly} @input=${(e) => this._patchCity(idx, { name: e.target.value })} />
          </label>
          <label>Comarca
            <select ?disabled=${this.readOnly} @change=${(e) => this._patchCity(idx, { area: e.target.value })}>
              <option value="" ?selected=${!c.area}>— sin comarca —</option>
              ${map.areas.map((a) => html`<option value=${a.id} ?selected=${a.id === c.area}>${a.name}</option>`)}
            </select>
          </label>
          <label>Tipo
            <select ?disabled=${this.readOnly} @change=${(e) => this._patchCity(idx, { kind: e.target.value })}>
              ${CITY_KINDS.map((k) => html`<option value=${k} ?selected=${k === c.kind}>${k}</option>`)}
            </select>
          </label>
          <label>Peso
            <input type="number" min="0" step="1" .value=${String(c.weight)} ?disabled=${this.readOnly} @input=${(e) => this._patchCity(idx, { weight: Number(e.target.value) })} />
          </label>
          <label>X (0..100)
            <input type="number" min="0" max="100" step="1" .value=${String(c.x)} ?disabled=${this.readOnly} @input=${(e) => this._patchCity(idx, { x: Number(e.target.value) })} />
          </label>
          <label>Y (0..100)
            <input type="number" min="0" max="100" step="1" .value=${String(c.y)} ?disabled=${this.readOnly} @input=${(e) => this._patchCity(idx, { y: Number(e.target.value) })} />
          </label>
          <label class="check">
            <input type="checkbox" .checked=${c.deprecated === true} ?disabled=${this.readOnly} @change=${(e) => this._patchCity(idx, { deprecated: e.target.checked || undefined })} />
            Deprecada
          </label>
          <label class="full">Prerequisitos
            <select multiple size="4" ?disabled=${this.readOnly} @change=${(e) => this._setPrereqs(idx, e.target)}>
              ${map.cities
                .filter((other) => other.id !== c.id)
                .map((other) => html`<option value=${other.id} ?selected=${c.prereqs.includes(other.id)}>${other.name} (${other.id})</option>`)}
            </select>
          </label>
          <label class="full">Qué aprender — puntos fundamentales (uno por línea)
            <textarea
              rows="4"
              placeholder="Un punto fundamental por línea…"
              .value=${(c.keyPoints ?? []).join('\n')}
              ?disabled=${this.readOnly}
              @input=${(e) => this._patchCity(idx, { keyPoints: e.target.value.split('\n') })}
            ></textarea>
          </label>
          <label class="full">Con IA — qué puede hacer la IA por ti y dónde profundizar tú
            <textarea
              rows="3"
              placeholder="Lente era-IA: qué delega el jugador en la IA y qué debe dominar él…"
              .value=${c.aiFocus ?? ''}
              ?disabled=${this.readOnly}
              @input=${(e) => this._patchCity(idx, { aiFocus: e.target.value })}
            ></textarea>
          </label>
        </div>
        <div class="recs-edit">
          <div class="recs-head">
            <span>Recursos</span>
            ${this.readOnly ? null : html`<button @click=${() => this._addResource(idx)}>+ Añadir</button>`}
          </div>
          ${(c.resources ?? []).length === 0
            ? html`<p class="empty">Sin recursos todavía.</p>`
            : (c.resources ?? []).map(
                (r, resIdx) => html`<div class="res-row">
                  <select aria-label="Tipo de recurso" ?disabled=${this.readOnly} @change=${(e) => this._patchResource(idx, resIdx, { kind: e.target.value })}>
                    ${RESOURCE_KINDS.map((k) => html`<option value=${k} ?selected=${k === r.kind}>${k}</option>`)}
                  </select>
                  <input type="text" placeholder="Etiqueta" .value=${r.label ?? ''} ?disabled=${this.readOnly} @input=${(e) => this._patchResource(idx, resIdx, { label: e.target.value })} />
                  <input type="url" placeholder="https://… (opcional)" .value=${r.url ?? ''} ?disabled=${this.readOnly} @input=${(e) => this._patchResource(idx, resIdx, { url: e.target.value })} />
                  ${r.kind === 'libro'
                    ? html`<select aria-label="Formato del libro" ?disabled=${this.readOnly} @change=${(e) => this._patchResource(idx, resIdx, { format: e.target.value })}>
                        <option value="" ?selected=${!r.format}>— formato —</option>
                        ${RESOURCE_FORMATS.map((f) => html`<option value=${f} ?selected=${f === r.format}>${f}</option>`)}
                      </select>`
                    : html`<span></span>`}
                  ${this.readOnly ? null : html`<button class="del-btn" @click=${() => this._removeResource(idx, resIdx)}>×</button>`}
                </div>`,
              )}
        </div>
        <div class="recs-edit">
          <div class="recs-head">
            <span>Recomendaciones (legado — la tarjeta las usa solo si no hay recursos)</span>
            ${this.readOnly ? null : html`<button @click=${() => this._addRecommendation(idx)}>+ Añadir</button>`}
          </div>
          ${(c.recommendations ?? []).length === 0
            ? html`<p class="empty">Sin recomendaciones.</p>`
            : (c.recommendations ?? []).map(
                (r, recIdx) => html`<div class="rec-row">
                  <select ?disabled=${this.readOnly} @change=${(e) => this._patchRecommendation(idx, recIdx, { kind: e.target.value })}>
                    ${REC_KINDS.map((k) => html`<option value=${k} ?selected=${k === r.kind}>${k}</option>`)}
                  </select>
                  <input type="text" placeholder="Etiqueta" .value=${r.label ?? ''} ?disabled=${this.readOnly} @input=${(e) => this._patchRecommendation(idx, recIdx, { label: e.target.value })} />
                  <input type="url" placeholder="https://… (opcional)" .value=${r.url ?? ''} ?disabled=${this.readOnly} @input=${(e) => this._patchRecommendation(idx, recIdx, { url: e.target.value })} />
                  ${this.readOnly ? null : html`<button class="del-btn" @click=${() => this._removeRecommendation(idx, recIdx)}>×</button>`}
                </div>`,
              )}
        </div>
      </details>
    `;
  }

  // ── Framework de carrera (render) ──────────────────────────────────────────

  _renderFramework() {
    const fw = this._framework;
    return html`
      <section>
        <h2>Framework de carrera</h2>
        <p class="ro-note">Catálogo global de la organización: itinerarios (tracks), niveles, disciplinas y dimensiones. Los cambios se aplican al guardar.</p>
        ${this._fwError ? html`<p class="error">${this._fwError}</p>` : null}
        ${this._fwNotice ? html`<p class="notice">${this._fwNotice}</p>` : null}
        ${!fw
          ? html`<p class="empty">Cargando el framework…</p>`
          : html`
              ${this._renderNamedSection('tracks', 'Tracks', 'track', 'track', fw.tracks, 'Itinerarios de carrera dentro de la organización. Ejemplos: Individual Contributor, Management.')}
              ${this._renderFwLevels(fw)}
              ${this._renderNamedSection('disciplines', 'Disciplinas', 'disciplina', 'discipline', fw.disciplines, 'Disciplina = familia de carrera que matiza las expectativas de cada nivel; la gestiona el superadmin. Ejemplos: Backend, Web/Frontend, Infra/Platform, Data/ML, Mobile.')}
              ${this._renderNamedSection('dimensions', 'Dimensiones', 'dimensión', 'dimension', fw.dimensions, 'Ejes de evaluación de cada nivel. Ejemplos: Technical Excellence, Reliability, Product.')}
              ${this._renderFwExpectations(fw)}
              ${this._renderFwAddendums(fw)}
              ${this.readOnly
                ? null
                : html`
                    <div class="toolbar" style="margin-top:1rem">
                      <button class="primary" ?disabled=${this._fwSaving} @click=${() => this._saveFramework()}>
                        ${this._fwSaving ? 'Guardando…' : 'Guardar framework'}
                      </button>
                    </div>
                  `}
            `}
      </section>
    `;
  }

  /**
   * Sección de items con nombre (tracks/disciplinas/dimensiones: misma forma).
   * @param {'tracks'|'disciplines'|'dimensions'} kind
   * @param {string} title @param {string} singular
   * @param {'track'|'discipline'|'dimension'} field  clave en _fwNew
   * @param {Array<import('../tools/career/data/framework.js').NamedItem>} items
   * @param {string} [hint]  explicación breve del eje (qué es + ejemplos)
   */
  _renderNamedSection(kind, title, singular, field, items, hint = '') {
    const sorted = [...items].toSorted((a, b) => a.order - b.order);
    return html`
      <details open>
        <summary class="sub">${title} (${items.length})</summary>
        ${hint ? html`<p class="ro-note">${hint}</p>` : null}
        ${this.readOnly
          ? null
          : html`<div class="toolbar">
              <input type="text" placeholder=${`Nombre del ${singular}`} .value=${this._fwNew[field]}
                @input=${(e) => { this._fwNew = { ...this._fwNew, [field]: e.target.value }; }} />
              <button class="primary" ?disabled=${!this._fwNew[field].trim()} @click=${() => this._addNamed(kind, field, singular)}>Añadir ${singular}</button>
            </div>`}
        ${items.length === 0
          ? html`<p class="empty">Aún no hay ${singular}s.</p>`
          : html`<div class="cities">${sorted.map((it, i) => this._renderNamedCard(kind, it, i, sorted.length))}</div>`}
      </details>
    `;
  }

  /**
   * @param {'tracks'|'disciplines'|'dimensions'} kind
   * @param {import('../tools/career/data/framework.js').NamedItem} it
   * @param {number} pos @param {number} total
   */
  _renderNamedCard(kind, it, pos, total) {
    return html`
      <div class="city">
        <div class="city-head">
          <span class="cid">${it.name || it.id} <span class="muted">(${it.id})</span></span>
          <span>
            ${this.readOnly
              ? null
              : html`
                  <button class="ord-btn" ?disabled=${pos === 0} title="Subir" @click=${() => this._moveFwItem(kind, it.id, -1)}>↑</button>
                  <button class="ord-btn" ?disabled=${pos === total - 1} title="Bajar" @click=${() => this._moveFwItem(kind, it.id, 1)}>↓</button>
                  ${this._isFwConfirm(kind, it.id)
                    ? html`<span class="confirm">¿Borrar?
                        <button class="yes" @click=${() => this._deleteFwItem(kind, it.id)}>Sí</button>
                        <button @click=${() => { this._fwConfirm = null; }}>No</button>
                      </span>`
                    : html`<button class="del-btn" @click=${() => { this._fwConfirm = { kind, id: it.id }; this._fwError = ''; }}>Borrar</button>`}
                `}
          </span>
        </div>
        <div class="fields">
          <label>Nombre
            <input type="text" .value=${it.name} ?disabled=${this.readOnly} @input=${(e) => this._patchFwItem(kind, it.id, { name: e.target.value })} />
          </label>
          <label class="full">Descripción
            <input type="text" .value=${it.description ?? ''} ?disabled=${this.readOnly} @input=${(e) => this._patchFwItem(kind, it.id, { description: e.target.value })} />
          </label>
        </div>
      </div>
    `;
  }

  /** @param {import('../tools/career/data/framework.js').CareerFramework} fw */
  _renderFwLevels(fw) {
    const sorted = [...fw.levels].toSorted((a, b) => a.order - b.order);
    return html`
      <details open>
        <summary class="sub">Niveles (${fw.levels.length})</summary>
        <p class="ro-note">Escalones de cada track (p. ej. L1…L7); a cada persona se le asigna uno.</p>
        ${this.readOnly
          ? null
          : html`<div class="toolbar">
                <input type="text" placeholder="Código (p. ej. L2)" .value=${this._fwNew.levelCode}
                  @input=${(e) => { this._fwNew = { ...this._fwNew, levelCode: e.target.value }; }} />
                <input type="text" placeholder="Título (p. ej. Senior Engineer)" .value=${this._fwNew.levelTitle}
                  @input=${(e) => { this._fwNew = { ...this._fwNew, levelTitle: e.target.value }; }} />
                <button class="primary" ?disabled=${!this._fwNew.levelCode.trim() || !this._fwNew.levelTitle.trim() || fw.tracks.length === 0} @click=${() => this._addLevel()}>Añadir nivel</button>
              </div>
              ${fw.tracks.length === 0 ? html`<p class="ro-note">Crea al menos un track antes de añadir niveles.</p>` : null}`}
        ${fw.levels.length === 0
          ? html`<p class="empty">Aún no hay niveles.</p>`
          : html`<div class="cities">${sorted.map((l, i) => this._renderLevelCard(fw, l, i, sorted.length))}</div>`}
      </details>
    `;
  }

  /**
   * @param {import('../tools/career/data/framework.js').CareerFramework} fw
   * @param {import('../tools/career/data/framework.js').Level} l
   * @param {number} pos @param {number} total
   */
  _renderLevelCard(fw, l, pos, total) {
    return html`
      <div class="city">
        <div class="city-head">
          <span class="cid">${l.code || l.title} <span class="muted">(${l.id})</span></span>
          <span>
            ${this.readOnly
              ? null
              : html`
                  <button class="ord-btn" ?disabled=${pos === 0} title="Subir" @click=${() => this._moveFwItem('levels', l.id, -1)}>↑</button>
                  <button class="ord-btn" ?disabled=${pos === total - 1} title="Bajar" @click=${() => this._moveFwItem('levels', l.id, 1)}>↓</button>
                  ${this._isFwConfirm('levels', l.id)
                    ? html`<span class="confirm">¿Borrar nivel?
                        <button class="yes" @click=${() => this._deleteFwItem('levels', l.id)}>Sí</button>
                        <button @click=${() => { this._fwConfirm = null; }}>No</button>
                      </span>`
                    : html`<button class="del-btn" @click=${() => { this._fwConfirm = { kind: 'levels', id: l.id }; this._fwError = ''; }}>Borrar</button>`}
                `}
          </span>
        </div>
        <div class="fields">
          <label>Código
            <input type="text" .value=${l.code} ?disabled=${this.readOnly} @input=${(e) => this._patchFwItem('levels', l.id, { code: e.target.value })} />
          </label>
          <label>Título
            <input type="text" .value=${l.title} ?disabled=${this.readOnly} @input=${(e) => this._patchFwItem('levels', l.id, { title: e.target.value })} />
          </label>
          <label>Track
            <select ?disabled=${this.readOnly} @change=${(e) => this._patchFwItem('levels', l.id, { trackId: e.target.value })}>
              ${fw.tracks.map((t) => html`<option value=${t.id} ?selected=${t.id === l.trackId}>${t.name}</option>`)}
            </select>
          </label>
          <label>Ramifica desde
            <select ?disabled=${this.readOnly} @change=${(e) => this._patchFwItem('levels', l.id, { branchesFrom: e.target.value || null })}>
              <option value="" ?selected=${!l.branchesFrom}>— ninguno —</option>
              ${fw.levels
                .filter((o) => o.id !== l.id)
                .map((o) => html`<option value=${o.id} ?selected=${o.id === l.branchesFrom}>${o.code || o.title} (${o.id})</option>`)}
            </select>
          </label>
          <label>Perfil típico
            <input type="text" .value=${l.typicalProfile ?? ''} ?disabled=${this.readOnly} @input=${(e) => this._patchFwItem('levels', l.id, { typicalProfile: e.target.value })} />
          </label>
          <label class="full">Descripción
            <input type="text" .value=${l.description ?? ''} ?disabled=${this.readOnly} @input=${(e) => this._patchFwItem('levels', l.id, { description: e.target.value })} />
          </label>
        </div>
      </div>
    `;
  }

  /**
   * Matriz de expectativas: se elige un nivel y se edita, para ese nivel, la
   * expectativa de cada dimensión (una fila = una celda Nivel × Dimensión).
   * Editar por-nivel evita pintar toda la matriz (48 celdas) a la vez.
   * @param {import('../tools/career/data/framework.js').CareerFramework} fw
   */
  _renderFwExpectations(fw) {
    const levels = [...fw.levels].toSorted((a, b) => a.order - b.order);
    const dims = [...fw.dimensions].toSorted((a, b) => a.order - b.order);
    const levelId = levels.some((l) => l.id === this._fwExpLevel) ? this._fwExpLevel : (levels[0]?.id ?? '');
    return html`
      <details>
        <summary class="sub">Matriz de expectativas (${fw.expectations.length})</summary>
        ${levels.length === 0 || dims.length === 0
          ? html`<p class="empty">Necesitas al menos un nivel y una dimensión para editar la matriz.</p>`
          : html`
              <div class="toolbar">
                <label class="matrix-pick">Nivel
                  <select ?disabled=${this.readOnly} @change=${(e) => { this._fwExpLevel = e.target.value; }}>
                    ${levels.map((l) => html`<option value=${l.id} ?selected=${l.id === levelId}>${l.code} · ${l.title}</option>`)}
                  </select>
                </label>
              </div>
              <div class="matrix">
                ${dims.map((d) => html`
                  <label class="matrix-row">
                    <span class="matrix-dim">${d.name}</span>
                    <textarea rows="2" placeholder="Qué se espera en esta dimensión para el nivel elegido…"
                      ?disabled=${this.readOnly}
                      .value=${this._expectationText(levelId, d.id)}
                      @input=${(e) => this._setExpectation(levelId, d.id, e.target.value)}></textarea>
                  </label>
                `)}
              </div>`}
      </details>
    `;
  }

  /**
   * Addendums por disciplina: se elige una disciplina y se edita, para esa
   * disciplina, el foco de cada dimensión (sección 10 del documento).
   * @param {import('../tools/career/data/framework.js').CareerFramework} fw
   */
  _renderFwAddendums(fw) {
    const disciplines = [...fw.disciplines].toSorted((a, b) => a.order - b.order);
    const dims = [...fw.dimensions].toSorted((a, b) => a.order - b.order);
    const disciplineId = disciplines.some((d) => d.id === this._fwAddDiscipline) ? this._fwAddDiscipline : (disciplines[0]?.id ?? '');
    return html`
      <details>
        <summary class="sub">Addendums por disciplina (${fw.addendums.length})</summary>
        ${disciplines.length === 0 || dims.length === 0
          ? html`<p class="empty">Necesitas al menos una disciplina y una dimensión para editar los addendums.</p>`
          : html`
              <div class="toolbar">
                <label class="matrix-pick">Disciplina
                  <select ?disabled=${this.readOnly} @change=${(e) => { this._fwAddDiscipline = e.target.value; }}>
                    ${disciplines.map((d) => html`<option value=${d.id} ?selected=${d.id === disciplineId}>${d.name}</option>`)}
                  </select>
                </label>
              </div>
              <div class="matrix">
                ${dims.map((dim) => html`
                  <label class="matrix-row">
                    <span class="matrix-dim">${dim.name}</span>
                    <textarea rows="2" placeholder="Foco de esta dimensión en la disciplina elegida…"
                      ?disabled=${this.readOnly}
                      .value=${this._addendumText(disciplineId, dim.id)}
                      @input=${(e) => this._setAddendum(disciplineId, dim.id, e.target.value)}></textarea>
                  </label>
                `)}
              </div>`}
      </details>
    `;
  }

  _renderLeaders() {
    return html`
      <section>
        <h2>Líderes (${this.leaders.length})</h2>
        <p class="ro-note">Da de alta a los líderes por su email (deben haber iniciado sesión al menos una vez). Pincha un líder para ver su equipo.</p>
        ${this.readOnly
          ? null
          : html`<div class="toolbar">
              <input
                type="email"
                placeholder="email@dominio.com"
                .value=${this._email}
                @input=${(e) => { this._email = e.target.value; }}
              />
              <button class="primary" ?disabled=${!this._email.trim()} @click=${() => this._addLeader()}>Añadir líder</button>
            </div>`}
        ${this.leaders.length === 0
          ? html`<p class="empty">Aún no hay líderes dados de alta.</p>`
          : html`<table>
              <thead><tr><th>Nombre</th><th>Email</th><th></th></tr></thead>
              <tbody>
                ${this.leaders.map(
                  (l) => html`
                    <tr class="clickable ${this.selected?.uid === l.uid ? 'sel' : ''}" @click=${() => this._openTeam(l)}>
                      <td>${l.displayName ?? '—'}</td>
                      <td class="muted">${l.email ?? '—'}</td>
                      <td @click=${(e) => e.stopPropagation()}>
                        ${this.readOnly ? null : html`<button class="del-btn" @click=${() => this._removeLeader(l.uid)}>Quitar</button>`}
                      </td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>`}
      </section>
    `;
  }

  _renderTeam() {
    const name = this.selected.displayName ?? this.selected.email ?? this.selected.uid;
    return html`
      <section>
        <h2>Equipo de ${name}</h2>
        <p class="ro-note">Vista de solo lectura. La gestión de cada persona la hace su líder.</p>
        ${this.teamLoading
          ? html`<p class="empty">Cargando equipo…</p>`
          : this.team.length === 0
            ? html`<p class="empty">Este líder aún no tiene personas en su equipo.</p>`
            : html`<table>
                <thead><tr><th>Persona</th><th>Gremios</th><th>Rol dominante</th><th>Completitud</th></tr></thead>
                <tbody>
                  ${this.team.map(
                    (p) => html`
                      <tr>
                        <td>${p.name}</td>
                        <td class="muted">${(p.guilds ?? []).join(', ') || '—'}</td>
                        <td>${p.profile?.dominantRole ?? html`<span class="muted">—</span>`}</td>
                        <td>${p.profile?.completion != null ? `${p.profile.completion}%` : '—'}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>`}
      </section>
    `;
  }

  _renderUsers() {
    // Defensa en profundidad: un viewer nunca gestiona usuarios, aunque no
    // debería poder llegar a este tab (el botón de la pestaña está oculto).
    if (this.readOnly) return null;
    return html`
      <section>
        <h2>Usuarios (${this._users.length})</h2>
        <p class="ro-note">
          Da de alta un viewer o un líder por su email (deben haber iniciado sesión al menos una vez).
          Para un superadmin nuevo usa <code>pnpm seed:leaders</code> o la función <code>grantAdmin</code> fuera de este panel;
          aquí solo puedes promoverlo a superadmin si ya aparece en la lista.
        </p>
        <div class="toolbar">
          <input
            type="email"
            placeholder="email@dominio.com"
            .value=${this._newUserEmail}
            @input=${(e) => { this._newUserEmail = e.target.value; }}
          />
          <select @change=${(e) => { this._newUserRole = e.target.value; }}>
            <option value="viewer" ?selected=${this._newUserRole === 'viewer'}>Viewer</option>
            <option value="leader" ?selected=${this._newUserRole === 'leader'}>Líder</option>
          </select>
          <button class="primary" ?disabled=${!this._newUserEmail.trim()} @click=${() => this._addUser()}>Añadir usuario</button>
        </div>
        ${this._usersError ? html`<p class="error">${this._usersError}</p>` : null}
        ${this._usersNotice ? html`<p class="notice">${this._usersNotice}</p>` : null}
        ${this._users.length === 0
          ? html`<p class="empty">Aún no ha iniciado sesión nadie.</p>`
          : html`<table>
              <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Última conexión</th><th></th></tr></thead>
              <tbody>
                ${this._users.map((u) => this._renderUserRow(u))}
              </tbody>
            </table>`}
      </section>
      ${this._renderAssignModal()}
    `;
  }

  /** @param {import('../lib/accessRoles.js').AccessUser} user */
  _renderUserRow(user) {
    const pending = this._confirmRoleChange?.uid === user.uid ? this._confirmRoleChange : null;
    const linked = this._isLinked(user);
    return html`
      <tr>
        <td>${user.displayName ?? '—'}</td>
        <td class="muted">${user.email ?? '—'}</td>
        <td>
          <span class="badge" style=${`background:${ROLE_COLOR[user.role]}`}>${ROLE_LABEL[user.role]}</span>
          ${linked ? html`<span class="badge linked" title="Vinculado a una persona">Vinculado</span>` : null}
        </td>
        <td class="muted">${formatLogin(user.lastLogin)}</td>
        <td>
          ${pending
            ? html`<span class="confirm">¿Aplicar «${this._roleChangeLabel(pending.role)}»?
                <button class="yes" @click=${() => this._changeUserRole(user, pending.role)}>Sí</button>
                <button @click=${() => { this._confirmRoleChange = null; }}>No</button>
              </span>`
            : html`<div class="row-actions">
                <select @change=${(e) => { this._confirmRoleChange = { uid: user.uid, role: e.target.value }; }}>
                  <option value="" disabled selected>Cambiar rol…</option>
                  <option value="superadmin">Superadmin</option>
                  <option value="viewer">Viewer</option>
                  <option value="leader">Líder</option>
                  <option value="none">Quitar acceso</option>
                </select>
                ${user.role === 'none' && !linked
                  ? html`<button class="act" type="button" @click=${() => this._openAssign(user)}>Asignar a equipo</button>`
                  : null}
              </div>`}
        </td>
      </tr>
    `;
  }

  _renderAssignModal() {
    const user = this._assignFor;
    const who = user ? (user.displayName ?? user.email ?? user.uid) : '';
    const heading = user ? `Asignar a equipo · ${who}` : 'Asignar a equipo';
    return html`
      <app-modal .open=${!!user} heading=${heading} @close=${() => this._closeAssign()}>
        ${user
          ? html`
              <div class="assign-body">
                <p class="ro-note">
                  Se creará una persona vinculada a esta cuenta en el equipo del líder elegido. La
                  cuenta podrá ver su propia ficha en solo lectura.
                </p>
                <label class="assign-field">Líder
                  <select .value=${this._assignLeader} @change=${(e) => { this._assignLeader = e.target.value; }}>
                    <option value="">— Elige un líder —</option>
                    ${this.leaders.map((l) => html`<option value=${l.uid}>${l.displayName ?? l.email ?? l.uid}</option>`)}
                  </select>
                </label>
                ${this._usersError ? html`<p class="error">${this._usersError}</p>` : null}
                <div class="assign-actions">
                  <button type="button" @click=${() => this._closeAssign()}>Cancelar</button>
                  <button class="primary" type="button" ?disabled=${!this._assignLeader} @click=${() => this._assign()}>Asignar</button>
                </div>
              </div>
            `
          : null}
      </app-modal>
    `;
  }
}

if (!customElements.get('superadmin-panel')) {
  customElements.define('superadmin-panel', SuperadminPanel);
}
