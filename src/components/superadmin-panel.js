/**
 * <superadmin-panel>
 * Vista de gestión del superadmin (separada de la vista de manager). Lista los
 * managers de la instancia (alta por email vía Cloud Function, baja) y permite
 * ver el equipo de cada manager (personas y su perfil Role Mirror) en LECTURA.
 * Si el superadmin es además manager, "Usar como manager" lo lleva a las herramientas.
 * También gestiona el catálogo de accesos (pestaña Usuarios): quién tiene
 * acceso (superadmin/viewer/manager) y permite cambiar el rol de cada uno.
 *
 * Propiedades:
 *  - ready: boolean  (lo activa el glue cuando hay sesión de gestión)
 *  - isLeader: boolean  (si el superadmin también es manager → botón "Usar como manager")
 *  - readOnly: boolean  (viewer: mismo panel, sin controles mutables ni pestaña Usuarios)
 */
import { LitElement, html, css } from 'lit';
import './app-modal.js';
import './admin/game-editor.js';
import {
  listLeaders, addLeaderByEmail, removeLeader, renameLeader, grantAdminByEmail,
  listSupermanagers, setLeaderReportsTo,
} from '../lib/leaders.js';
import { addViewerByEmail } from '../lib/viewers.js';
import './catalog-manager.js';
import { listAllUsers, setUserRole, setUserDisplayName, listLinkedUids, assignUserToLeader } from '../lib/users.js';
import { createTeamContainer } from '../tools/team/composition/container.js';
import { listActivePeople } from '../tools/team/application/usecases/index.js';
import { getPersonProfile } from '../lib/firestore.js';
import { getFramework, saveFramework } from '../lib/careerFramework.js';

const CITY_KINDS = ['tech', 'skill', 'milestone'];
const REC_KINDS = ['curso', 'formacion', 'doc', 'titulo'];

/**
 * Genera un id estable a partir de un texto (nombre/código): minúsculas, sin
 * acentos, separadores → guiones. @param {string} text @returns {string}
 */
function slugify(text) {
  return String(text ?? '')
    .normalize('NFD').replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase().trim()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replace(/^-/u, '')
    .replace(/-$/u, '');
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
const ROLE_LABEL = { superadmin: 'Superadmin', supermanager: 'Head', viewer: 'Viewer', leader: 'Manager', none: 'Sin rol' };
// El violeta del Head contrasta AA sobre el texto blanco del badge, igual que los demás.
const ROLE_COLOR = { superadmin: '#dc2626', supermanager: '#6d28d9', viewer: '#6b7280', leader: '#3b82f6', none: '#9ca3af' };
const loginFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' });
/** @param {unknown} ts Firestore Timestamp | number | null */
function formatLogin(ts) {
  const ms = ts && typeof (/** @type {any} */ (ts).toMillis) === 'function'
    ? /** @type {any} */ (ts).toMillis()
    : (typeof ts === 'number' ? ts : 0);
  return ms ? loginFmt.format(new Date(ms)) : '—';
}

const VIEW_FLAG = 'grebla-view';
const TABS = ['leaders', 'areas', 'guilds', 'squads', 'labels', 'career', 'users'];
/** Hashes legados de las dos pestañas de carrera, ahora sub-pestañas de «career»
 *  (RMR-TSK-0262): siguen aterrizando en su sub-pestaña correcta. */
const LEGACY_CAREER_HASH = { careerMap: 'map', careerFramework: 'framework' };
/** Traduce un hash a { tab, sub? }: los hashes legados de carrera van a «career». */
function resolveHash(raw) {
  if (raw in LEGACY_CAREER_HASH) return { tab: 'career', sub: LEGACY_CAREER_HASH[raw] };
  if (TABS.includes(raw)) return { tab: raw };
  return { tab: 'leaders' };
}

/** Sub-pestañas del framework de carrera: 4 catálogos + 2 matrices de cruce. */
const FW_SUBTABS = /** @type {const} */ ([
  ['tracks', 'Tracks y niveles'],
  ['disciplines', 'Disciplinas'],
  ['dimensions', 'Dimensiones'],
  ['expectations', 'Expectativas'],
  ['addendums', 'Addendums'],
]);

export class SuperadminPanel extends LitElement {
  static properties = {
    ready: { attribute: false },
    isLeader: { attribute: false },
    readOnly: { attribute: false },
    persistence: { attribute: false },
    currentUid: { attribute: false },
    _tab: { state: true },
    _careerSub: { state: true },
    leaders: { state: true },
    _supermanagers: { state: true },
    selected: { state: true },
    team: { state: true },
    teamLoading: { state: true },
    _email: { state: true },
    _error: { state: true },
    _editLeaderUid: { state: true },
    _editLeaderName: { state: true },
    _superadminEmail: { state: true },
    _superadminNotice: { state: true },
    _editUserUid: { state: true },
    _editUserName: { state: true },
    _framework: { state: true },
    _fwNew: { state: true },
    _fwExpLevel: { state: true },
    _fwAddDiscipline: { state: true },
    _fwConfirm: { state: true },
    _fwError: { state: true },
    _fwNotice: { state: true },
    _fwSaving: { state: true },
    _fwSubtab: { state: true },
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
    :host {
      display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827);
      /* Fondo sutil de los campos (RMR-TSK-0266): los diferencia de la tarjeta
         sin rechinar. Derivado del tema (mezcla texto→superficie), así vale en
         claro (gris muy claro) y en oscuro (un pelín más claro que la tarjeta);
         al enfocar pasan a la superficie (campo activo). */
      --rm-field: color-mix(in srgb, var(--rm-text, #111827) 5%, var(--rm-surface, #fff));
    }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .bar h1 { font-size: 1.4rem; margin: 0; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280);
      border-radius: 999px; padding: 0.4rem 1rem; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: var(--rm-on-accent, #fff); }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    /* Sub-pestañas del framework de carrera: más pequeñas y cuadradas que las
       pestañas principales (píldoras), para que se lean como un segundo nivel. */
    .subtabs { display: flex; gap: 0.35rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .subtab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280);
      border-radius: 8px; padding: 0.35rem 0.85rem; font-size: 0.82rem; font-weight: 600; cursor: pointer;
    }
    .subtab.active { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: var(--rm-on-accent, #fff); }
    .subtab:hover:not(.active) { color: var(--rm-text, #111827); border-color: var(--rm-accent, #3b82f6); }
    /* Sub-pestañas de «Carrera» (RMR-TSK-0262): estilo SUBRAYADO —distinto de las
       píldoras .subtab del editor de framework— para que no se apilen dos filas
       idénticas cuando el framework pinta sus propias sub-pestañas dentro. */
    .csubtabs { display: flex; gap: 1.1rem; margin: 0 0 1.25rem; border-bottom: 1px solid var(--rm-border, #e5e7eb); flex-wrap: wrap; }
    .csubtab {
      border: 0; background: none; color: var(--rm-muted, #6b7280); font-size: 0.92rem; font-weight: 700;
      padding: 0.45rem 0.1rem; margin-bottom: -1px; border-bottom: 2px solid transparent; cursor: pointer;
    }
    .csubtab.on { color: var(--rm-accent, #3b82f6); border-bottom-color: var(--rm-accent, #3b82f6); }
    .csubtab:hover:not(.on) { color: var(--rm-text, #111827); }
    .csubtab:focus-visible { outline: 2px solid var(--rm-accent, #3b82f6); outline-offset: 2px; }
    /* Grupo de track: contenedor plegable con sus niveles anidados dentro. */
    details.track-group { margin-bottom: 0.9rem; }
    details.track-group > summary { list-style: none; }
    details.track-group > summary::-webkit-details-marker { display: none; }
    .track-group .nested-levels { margin-top: 0.9rem; padding-top: 0.75rem; border-top: 1px dashed var(--rm-border, #e5e7eb); }
    .track-group .nested-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
    .track-group .nested-head .sub { margin: 0; }
    /* Glifo de la forma de casa de una comarca (RMR-TSK-0233): pista visual de
       qué silueta usarán sus casas en el mapa. */
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    h2 { font-size: 1.1rem; margin: 0 0 1rem; }
    .toolbar { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    input {
      padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db);
      font: inherit; font-size: 0.9rem; min-width: 16rem; background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827);
    }
    input:focus, select:focus, textarea:focus { background: var(--rm-surface, #fff); }
    button {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.45rem 0.9rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary { background: var(--rm-accent, #3b82f6); border-color: var(--rm-accent, #3b82f6); color: var(--rm-on-accent, #fff); }
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
    .superadmin-alta { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--rm-border, #e5e7eb); }
    .superadmin-alta h3 { font-size: 0.95rem; margin: 0 0 0.35rem; color: var(--rm-text, #111827); }
    .act { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 6px; padding: 0.25rem 0.6rem; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .act:hover { border-color: var(--rm-accent, #3b82f6); color: var(--rm-accent, #3b82f6); }
    .badge.linked { background: #0d9488; margin-left: 0.35rem; }
    .assign-body { display: flex; flex-direction: column; gap: 0.9rem; }
    .assign-field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; font-weight: 600; color: var(--rm-muted, #6b7280); }
    .assign-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
    select { padding: 0.4rem 0.5rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); font: inherit; font-size: 0.85rem; }
    .cities { display: grid; gap: 0.9rem; }
    .city { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.8rem 1rem; background: var(--rm-surface, #fff); }
    .city-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.6rem; }
    .city-head .cid { font-weight: 700; font-family: ui-monospace, monospace; font-size: 0.85rem; }
    /* ── Tarjeta de NIVEL destacada (RMR-TSK-0266): badge de código + rail de
       acento, para que los niveles de un track se distingan de un vistazo. ── */
    .city.level { border-left: 4px solid var(--rm-accent, #3b82f6); background: linear-gradient(90deg, color-mix(in srgb, var(--rm-accent, #3b82f6) 5%, var(--rm-surface, #fff)) 0%, var(--rm-surface, #fff) 30%); }
    .lvl-id { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
    .lvl-badge {
      flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
      min-width: 2.6rem; height: 1.95rem; padding: 0 0.55rem;
      background: var(--rm-accent, #3b82f6); color: var(--rm-on-accent, #fff);
      border-radius: 8px; font-weight: 800; font-size: 0.9rem; letter-spacing: 0.01em;
      font-variant-numeric: tabular-nums;
    }
    .lvl-title { font-weight: 700; font-size: 0.95rem; color: var(--rm-navy, #1e3a5f); min-width: 0; }
    .lvl-title .muted { font-weight: 500; font-family: ui-monospace, monospace; font-size: 0.76rem; }
    /* Cabecera del TRACK: acento propio + chevron de plegado, distinta de los
       niveles que contiene (jerarquía visual). */
    details.track-group > summary.city-head {
      background: color-mix(in srgb, var(--rm-navy, #1e3a5f) 8%, var(--rm-surface, #fff));
      margin: -0.8rem -1rem 0; padding: 0.7rem 1rem; border-radius: 9px 9px 0 0;
    }
    details.track-group > summary .cid::before {
      content: '▸'; display: inline-block; margin-right: 0.5rem; color: var(--rm-accent, #3b82f6);
      transition: transform 0.15s; font-size: 0.85em;
    }
    details.track-group[open] > summary .cid::before { transform: rotate(90deg); }
    details.track-group > summary .cid { color: var(--rm-navy, #1e3a5f); font-family: inherit; font-size: 0.95rem; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; }
    /* Afordancia de edición (RMR-TSK-0266): foco con acento; solo-lectura apagado. */
    .fields input:focus-visible, .fields select:focus-visible, .fields textarea:focus-visible {
      outline: 2px solid var(--rm-accent, #3b82f6); outline-offset: 1px; border-color: var(--rm-accent, #3b82f6);
    }
    .fields input:disabled, .fields select:disabled { background: var(--rm-track, #f3f4f6); color: var(--rm-muted, #6b7280); cursor: not-allowed; }
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
      background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); resize: vertical;
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
    const initial = resolveHash(location.hash.slice(1));
    /** @type {'leaders'|'areas'|'guilds'|'labels'|'career'|'users'} pestaña activa */
    this._tab = initial.tab;
    /** @type {'framework'|'map'} sub-pestaña de «Carrera» (RMR-TSK-0262). */
    this._careerSub = initial.sub ?? 'framework';
    this._onHashChange = () => {
      const r = resolveHash(location.hash.slice(1));
      this._tab = r.tab;
      if (r.sub) this._careerSub = r.sub;
    };
    /** @type {import('../lib/leaders.js').Leader[]} */
    this.leaders = [];
    /** @type {Array<{uid:string,displayName:string|null,email:string|null}>} Heads para el selector de «reporta a» */
    this._supermanagers = [];
    /** @type {import('../lib/leaders.js').Leader|null} */
    this.selected = null;
    /** @type {Array<Object>} */
    this.team = [];
    this.teamLoading = false;
    this._email = '';
    this._error = '';
    /** @type {string|null} uid del manager cuyo nombre se está editando (RMR-BUG-0032), o null */
    this._editLeaderUid = null;
    this._editLeaderName = '';
    this._superadminEmail = '';
    this._superadminNotice = '';
    /** @type {string|null} uid del usuario cuyo nombre se está editando en la pestaña Usuarios, o null */
    this._editUserUid = null;
    this._editUserName = '';
    /** @type {import('../tools/team/domain/ports.js').PersistencePort|null} persistencia del superadmin (viewAll) para los catálogos */
    this.persistence = null;
    /** @type {string|null} uid del superadmin (para <catalog-manager>) */
    this.currentUid = null;
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
    /** @type {typeof FW_SUBTABS[number][0]} sub-pestaña activa del framework de carrera */
    this._fwSubtab = 'tracks';
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
    /** @type {string} manager seleccionado en el modal "Asignar a equipo" */
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
      this._loadFramework();
      // El viewer no gestiona usuarios: no hace falta cargar la pestaña.
      if (!this.readOnly) this._loadUsers();
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

  /**
   * Reordena un nivel DENTRO de su track (no en la lista global): intercambia su
   * `order` con el del nivel vecino del mismo track. @param {string} trackId
   * @param {string} id @param {-1|1} dir
   */
  _moveLevelInTrack(trackId, id, dir) {
    const inTrack = this._framework.levels.filter((l) => l.trackId === trackId).toSorted((a, b) => a.order - b.order);
    const pos = inTrack.findIndex((l) => l.id === id);
    const swapPos = pos + dir;
    if (pos < 0 || swapPos < 0 || swapPos >= inTrack.length) return;
    const a = inTrack[pos];
    const b = inTrack[swapPos];
    const list = this._framework.levels.map((l) => {
      if (l.id === a.id) return { ...l, order: b.order };
      if (l.id === b.id) return { ...l, order: a.order };
      return l;
    });
    this._patchFramework({ levels: list });
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

  /** @param {string} [preTrackId] track al que asignar el nivel (por defecto, el primero) */
  _addLevel(preTrackId) {
    const code = this._fwNew.levelCode.trim();
    const title = this._fwNew.levelTitle.trim();
    this._fwError = '';
    if (!code || !title) { this._fwError = 'El nivel necesita código y título.'; return; }
    const levels = this._framework.levels;
    const id = uniqueId(slugify(code) || slugify(title), new Set(levels.map((l) => l.id)));
    const trackId = this._framework.tracks.some((t) => t.id === preTrackId)
      ? /** @type {string} */ (preTrackId)
      : (this._framework.tracks[0]?.id ?? '');
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

  async _loadLeaders() {
    this._error = '';
    try {
      // Los Heads se cargan a la vez que los managers porque alimentan el
      // selector de «reporta a» (RMR-TSK-0295), pero son ACCESORIOS: si su
      // lectura falla, la lista de managers tiene que seguir viéndose igual que
      // antes de existir la jerarquía. Por eso allSettled y no all.
      const [leadersResult, headsResult] = await Promise.allSettled([listLeaders(), listSupermanagers()]);
      if (leadersResult.status === 'rejected') throw leadersResult.reason;
      this.leaders = leadersResult.value;
      this._supermanagers = headsResult.status === 'fulfilled' ? headsResult.value : [];
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los managers.';
    }
  }

  /**
   * Asigna o retira el Head al que reporta un manager. Define su rama: las
   * herramientas resuelven el alcance del Head con el cierre transitivo de
   * `reportsTo`, así que el cambio se nota en Equipo, Carrera y Retros.
   * @param {string} uid @param {string} headUid  '' para quitar la asignación
   */
  async _setReportsTo(uid, headUid) {
    this._error = '';
    try {
      await setLeaderReportsTo(uid, headUid || null);
      await this._loadLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo asignar el Head.';
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
      this._error = err instanceof Error ? err.message : 'No se pudo añadir el manager.';
    }
  }

  /** @param {import('../lib/leaders.js').Leader} leader */
  _startEditLeaderName(leader) {
    this._editLeaderUid = leader.uid;
    this._editLeaderName = leader.displayName ?? '';
  }

  _cancelEditLeaderName() {
    this._editLeaderUid = null;
    this._editLeaderName = '';
  }

  /** @param {KeyboardEvent} e */
  _onEditLeaderNameKey(e) {
    if (e.key === 'Enter') {
      this._saveLeaderName();
    } else if (e.key === 'Escape') {
      this._cancelEditLeaderName();
    }
  }

  /** Guarda el nombre corregido (RMR-BUG-0032) — p. ej. cuando cae al email por no haber iniciado sesión aún. */
  async _saveLeaderName() {
    const uid = this._editLeaderUid;
    if (!uid) return;
    this._error = '';
    try {
      await renameLeader(uid, this._editLeaderName);
      this._editLeaderUid = null;
      this._editLeaderName = '';
      await this._loadLeaders();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo renombrar el manager.';
    }
  }

  /**
   * Nombra superadmin por email desde la pestaña Usuarios (RMR-TSK-0230). Usa la
   * Cloud Function grantAdmin, que provisiona la cuenta si el email nunca ha
   * iniciado sesión, así el superadmin queda preparado para su primer login.
   */
  async _grantSuperadminByEmail() {
    const email = this._superadminEmail.trim();
    if (!email) return;
    this._usersError = '';
    this._superadminNotice = '';
    try {
      await grantAdminByEmail(email);
      this._superadminEmail = '';
      this._superadminNotice = `${email} ya es superadmin.`;
      await this._loadUsers();
    } catch (err) {
      this._usersError = err instanceof Error ? err.message : 'No se pudo conceder superadmin.';
    }
  }

  /** @param {import('../lib/accessRoles.js').AccessUser} user */
  _startEditUserName(user) {
    this._editUserUid = user.uid;
    this._editUserName = user.displayName ?? '';
    this._usersError = '';
    this._usersNotice = '';
  }

  _cancelEditUserName() {
    this._editUserUid = null;
    this._editUserName = '';
  }

  /** @param {KeyboardEvent} e */
  _onEditUserNameKey(e) {
    if (e.key === 'Enter') this._saveUserName();
    else if (e.key === 'Escape') this._cancelEditUserName();
  }

  /** Persiste el nombre editado en /users/{uid}.displayName y recarga la lista. */
  async _saveUserName() {
    const uid = this._editUserUid;
    if (!uid) return;
    this._usersError = '';
    try {
      await setUserDisplayName(uid, this._editUserName);
      this._editUserUid = null;
      this._editUserName = '';
      await this._loadUsers();
    } catch (err) {
      this._usersError = err instanceof Error ? err.message : 'No se pudo guardar el nombre.';
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
      this._error = err instanceof Error ? err.message : 'No se pudo quitar el manager.';
    }
  }

  // ── Usuarios (accesos: superadmin / viewer / manager) ─────────────────────────

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
   * Crea una persona vinculada al usuario dentro del equipo del manager elegido y
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

  /** Un catálogo (áreas/gremios/labels) del superadmin: el componente ÚNICO
   * <catalog-manager> (mismo que en Ajustes). isAdmin=true salvo viewer. */
  _renderCatalogTab(kind, title) {
    return html`
      <section>
        <h2>${title}</h2>
        <catalog-manager
          .kind=${kind}
          .persistence=${this.persistence}
          .isAdmin=${!this.readOnly}
          .readOnly=${this.readOnly}
          .currentUid=${this.currentUid}
          .leaders=${this.leaders}
          .withMeta=${kind === 'labels' || kind === 'squads'}
          placeholder="Nuevo global…"
        ></catalog-manager>
      </section>
    `;
  }

  _renderTabContent() {
    switch (this._tab) {
      case 'leaders':
        return html`${this._renderLeaders()} ${this.selected ? this._renderTeam() : null}`;
      case 'areas':
        return this._renderCatalogTab('areas', 'Áreas de conocimiento (organización)');
      case 'guilds':
        return this._renderCatalogTab('guilds', 'Gremios (organización)');
      case 'squads':
        return this._renderCatalogTab('squads', 'Squads (organización)');
      case 'labels':
        return this._renderCatalogTab('labels', 'Labels (organización)');
      case 'career':
        return this._renderCareer();
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
          ? html`<button class="primary" @click=${this._useAsLeader}>Usar como manager →</button>`
          : null}
      </div>
      <nav class="tabs" aria-label="Secciones de gestión">
        <button class="tab ${this._tab === 'leaders' ? 'active' : ''}" @click=${() => this._setTab('leaders')}>Managers</button>
        <button class="tab ${this._tab === 'areas' ? 'active' : ''}" @click=${() => this._setTab('areas')}>Áreas</button>
        <button class="tab ${this._tab === 'guilds' ? 'active' : ''}" @click=${() => this._setTab('guilds')}>Gremios</button>
        <button class="tab ${this._tab === 'squads' ? 'active' : ''}" @click=${() => this._setTab('squads')}>Squads</button>
        <button class="tab ${this._tab === 'labels' ? 'active' : ''}" @click=${() => this._setTab('labels')}>Labels</button>
        <button class="tab ${this._tab === 'career' ? 'active' : ''}" @click=${() => this._setTab('career')}>Carrera</button>
        ${this.readOnly
          ? null
          : html`<button class="tab ${this._tab === 'users' ? 'active' : ''}" @click=${() => this._setTab('users')}>Usuarios</button>`}
      </nav>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._renderTabContent()}
    `;
  }

  /** «Carrera» con dos sub-pestañas (RMR-TSK-0262): el framework de rol (niveles/
   *  disciplinas/expectativas) y el mapa/archipiélago, antes dos pestañas de
   *  primer nivel con nombres casi iguales. Simétrico a «Mi carrera» del ingeniero. */
  _renderCareer() {
    const sub = this._careerSub === 'map' ? 'map' : 'framework';
    const subs = [
      ['framework', 'Framework (niveles y disciplinas)'],
      ['map', 'Mapa (archipiélago)'],
    ];
    return html`
      <div class="csubtabs" role="tablist" aria-label="Secciones de Carrera">
        ${subs.map(
          ([id, label]) => html`<button
            role="tab"
            aria-selected=${sub === id}
            class="csubtab ${sub === id ? 'on' : ''}"
            @click=${() => { this._careerSub = id; }}
          >${label}</button>`,
        )}
      </div>
      <div role="tabpanel">
        ${sub === 'map' ? this._renderCareerMap() : this._renderFramework()}
      </div>
    `;
  }

  /** El editor del mapa (RMR-TSK-0259): el game-editor rediseñado, embebido en el
   *  panel (sin su cabecera propia). Un viewer no lo edita. */
  _renderCareerMap() {
    if (this.readOnly) {
      return html`<section>
        <h2>Mapa de carrera</h2>
        <p class="ro-note">El editor del mapa de carrera es solo para superadmin.</p>
      </section>`;
    }
    return html`<game-editor .ready=${this.ready} .embedded=${true}></game-editor>`;
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
              <div class="subtabs" role="tablist">
                ${FW_SUBTABS.map(([id, label]) => html`
                  <button class="subtab ${this._fwSubtab === id ? 'active' : ''}" role="tab" aria-selected=${this._fwSubtab === id}
                    @click=${() => { this._fwSubtab = id; }}>${label}</button>`)}
              </div>
              ${this._renderFwActiveSubtab(fw)}
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
   * Contenido de la sub-pestaña activa del framework. Un dispatch por `switch`
   * (en vez de ternarios encadenados dentro de la plantilla) mantiene baja la
   * complejidad de _renderFramework y evita ternarios anidados.
   * @param {import('../tools/career/data/framework.js').CareerFramework} fw
   */
  _renderFwActiveSubtab(fw) {
    switch (this._fwSubtab) {
      case 'disciplines':
        return this._renderNamedSection('disciplines', 'Disciplinas', 'disciplina', 'discipline', fw.disciplines, 'Disciplina = familia de carrera que matiza las expectativas de cada nivel; la gestiona el superadmin. Ejemplos: Backend, Web/Frontend, Infra/Platform, Data/ML, Mobile.');
      case 'dimensions':
        return this._renderNamedSection('dimensions', 'Dimensiones', 'dimensión', 'dimension', fw.dimensions, 'Ejes de evaluación de cada nivel. Ejemplos: Technical Excellence, Reliability, Product.');
      case 'expectations':
        return this._renderFwExpectations(fw);
      case 'addendums':
        return this._renderFwAddendums(fw);
      default:
        return this._renderFwTracksAndLevels(fw);
    }
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

  /**
   * Sub-pestaña «Tracks y niveles»: los tracks son los itinerarios y cada uno
   * contiene sus niveles anidados. Realiza la relación track→niveles de forma
   * visual (antes eran dos listas planas separadas).
   * @param {import('../tools/career/data/framework.js').CareerFramework} fw
   */
  _renderFwTracksAndLevels(fw) {
    const tracks = [...fw.tracks].toSorted((a, b) => a.order - b.order);
    const byTrack = Object.groupBy(fw.levels, (l) => l.trackId ?? '');
    const orphans = fw.levels.filter((l) => !tracks.some((t) => t.id === l.trackId));
    return html`
      <p class="ro-note">Itinerarios de carrera de la organización (p. ej. Individual Contributor, Management). Cada track contiene sus niveles: expándelo para verlos o añadir uno nuevo.</p>
      ${this.readOnly
        ? null
        : html`<div class="toolbar">
            <input type="text" placeholder="Nombre del track" .value=${this._fwNew.track}
              @input=${(e) => { this._fwNew = { ...this._fwNew, track: e.target.value }; }} />
            <button class="primary" ?disabled=${!this._fwNew.track.trim()} @click=${() => this._addNamed('tracks', 'track', 'track')}>Añadir track</button>
          </div>`}
      ${tracks.length === 0
        ? html`<p class="empty">Aún no hay tracks.</p>`
        : tracks.map((t, i) => this._renderTrackGroup(fw, t, i, tracks.length, [...(byTrack[t.id] ?? [])].toSorted((a, b) => a.order - b.order)))}
      ${orphans.length
        ? html`<div class="city track-group" style="margin-top:0.9rem">
            <div class="city-head"><span class="cid">Niveles sin track <span class="muted">(${orphans.length})</span></span></div>
            <p class="ro-note">Estos niveles apuntan a un track que ya no existe. Reasígnalos con su selector de Track.</p>
            <div class="cities">${[...orphans].toSorted((a, b) => a.order - b.order).map((l, i, arr) => this._renderLevelCard(fw, l, i, arr.length))}</div>
          </div>`
        : null}
    `;
  }

  /**
   * Acciones de la cabecera de un track (reordenar y borrar). Extraído para no
   * anidar el ternario confirmar/borrar dentro del de readOnly (Sonar S3358).
   * @param {import('../tools/career/data/framework.js').NamedItem} t
   * @param {number} pos @param {number} total
   */
  _renderTrackActions(t, pos, total) {
    return html`
      <button class="ord-btn" ?disabled=${pos === 0} title="Subir" @click=${() => this._moveFwItem('tracks', t.id, -1)}>↑</button>
      <button class="ord-btn" ?disabled=${pos === total - 1} title="Bajar" @click=${() => this._moveFwItem('tracks', t.id, 1)}>↓</button>
      ${this._isFwConfirm('tracks', t.id)
        ? html`<span class="confirm">¿Borrar track?
            <button class="yes" @click=${() => this._deleteFwItem('tracks', t.id)}>Sí</button>
            <button @click=${() => { this._fwConfirm = null; }}>No</button>
          </span>`
        : html`<button class="del-btn" @click=${() => { this._fwConfirm = { kind: 'tracks', id: t.id }; this._fwError = ''; }}>Borrar</button>`}
    `;
  }

  /**
   * Un track como contenedor plegable (colapsado por defecto) con sus niveles
   * anidados dentro y un alta de nivel pre-asignada a ese track.
   * @param {import('../tools/career/data/framework.js').CareerFramework} fw
   * @param {import('../tools/career/data/framework.js').NamedItem} t
   * @param {number} pos @param {number} total
   * @param {Array<import('../tools/career/data/framework.js').Level>} levels niveles del track, ya ordenados
   */
  _renderTrackGroup(fw, t, pos, total, levels) {
    return html`
      <details class="city track-group">
        <summary class="city-head">
          <span class="cid">${t.name || t.id} <span class="muted">(${levels.length} nivel${levels.length === 1 ? '' : 'es'})</span></span>
          <span @click=${(e) => e.stopPropagation()}>
            ${this.readOnly ? null : this._renderTrackActions(t, pos, total)}
          </span>
        </summary>
        <div class="fields">
          <label>Nombre
            <input type="text" .value=${t.name} ?disabled=${this.readOnly} @input=${(e) => this._patchFwItem('tracks', t.id, { name: e.target.value })} />
          </label>
          <label class="full">Descripción
            <input type="text" .value=${t.description ?? ''} ?disabled=${this.readOnly} @input=${(e) => this._patchFwItem('tracks', t.id, { description: e.target.value })} />
          </label>
        </div>
        <div class="nested-levels">
          <div class="nested-head">
            <span class="sub">Niveles (${levels.length})</span>
            ${this.readOnly
              ? null
              : html`<div class="toolbar">
                  <input type="text" placeholder="Código (p. ej. L2)" .value=${this._fwNew.levelCode}
                    @input=${(e) => { this._fwNew = { ...this._fwNew, levelCode: e.target.value }; }} />
                  <input type="text" placeholder="Título (p. ej. Senior Engineer)" .value=${this._fwNew.levelTitle}
                    @input=${(e) => { this._fwNew = { ...this._fwNew, levelTitle: e.target.value }; }} />
                  <button class="primary" ?disabled=${!this._fwNew.levelCode.trim() || !this._fwNew.levelTitle.trim()} @click=${() => this._addLevel(t.id)}>Añadir nivel</button>
                </div>`}
          </div>
          ${levels.length === 0
            ? html`<p class="empty">Este track aún no tiene niveles.</p>`
            : html`<div class="cities">${levels.map((l, i) => this._renderLevelCard(fw, l, i, levels.length))}</div>`}
        </div>
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
      <div class="city level">
        <div class="city-head">
          <span class="lvl-id">
            <span class="lvl-badge">${l.code || '—'}</span>
            <span class="lvl-title">${l.title || l.code || l.id}<span class="muted"> · ${l.id}</span></span>
          </span>
          <span>
            ${this.readOnly
              ? null
              : html`
                  <button class="ord-btn" ?disabled=${pos === 0} title="Subir" @click=${() => this._moveLevelInTrack(l.trackId, l.id, -1)}>↑</button>
                  <button class="ord-btn" ?disabled=${pos === total - 1} title="Bajar" @click=${() => this._moveLevelInTrack(l.trackId, l.id, 1)}>↓</button>
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
        <h2>Managers (${this.leaders.length})</h2>
        <p class="ro-note">Da de alta a los managers por su email, aunque nunca hayan iniciado sesión: la cuenta queda preparada para su primer login. Pincha un manager para ver su equipo.</p>
        ${this.readOnly
          ? null
          : html`<div class="toolbar">
              <input
                type="email"
                placeholder="email@dominio.com"
                .value=${this._email}
                @input=${(e) => { this._email = e.target.value; }}
              />
              <button class="primary" ?disabled=${!this._email.trim()} @click=${() => this._addLeader()}>Añadir manager</button>
            </div>`}
        ${this.leaders.length === 0
          ? html`<p class="empty">Aún no hay managers dados de alta.</p>`
          : html`<table>
              <thead><tr><th>Nombre</th><th>Email</th><th>Reporta a</th><th></th></tr></thead>
              <tbody>
                ${this.leaders.map((l) => this._renderLeaderRow(l))}
              </tbody>
            </table>`}
      </section>
    `;
  }

  /** Nombrar superadmin por email desde la pestaña Usuarios (RMR-TSK-0230). */
  _renderSuperadminAlta() {
    return html`
      <div class="superadmin-alta">
        <h3>Nombrar superadmin</h3>
        <p class="ro-note">Concede superadmin directamente por email, aunque nunca haya iniciado sesión (la cuenta se prepara para su primer login).</p>
        <div class="toolbar">
          <input type="email" placeholder="email@dominio.com" .value=${this._superadminEmail}
            @input=${(e) => { this._superadminEmail = e.target.value; }} />
          <button class="primary" ?disabled=${!this._superadminEmail.trim()} @click=${() => this._grantSuperadminByEmail()}>Hacer superadmin</button>
        </div>
        ${this._superadminNotice ? html`<p class="notice">${this._superadminNotice}</p>` : null}
      </div>
    `;
  }

  /** @param {import('../lib/leaders.js').Leader} l */
  _renderLeaderRow(l) {
    const editing = this._editLeaderUid === l.uid;
    if (editing) {
      return html`<tr>
        <td @click=${(e) => e.stopPropagation()}>
          <input type="text" .value=${this._editLeaderName} placeholder="Nombre"
            @input=${(e) => { this._editLeaderName = e.target.value; }}
            @keydown=${(e) => this._onEditLeaderNameKey(e)} />
        </td>
        <td class="muted">${l.email ?? '—'}</td>
        <td class="muted">${this._headName(l.reportsTo) ?? '—'}</td>
        <td @click=${(e) => e.stopPropagation()}>
          <button class="act" @click=${() => this._saveLeaderName()}>Guardar</button>
          <button @click=${() => this._cancelEditLeaderName()}>Cancelar</button>
        </td>
      </tr>`;
    }
    return html`
      <tr class="clickable ${this.selected?.uid === l.uid ? 'sel' : ''}" @click=${() => this._openTeam(l)}>
        <td>${l.displayName ?? '—'}</td>
        <td class="muted">${l.email ?? '—'}</td>
        <td @click=${(e) => e.stopPropagation()}>${this._renderReportsTo(l)}</td>
        <td @click=${(e) => e.stopPropagation()}>
          ${this.readOnly
            ? null
            : html`<button class="act" @click=${() => this._startEditLeaderName(l)}>Renombrar</button>
                <button class="del-btn" @click=${() => this._removeLeader(l.uid)}>Quitar</button>`}
        </td>
      </tr>
    `;
  }

  /** Nombre visible de un Head por su uid. @param {string|null} uid */
  _headName(uid) {
    if (!uid) return null;
    const head = (this._supermanagers ?? []).find((h) => h.uid === uid);
    return head ? (head.displayName ?? head.email ?? head.uid) : uid;
  }

  /**
   * Selector del Head al que reporta un manager (RMR-TSK-0295). Es lo que define
   * la rama del Head, así que al cambiarlo se mueve su alcance en Equipo,
   * Carrera y Retros. No se ofrece a sí mismo: nadie se reporta a sí mismo.
   * @param {import('../lib/leaders.js').Leader} l
   */
  _renderReportsTo(l) {
    const heads = (this._supermanagers ?? []).filter((h) => h.uid !== l.uid);
    if (this.readOnly) return html`<span class="muted">${this._headName(l.reportsTo) ?? '—'}</span>`;
    if (heads.length === 0) {
      return html`<span class="muted">Ningún Head aún — dale el rol a alguien en Usuarios</span>`;
    }
    return html`
      <select aria-label="Head al que reporta ${l.displayName ?? l.email ?? 'el manager'}"
        @change=${(e) => this._setReportsTo(l.uid, e.target.value)}>
        <option value="" ?selected=${!l.reportsTo}>— Ninguno —</option>
        ${heads.map((h) => html`
          <option value=${h.uid} ?selected=${l.reportsTo === h.uid}>${h.displayName ?? h.email ?? h.uid}</option>`)}
      </select>`;
  }

  _renderTeam() {
    const name = this.selected.displayName ?? this.selected.email ?? this.selected.uid;
    return html`
      <section>
        <h2>Equipo de ${name}</h2>
        <p class="ro-note">Vista de solo lectura. La gestión de cada persona la hace su manager.</p>
        ${this.teamLoading
          ? html`<p class="empty">Cargando equipo…</p>`
          : this.team.length === 0
            ? html`<p class="empty">Este manager aún no tiene personas en su equipo.</p>`
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
          Da de alta un viewer o un manager por su email, aunque nunca hayan iniciado sesión: la cuenta queda preparada para su primer login.
          Cambia el rol de quien ya aparece en la lista con «Cambiar rol…». «Quitar acceso» solo revoca el rol: no borra la cuenta ni la saca de su equipo.
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
            <option value="leader" ?selected=${this._newUserRole === 'leader'}>Manager</option>
          </select>
          <button class="primary" ?disabled=${!this._newUserEmail.trim()} @click=${() => this._addUser()}>Añadir usuario</button>
        </div>
        ${this._renderSuperadminAlta()}
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
    if (this._editUserUid === user.uid) return this._renderUserEditRow(user);
    const linked = this._isLinked(user);
    return html`
      <tr>
        <td>${user.displayName ?? '—'}</td>
        <td class="muted">${user.email ?? '—'}</td>
        ${this._renderUserRoleCell(user, linked)}
        <td class="muted">${formatLogin(user.lastLogin)}</td>
        <td>${this._renderUserActions(user, linked)}</td>
      </tr>
    `;
  }

  /** Fila en modo edición del nombre (RMR-TSK-0230). @param {import('../lib/accessRoles.js').AccessUser} user */
  _renderUserEditRow(user) {
    return html`
      <tr>
        <td>
          <input type="text" .value=${this._editUserName} placeholder="Nombre"
            @input=${(e) => { this._editUserName = e.target.value; }}
            @keydown=${(e) => this._onEditUserNameKey(e)} />
        </td>
        <td class="muted">${user.email ?? '—'}</td>
        ${this._renderUserRoleCell(user, this._isLinked(user))}
        <td class="muted">${formatLogin(user.lastLogin)}</td>
        <td>
          <button class="act" @click=${() => this._saveUserName()}>Guardar</button>
          <button @click=${() => this._cancelEditUserName()}>Cancelar</button>
        </td>
      </tr>
    `;
  }

  /** Celda de rol + badge «Vinculado». @param {import('../lib/accessRoles.js').AccessUser} user @param {boolean} linked */
  _renderUserRoleCell(user, linked) {
    return html`
      <td>
        <span class="badge" style=${`background:${ROLE_COLOR[user.role]}`}>${ROLE_LABEL[user.role]}</span>
        ${linked ? html`<span class="badge linked" title="Vinculado a una persona">Vinculado</span>` : null}
      </td>
    `;
  }

  /** Acciones de la fila de usuario. @param {import('../lib/accessRoles.js').AccessUser} user @param {boolean} linked */
  _renderUserActions(user, linked) {
    const pending = this._confirmRoleChange?.uid === user.uid ? this._confirmRoleChange : null;
    if (pending) {
      return html`<span class="confirm">¿Aplicar «${this._roleChangeLabel(pending.role)}»?
        <button class="yes" @click=${() => this._changeUserRole(user, pending.role)}>Sí</button>
        <button @click=${() => { this._confirmRoleChange = null; }}>No</button>
      </span>`;
    }
    return html`<div class="row-actions">
      <button class="act" @click=${() => this._startEditUserName(user)}>Renombrar</button>
      <select @change=${(e) => { this._confirmRoleChange = { uid: user.uid, role: e.target.value }; }}>
        <option value="" disabled selected>Cambiar rol…</option>
        <option value="superadmin">Superadmin</option>
        <option value="supermanager">Head (manager de managers)</option>
        <option value="viewer">Viewer</option>
        <option value="leader">Manager</option>
        <option value="none">Quitar acceso</option>
      </select>
      ${user.role === 'none' && !linked
        ? html`<button class="act" type="button" @click=${() => this._openAssign(user)}>Asignar a equipo</button>`
        : null}
    </div>`;
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
                  Se creará una persona vinculada a esta cuenta en el equipo del manager elegido. La
                  cuenta podrá ver su propia ficha en solo lectura.
                </p>
                <label class="assign-field">Manager
                  <select .value=${this._assignLeader} @change=${(e) => { this._assignLeader = e.target.value; }}>
                    <option value="">— Elige un manager —</option>
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
