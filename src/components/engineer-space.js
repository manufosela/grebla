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
import { subLevelCalcText } from '../tools/career/domain/levelProgress.js';
import { levelHistoryView } from '../tools/team/domain/levelHistory.js';
import { assessmentProgressionSeries } from '../tools/career/domain/progression.js';
import { listLevelAssessments, getPersonSubLevel } from '../lib/careerAssessment.js';
import { getCurrentUser } from '../lib/auth.js';
import './career/career-progression-chart.js';
import './role-result.js';
import './role-questionnaire.js';
import './career/career-map-summary.js';
import './career/career-ladder.js';
import './marea/marea-app.js';
import './kudos/kudos-app.js';
import './retro/retro-app.js';
import { getLevel, expectationsForLevel, addendumsForDisciplines, aspirationalLevels, composeTitle } from '../tools/career/data/framework.js';
import { setCareerTarget, getPersonLogbook } from '../lib/engineer.js';
import { visibleTabsFor, effectiveTabFor } from './engineer-tabs.js';
import './career-person/career-person-panel.js';
import { membershipLabel } from '../tools/team/domain/membership.js';
import { conversationOrigin, conversationsNewestFirst } from '../tools/team/domain/conversationOrigin.js';

/**
 * Pestañas de «Mi espacio». El id (clave) sincroniza con `location.hash`
 * (#carrera / #rolemirror) para conservar la pestaña activa al recargar o navegar
 * atrás/adelante, igual que el patrón de <superadmin-panel>. El mapa vive como
 * sub-pestaña dentro de «carrera» (RMR-TSK-0262); el hash legado `#mapa` sigue
 * aterrizando ahí. «Mis datos» ya no existe: todo está en «Mi ficha» (RMR-TSK-0697).
 * @type {ReadonlyArray<'ficha'|'carrera'|'rolemirror'|'motivadores'|'o2o'|'marea'|'retros'|'kudos'>}
 */
const TABS = ['ficha', 'carrera', 'rolemirror', 'motivadores', 'o2o', 'marea', 'retros', 'kudos'];
/** Búsqueda O(1) de existencia (validar el hash de la URL). */
const TAB_SET = new Set(TABS);

/**
 * Metadatos de cada pestaña: etiqueta de la barra, encabezado del panel y clase
 * CSS del panel (conserva los bordes de acento originales por sección).
 * @type {Record<typeof TABS[number], { label: string, heading: string, cls: string }>}
 */
const TAB_META = {
  ficha: { label: 'Mi ficha', heading: 'Mi ficha', cls: 'ficha' },
  carrera: { label: 'Mi carrera', heading: 'Mi carrera', cls: 'career' },
  rolemirror: { label: 'Mi Role Mirror', heading: 'Mi Role Mirror', cls: 'rolemirror' },
  motivadores: { label: 'Motivadores', heading: 'Motivadores', cls: 'motivadores' },
  o2o: { label: 'Mis O2O', heading: 'Mis O2O', cls: 'o2o' },
  marea: { label: 'Marea', heading: 'Marea', cls: 'marea' },
  retros: { label: 'Retros', heading: 'Retros', cls: 'retros' },
  kudos: { label: 'Kudos', heading: 'Kudos', cls: 'kudos' },
};

/** Sub-pestañas de «Mi carrera». Un hash desconocido cae en la primera. */
const CAREER_SUBS = /** @type {const} */ (['nivel', 'plan', 'expectativas', 'seguimiento', 'o2o', 'mapa', 'escalera']);

/**
 * Sub-pestaña de «Mi carrera» que corresponde a un hash.
 * @param {string} raw
 * @returns {typeof CAREER_SUBS[number]}
 */
function careerSubFromHash(raw) {
  return CAREER_SUBS.includes(/** @type {any} */ (raw)) ? /** @type {any} */ (raw) : 'nivel';
}

export class EngineerSpace extends LitElement {
  static properties = {
    person: { attribute: false },
    framework: { attribute: false },
    profile: { attribute: false },
    roles: { attribute: false },
    items: { attribute: false },
    dimensions: { attribute: false },
    orgConfig: { attribute: false },
    island: { attribute: false },
    journey: { attribute: false },
    archipelago: { attribute: false },
    achievements: { attribute: false },
    endorsements: { attribute: false },
    questions: { attribute: false },
    o2o: { attribute: false },
    /** Conversaciones anotadas en su ficha (RMR-TSK-0578). */
    conversations: { attribute: false },
    /** Catálogo de dominios: a lo que pertenece de verdad (ADR de dominios). */
    domains: { attribute: false },
    _tab: { state: true },
    /** Subnivel efectivo, el mismo que ve su manager (RMR-TSK-0695). */
    _subLevel: { state: true },
    _subLevelError: { state: true },
    _careerSub: { state: true },
    _targetError: { state: true },
    _targetSaving: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); color: var(--rm-text, #111827); }

    /* ── Barra de pestañas (patrón ARIA tablist) ── */
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d);
      border-radius: 999px; padding: 0.4rem 1rem; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    section:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    /* Sub-pestañas dentro de «Mi carrera» (RMR-TSK-0262): más discretas que las
       de primer nivel — subrayado en la activa, sin píldora. */
    .subtabs { display: flex; gap: 1.1rem; margin: 0 0 1.1rem; border-bottom: 1px solid var(--rm-border, #e5e7eb); flex-wrap: wrap; }
    .subtab {
      border: 0; background: none; color: var(--rm-muted, #5b6b7d); font: inherit; font-size: 0.9rem; font-weight: 700;
      padding: 0.4rem 0.1rem; margin-bottom: -1px; border-bottom: 2px solid transparent; cursor: pointer;
    }
    .subtab.on { color: var(--rm-accent, #2a9d8f); border-bottom-color: var(--rm-accent, #2a9d8f); }
    .subtab:hover:not(.on) { color: var(--rm-text, #111827); }
    .subtab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }

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
    .rm-intro { font-size: 0.88rem; color: var(--rm-muted, #5b6b7d); line-height: 1.5; margin: 0 0 1rem;
      background: var(--rm-surface-hover, #eef3f5); border-radius: 8px; padding: 0.7rem 0.9rem; }
    section.map { border-left: 4px solid var(--rm-coral, #f2887a); }
    section.o2o { border-left: 4px solid var(--rm-navy, #1e3a5f); }
    section.kudos { border-left: 4px solid var(--rm-accent, #2a9d8f); }

    /* ── Sección Mis O2O (solo lo compartido por el manager) ── */
    .o2o-list { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .o2o-card { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.6rem 0.85rem; }
    .o2o-card .date { font-weight: 700; font-size: 0.88rem; }
    .o2o-card .body { font-size: 0.88rem; margin: 0.35rem 0 0; white-space: pre-wrap; }
    /* De dónde viene la nota, ANTES del texto (RMR-TSK-0578). La de un agente se
       distingue de la de una persona sin tener que leerla entera. */
    .o2o-card .origin { display: inline-block; margin-left: 0.5rem; padding: 0.05rem 0.5rem; border-radius: 999px;
      font-size: 0.72rem; font-weight: 700; background: var(--rm-chip, #eef2f7); color: var(--rm-muted, #5b6b7d); }
    .o2o-card .origin.agente { background: color-mix(in srgb, var(--rm-info, #2563eb) 15%, transparent); color: var(--rm-info-text, #1e3a8a); }
    .o2o-card .origin-link { font-size: 0.75rem; color: var(--rm-accent, #2a9d8f); }
    .o2o-act { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; padding: 0.15rem 0; }
    .o2o-act.done { color: var(--rm-muted, #5b6b7d); text-decoration: line-through; }
    .o2o-note { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); margin: 0.25rem 0 1rem; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; margin: 0; }
    /* El O2O que viene: lo primero de la sección, porque es lo accionable —
       hay algo que pensar ANTES de la conversación (RMR-TSK-0512). */
    .next { border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--rm-accent, #2a9d8f);
      border-radius: 12px; padding: 0.9rem 1.1rem; margin: 0 0 1.25rem; background: var(--rm-surface-hover, #eef3f5); }
    .next h4 { margin: 0; font-size: 1rem; color: var(--rm-navy, #1e3a5f); }
    .next .intro { font-size: 0.88rem; margin: 0.4rem 0 0; white-space: pre-wrap; }
    .next .sec { margin: 0.9rem 0 0; }
    .next .sec h5 { margin: 0 0 0.35rem; font-size: 0.8rem; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--rm-muted, #5b6b7d); }
    .next ul { margin: 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .next li { font-size: 0.9rem; }
    .next .hint { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); margin: 0.9rem 0 0; }

    /* ── Sección Mis datos (externos) ── */
    section.datos { border-left: 4px solid var(--rm-navy, #1e3a5f); }
    .datos-note { font-size: 0.9rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 1rem; }
    .datos-dl { margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .datos-row { display: flex; gap: 0.75rem; border-bottom: 1px solid var(--rm-border, #eef0f2); padding: 0 0 0.5rem; }
    .datos-row dt { flex: 0 0 7rem; font-weight: 700; font-size: 0.85rem; color: var(--rm-navy, #1e3a5f); margin: 0; }
    .datos-row dd { margin: 0; font-size: 0.9rem; color: var(--rm-text, #111827); }
    /* Motivadores integrados como pestaña (RMR-TSK-0260). */
    .mot-lead { font-size: 0.9rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 1rem; max-width: 60ch; }
    .mot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.75rem; }
    .mot-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--rm-accent, #2a9d8f); border-radius: var(--rm-radius, 14px); background: var(--rm-surface, #fff); text-decoration: none; transition: background 0.12s, transform 0.12s; }
    .mot-card.affective { border-left-color: var(--gr-coral, #e26d5e); }
    .mot-card:hover { background: var(--rm-surface-hover, #eef3f5); transform: translateY(-2px); }
    .mot-card:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .mot-emoji { font-size: 1.6rem; }
    .mot-text { display: flex; flex-direction: column; }
    .mot-text strong { color: var(--rm-text, #111827); font-size: 1rem; }
    .mot-text small { color: var(--rm-muted, #5b6b7d); font-size: 0.82rem; }
    .playlink { color: var(--rm-accent, #2a9d8f); font-weight: 700; text-decoration: none; margin-left: 0.35rem; }
    .playlink:hover { text-decoration: underline; }
    .topmost { color: var(--rm-accent, #2a9d8f); font-size: 0.9rem; font-weight: 600; margin: 0.2rem 0 0; }

    /* ── Sección Carrera (marcado espejo de <team-person-detail>) ── */
    .sub { font-size: 0.85rem; font-weight: 700; color: var(--rm-text, #111827); margin: 1.1rem 0 0.35rem; }
    .now .code { font-weight: 700; }
    ul.lvl-history { list-style: none; margin: 0.35rem 0 0; padding: 0; display: grid; gap: 0.3rem; }
    ul.lvl-history li { font-size: 0.85rem; display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: baseline; }
    .lvl-change { font-weight: 700; font-variant-numeric: tabular-nums; }
    .lvl-when { color: var(--rm-muted, #5b6b7d); font-size: 0.8rem; }
    .lvl-note { color: var(--rm-muted, #5b6b7d); font-style: italic; }
    .now .desc { font-size: 0.85rem; color: var(--rm-text, #111827); margin: 0.2rem 0 0; }
    .now .profile { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); margin: 0.2rem 0 0; }
    .expect { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    .expect li { padding: 0.4rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .expect .dim { font-weight: 700; }
    .expect .txt { color: var(--rm-text, #111827); }
    .expect .todo { color: var(--rm-muted, #5b6b7d); font-style: italic; }
    .addn { margin: 0.3rem 0 0; }
    .addn .disc { font-weight: 700; font-size: 0.85rem; margin: 0.6rem 0 0.2rem; }
    .addn ul { list-style: none; margin: 0; padding: 0; font-size: 0.83rem; }
    .addn li { padding: 0.25rem 0; }
    .addn .dim { font-weight: 600; }
    .addn .folds { margin: 0.2rem 0 0; }

    /* ── Ítems plegables (expectativas y addendums) ── */
    .fold { border-top: 1px solid var(--rm-border, #eef0f2); }

    /* Los estilos de la escalera se fueron con career-ladder (RMR-TSK-0488).
       Los de fold se quedan: los usan las expectativas del nivel propio. */
    .fold summary { cursor: pointer; padding: 0.45rem 0; font-size: 0.85rem; }
    .fold summary::-webkit-details-marker { color: var(--rm-muted, #5b6b7d); }
    .fold summary:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
    .fold .dim { font-weight: 700; }
    .fold-body { font-size: 0.83rem; color: var(--rm-text, #111827); margin: 0.1rem 0 0.5rem; padding-left: 1.1rem; }
    .fold-empty { display: flex; gap: 0.4rem; align-items: baseline; padding: 0.45rem 0; font-size: 0.85rem; }
    .fold-empty .todo { color: var(--rm-muted, #5b6b7d); font-style: italic; }
    @media (prefers-reduced-motion: no-preference) {
      .fold[open] .fold-body { animation: fold-in 0.16s ease-out; }
      @keyframes fold-in { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: none; } }
    }

    .aspire { list-style: none; margin: 0; padding: 0; }
    .aspire > li { border-top: 1px solid var(--rm-border, #eef0f2); }
    .aspire summary { cursor: pointer; padding: 0.45rem 0; font-size: 0.88rem; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
    .aspire summary::-webkit-details-marker { color: var(--rm-muted, #5b6b7d); }
    .aspire .code { font-weight: 700; }
    .aspire .track { color: var(--rm-muted, #5b6b7d); font-size: 0.78rem; }
    .aspire .desc { font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 0.5rem; padding-left: 1.1rem; }

    /* ── Evolución / Próximos pasos (única escritura del ingeniero) ── */
    .next-single { border-top: 1px solid var(--rm-border, #eef0f2); padding: 0.5rem 0 0.2rem; }
    .next-single .lvl { margin: 0; font-size: 0.9rem; }
    .next-single .code { font-weight: 700; }
    .next-single .track { color: var(--rm-muted, #5b6b7d); font-size: 0.78rem; margin-left: 0.4rem; }
    .next-single .desc { font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); margin: 0.2rem 0 0.5rem; }
    .target-picker { border: 0; margin: 0; padding: 0; }
    .target-legend { font-size: 0.85rem; font-weight: 700; color: var(--rm-text, #111827); padding: 0; margin: 0 0 0.3rem; }
    .target-opt { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.4rem 0; border-top: 1px solid var(--rm-border, #eef0f2); font-size: 0.88rem; cursor: pointer; }
    .target-opt input { margin: 0; accent-color: var(--rm-accent, #2a9d8f); cursor: pointer; }
    .target-opt input:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .target-opt .code { font-weight: 700; }
    .target-opt .track { color: var(--rm-muted, #5b6b7d); font-size: 0.78rem; }
    .target-btn {
      font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer;
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff);
      color: var(--rm-text, #111827); border-radius: 999px; padding: 0.3rem 0.9rem; margin-top: 0.5rem;
    }
    .target-btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .target-btn:hover:not(:disabled) { filter: brightness(0.97); }
    .target-btn:disabled { opacity: 0.6; cursor: default; }
    .target-btn:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .target-current { margin: 0.6rem 0 0; font-size: 0.9rem; font-weight: 700; color: var(--rm-accent, #2a9d8f); }
    .target-current .code { font-weight: 800; }
    .target-error { margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--rm-coral, #c2410c); }

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
    /** @type {ReadonlyArray<import('../data/items.js').Item>} */
    this.items = [];
    /** @type {ReadonlyArray<{ key: string, label: string }>} */
    this.dimensions = [];
    /** @type {import('../lib/scoring.js').OrgConfig|null} */
    this.orgConfig = null;
    /** @type {CareerMap|null} */
    this.island = null;
    /** @type {Journey|null} */
    this.journey = null;
    /** @type {import('../tools/career/domain/types.js').Archipelago|null} índice del archipiélago (ficha MC-21) */
    this.archipelago = null;
    /** @type {import('../tools/career/domain/achievements.js').Achievements|null} logros registrados (ficha MC-21) */
    this.achievements = null;
    /** @type {import('../tools/career/domain/endorsements.js').Endorsements|null} avales del manager (JG-6, contador de la ficha) */
    this.endorsements = null;
    /** @type {import('../tools/career/domain/wizard.js').WizardQuestion[]} consultas al brujo (ficha MC-22) */
    this.questions = [];
    /** @type {import('../lib/o2o.js').MyO2O|null} proyección compartida de mis O2O (F4) */
    this.o2o = null;
    /** @type {Array<object>} */
    this.conversations = [];
    this.domains = [];
    /** @type {string|null} aviso in-place si falla la escritura del objetivo */
    this._targetError = null;
    /** @type {boolean} true mientras se persiste el objetivo (deshabilita controles) */
    this._targetSaving = false;
    /** @type {'nivel'|'mapa'|'escalera'} sub-pestaña de «Mi carrera» (RMR-TSK-0262, RMR-TSK-0471). */
    this._careerSub = careerSubFromHash(location.hash.slice(1));
    /** @type {typeof TABS[number]} pestaña activa (inicializada desde el hash) */
    this._tab = this._tabFromHash(location.hash.slice(1));
    // Mantiene la pestaña activa sincronizada con el hash (recarga / atrás-adelante).
    this._onHashChange = () => {
      const raw = location.hash.slice(1);
      // También al volver a #nivel: si solo se atendieran mapa y escalera,
      // atrás/adelante dejaría la sub-pestaña en la anterior y se vería una
      // sección que no corresponde al hash.
      this._careerSub = careerSubFromHash(raw);
      const t = effectiveTabFor(this._tabFromHash(raw), this.person);
      if (this._visibleTabs().includes(t)) this._tab = t;
    };
  }

  /** Resuelve el hash a una pestaña visible. El hash legado `#mapa` (RMR-TSK-0262)
   *  ya no es pestaña propia: cae en «carrera» (su sub-pestaña Mapa la fija el
   *  propio hash). Cualquier otro hash desconocido cae en «ficha».
   *  @param {string} raw @returns {typeof TABS[number]} */
  _tabFromHash(raw) {
    if (raw === 'mapa') return 'carrera';
    return TAB_SET.has(raw) ? /** @type {typeof TABS[number]} */ (raw) : 'ficha';
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

  /** Pestañas visibles según el tipo de persona (externo vs interno). */
  _visibleTabs() {
    return visibleTabsFor(this.person);
  }

  /** Pestaña efectiva: fuerza una visible si la activa no lo está (p. ej. #carrera en un externo). */
  _effectiveTab() {
    return effectiveTabFor(this._tab, this.person);
  }

  /**
   * Navegación por teclado de la barra de pestañas (patrón ARIA tablist con
   * activación automática): ←/→ recorren las pestañas de forma circular y
   * Home/End saltan a la primera/última, moviendo el foco a la nueva pestaña.
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  _onTabsKeydown(e) {
    const tabs = this._visibleTabs();
    const i = tabs.indexOf(this._effectiveTab());
    let next = i;
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    const tab = tabs[next];
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
        ${this._visibleTabs().map((tab) => {
          const selected = this._effectiveTab() === tab;
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
   * `<details>` (mismo patrón summary/detalle que el enfoque por disciplina).
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
   * Sección «Mi carrera»: nivel actual, enfoque por disciplina (addendums) y a
   * qué aspirar. Las expectativas de cada nivel, con su valoración, están en
   * «Expectativas» (RMR-TSK-0707). Espejo del marcado de la
   * sección «Carrera» de <team-person-detail>, con los mismos helpers puros.
   * @returns {import('lit').TemplateResult|null}
   */
  /** «Mi carrera» con tres sub-pestañas: tu nivel y lo que se espera de ti
   *  (RMR-TSK-0262), el mapa/ruta (visual) y la escalera entera (RMR-TSK-0471),
   *  que antes solo se veía desde el editor del panel. */
  _renderCareerTabbed() {
    const sub = careerSubFromHash(this._careerSub);
    const subs = [
      ['nivel', 'Mi nivel'],
      ['plan', 'Plan'],
      ['expectativas', 'Expectativas'],
      ['seguimiento', 'Seguimiento'],
      ['o2o', 'O2O'],
      ['mapa', 'Mapa y ruta'],
      ['escalera', 'La escalera'],
    ];
    return html`
      <div class="subtabs" role="tablist" aria-label="Secciones de Mi carrera">
        ${subs.map(
          ([id, label]) => html`<button
            role="tab"
            aria-selected=${sub === id}
            class="subtab ${sub === id ? 'on' : ''}"
            @click=${() => { this._careerSub = id; }}
          >${label}</button>`,
        )}
      </div>
      <div role="tabpanel">
        ${this._renderCareerSub(sub)}
      </div>
    `;
  }

  /** Enruta la sub-pestaña de «Mi carrera». */
  _renderCareerSub(sub) {
    if (sub === 'mapa') return this._renderMap();
    if (sub === 'escalera') return this._renderLadder();
    if (sub === 'o2o') return this._renderO2O();
    // Mi carrera (RMR-TSK-0684): la misma vista que ve su EM desde la ficha.
    if (sub === 'plan' || sub === 'expectativas' || sub === 'seguimiento') {
      return html`<career-person-panel .person=${this.person} .framework=${this.framework} section=${sub}></career-person-panel>`;
    }
    return this._renderCareer();
  }

  /**
   * La escalera entera: cada itinerario con sus niveles y lo que se espera en
   * cada dimensión (RMR-TSK-0471). Hasta ahora esto solo se veía en el editor
   * del panel, así que para saber a qué aspirar había que ser superadmin o
   * preguntar. Se marca dónde estás y, si lo has declarado, a dónde vas.
   */
  _renderLadder() {
    // La escalera vive en <career-ladder>, que también es la herramienta propia
    // (RMR-TSK-0488): aquí se reutiliza para que el contenido no esté en dos
    // sitios distintos que se desincronicen.
    return html`<career-ladder .framework=${this.framework} .person=${this.person}></career-ladder>`;
  }


  _renderCareer() {
    const fw = this.framework;
    const person = this.person;
    if (!person) return html`<p class="empty">No hay datos de carrera.</p>`;

    const disciplineIds = person.disciplines ?? [];
    const level = getLevel(fw, person.levelId);
    if (!level && disciplineIds.length === 0) {
      return html`<p class="empty">Aún no tienes un nivel de carrera asignado.</p>`;
    }

    const addendums = addendumsForDisciplines(fw, disciplineIds);
    const addendumsByDiscipline = Object.groupBy(addendums, (a) => a.discipline.id);

    return html`
      <p class="sub">Nivel actual</p>
      ${level
        ? html`
            <div class="now">
              <p><span class="code">${this._subLevel?.label ?? level.code}</span> · ${level.title}</p>
              ${this._subLevelLine()}
              ${level.description ? html`<p class="desc">${level.description}</p>` : null}
              ${level.typicalProfile ? html`<p class="profile">Perfil típico: ${level.typicalProfile}</p>` : null}
            </div>
          `
        : html`<p class="empty">Sin nivel asignado.</p>`}

      ${this._renderLevelTimeline(fw)}
      ${this._renderProgressionChart(fw)}

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
   * Línea de tiempo del nivel propio (RMR-PCS-0037 · F1): los cambios registrados
   * en `person.levelHistory`, de reciente a antiguo. Las fichas anteriores a la
   * épica empiezan su relato en el primer cambio — sin historial no se pinta nada.
   * @param {import('../tools/career/data/framework.js').CareerFramework|null} fw
   * @returns {import('lit').TemplateResult|null}
   */
  _renderLevelTimeline(fw) {
    const rows = levelHistoryView(this.person?.levelHistory, fw?.levels ?? []);
    if (rows.length === 0) return null;
    return html`
      <p class="sub">Historial de nivel</p>
      <ul class="lvl-history">
        ${rows.map(
          (r) => html`<li>
            <span class="lvl-change">${r.fromCode ? html`${r.fromCode} → ` : ''}${r.toCode}</span>
            <span class="lvl-when">${r.when}</span>
            ${r.note ? html`<span class="lvl-note">— ${r.note}</span>` : null}
          </li>`,
        )}
      </ul>
    `;
  }

  /**
   * Curva de progresión del sub-nivel propia (RMR-PCS-0037 · F2): derivada al
   * vuelo de la bitácora + historial de nivel contra las rutas publicadas
   * (cargas perezosas). Sin puntos no se pinta nada.
   * @param {import('../tools/career/data/framework.js').CareerFramework|null} fw
   * @returns {import('lit').TemplateResult|null}
   */
  _renderProgressionChart(fw) {
    this._ensureLevelAssessments();
    // Con las VALORACIONES, no con los certificados del mapa (RMR-TSK-0556):
    // formarse no sube de nivel, así que no puede mover esta curva.
    const { points, milestones } = assessmentProgressionSeries({
      person: this.person ?? {},
      framework: fw,
      assessments: this._levelAssessments ?? [],
    });
    if (points.length === 0) return null;
    return html`
      <p class="sub">Progresión en el tiempo</p>
      <career-progression-chart .points=${points} .milestones=${milestones}></career-progression-chart>
    `;
  }

  /**
   * Sección «Mi Role Mirror»: el rol se fija de forma CONJUNTA (RMR-TSK-0224). El
   * manager propone un perfil de partida; aquí el ingeniero lo AFINA él mismo con su
   * propio cuestionario editable (<role-questionnaire> con su personId), que guarda
   * en Firestore y recalcula el rol. Incluye el resultado calculado. Si aún no hay
   * items cargados, mientras tanto no se puede editar.
   * @returns {import('lit').TemplateResult}
   */
  _renderRoleMirror() {
    if (!this.person?.id) return html`<p class="empty">Cargando tu Role Mirror…</p>`;
    return html`
      <p class="rm-intro">Tu manager ha propuesto un perfil de partida. Aquí puedes <strong>afinarlo tú</strong>: tus ajustes se guardan como <strong>propuesta</strong> — tu manager verá qué cambia respecto a su versión y lo decidiréis juntos (idealmente en un O2O). Su versión es la que cuenta hasta entonces.</p>
      <role-questionnaire
        .proposalMode=${true}
        .items=${this.items ?? []}
        .roles=${this.roles ?? []}
        .dimensions=${this.dimensions ?? []}
        .orgConfig=${this.orgConfig ?? null}
        .personId=${this.person.id}
        editorKind="engineer"
        editorUid=${this.person.uid ?? ''}
        editorName=${this.person.name ?? ''}
      ></role-questionnaire>
    `;
  }

  /**
   * Sección «Mi mapa de carrera»: el mismo resumen que ve su manager en la ficha
   * (RMR-TSK-0735), en primera persona y con la puerta al juego.
   * @returns {import('lit').TemplateResult}
   */
  _renderMap() {
    return html`<career-map-summary self .person=${this.person} .island=${this.island} .journey=${this.journey}
      .archipelago=${this.archipelago} .achievements=${this.achievements} .endorsements=${this.endorsements}
      .questions=${this.questions}></career-map-summary>`;
  }

  /**
   * Sección «Mis O2O»: SOLO lo que el manager decidió compartir (resúmenes) y mis
   * acciones. Nunca notas privadas, transcripción ni el resumen privado del
   * manager — eso lo filtra la Cloud Function `getMyO2O` (fuente única bajo el
   * manager). De solo lectura.
   * @returns {import('lit').TemplateResult}
   */
  _renderO2O() {
    const data = this.o2o;
    const sessions = data?.sessions ?? [];
    const actions = data?.actions ?? [];
    const upcoming = data?.upcoming ?? [];
    const conversaciones = conversationsNewestFirst(this.conversations ?? []);
    // El vacío solo es vacío si TAMPOCO hay nada preparado: decir «aún no hay
    // nada» teniendo un O2O con preguntas esperando sería mentir justo a quien
    // venía a prepararlo.
    if (!sessions.length && !actions.length && !upcoming.length && !conversaciones.length) {
      return html`<p class="empty">Aún no hay O2O compartidos contigo. Cuando tu manager comparta un resumen o te asigne acciones, aparecerán aquí.</p>`;
    }
    return html`
      ${upcoming.map((u) => this._renderUpcoming(u))}
      <p class="sub">Resúmenes compartidos</p>
      ${sessions.length
        ? html`<ul class="o2o-list">${sessions.map((s) => this._renderSharedSession(s))}</ul>`
        : html`<p class="empty">Tu manager aún no ha compartido ningún resumen.</p>`}
      <p class="sub">Mis acciones</p>
      ${actions.length
        ? html`<ul class="o2o-list">${actions.map((a) => this._renderMyAction(a))}</ul>`
        : html`<p class="empty">No tienes acciones asignadas.</p>`}
      ${this._renderConversations(conversaciones)}
      <p class="o2o-note">
        De las sesiones de O2O solo ves lo que tu manager ha marcado como compartido;
        sus notas privadas de preparación no son visibles. Lo que sí ves entero es lo
        que queda registrado en tu ficha, aquí abajo.
      </p>
    `;
  }

  /**
   * Lo anotado en TU ficha (RMR-TSK-0578): lo que tu manager escribió después de
   * hablar y lo que dejaron ahí los agentes. Se enseña porque ya era tuyo —las
   * reglas siempre te dejaron leerlo—, y lo que no se ve no se puede corregir:
   * si algo de lo que hay escrito sobre ti está mal, primero hay que poder leerlo.
   *
   * De cada una se dice de DÓNDE viene antes del texto. No se responde igual a
   * una nota que escribió tu manager que a un resumen que generó una máquina.
   */
  _renderConversations(conversaciones) {
    if (!conversaciones.length) return null;
    return html`
      <p class="sub">Anotado en tu ficha</p>
      <ul class="o2o-list">
        ${conversaciones.map((c) => {
          const origen = conversationOrigin(c);
          return html`<li class="o2o-card">
            <span class="date">${c.date ?? 'sin fecha'}</span>
            <span class="origin ${origen.kind}">${origen.label}</span>
            ${origen.url ? html` <a class="origin-link" href=${origen.url} target="_blank" rel="noopener noreferrer">ver origen</a>` : null}
            ${c.summary ? html`<p class="body">${c.summary}</p>` : null}
            ${c.notes ? html`<p class="body">${c.notes}</p>` : null}
          </li>`;
        })}
      </ul>`;
  }

  /**
   * El O2O que viene: el periodo que ha preparado el manager y los temas para
   * pensar antes. Solo el formulario previo — la guía que él usará durante la
   * conversación es suya y ni siquiera llega al navegador.
   * @param {import('../lib/o2o.js').UpcomingO2O} u
   * @returns {import('lit').TemplateResult}
   */
  _renderUpcoming(u) {
    return html`
      <div class="next">
        <h4>Tu próximo O2O · ${u.name}</h4>
        ${u.form.intro ? html`<p class="intro">${u.form.intro}</p>` : null}
        ${u.form.sections.map((s) => this._renderUpcomingSection(s))}
        <p class="hint">Son temas para pensar antes de la conversación, no un formulario que rellenar.</p>
      </div>`;
  }

  /** Una sección del formulario previo. @returns {import('lit').TemplateResult} */
  _renderUpcomingSection(section) {
    return html`
      <div class="sec">
        <h5>${section.title}</h5>
        <ul>${section.questions.map((q) => html`<li>${q.text}</li>`)}</ul>
      </div>`;
  }

  /** Una sesión compartida (fecha + resumen). @returns {import('lit').TemplateResult} */
  _renderSharedSession(s) {
    return html`<li class="o2o-card">
      <div class="date">${s.date?.slice(0, 10)}</div>
      <p class="body">${s.sharedSummary}</p>
    </li>`;
  }

  /** Una acción del ingeniero (marcada hecha o no). @returns {import('lit').TemplateResult} */
  _renderMyAction(a) {
    const done = a.status === 'done';
    const who = a.owner === 'leader' ? '(manager)' : '';
    return html`<li class="o2o-act ${done ? 'done' : ''}">
      ${done ? '✓' : '○'} <span>${a.description}</span> <span class="track">${who}</span>
    </li>`;
  }

  render() {
    const tab = this._effectiveTab();
    const meta = TAB_META[tab];
    // Cada pestaña reutiliza su método de render existente (sin duplicar lógica).
    const panel = {
      ficha: () => this._renderFicha(),
      carrera: () => this._renderCareerTabbed(),
      rolemirror: () => this._renderRoleMirror(),
      motivadores: () => this._renderMotivadores(),
      o2o: () => this._renderO2O(),
      marea: () => this._renderMarea(),
      retros: () => this._renderRetros(),
      kudos: () => this._renderKudos(),
    }[tab];

    return html`
      ${this._renderTabs()}
      <section
        id="panel-${tab}"
        class="${meta.cls}"
        role="tabpanel"
        aria-labelledby="tab-${tab}"
        tabindex="0"
      >
        <h2>${meta.heading}</h2>
        ${panel()}
      </section>
    `;
  }

  /** Pestaña Marea: el pulso semanal del propio ingeniero (RMR-BUG-0036). */
  _renderMarea() {
    return html`<marea-app .uid=${this.person?.uid ?? null}></marea-app>`;
  }

  /** Rutas del reto para el sub-nivel derivado (RMR-PCS-0034): carga perezosa
   *  y tolerante — sin rutas, la ficha sale sin la fila de progresión. */
  /** Mis valoraciones por nivel, para la curva (RMR-TSK-0556): carga perezosa y
   *  tolerante — sin valoraciones cerradas, la gráfica simplemente no sale. */
  async _ensureLevelAssessments() {
    if (this._levelAssessments !== undefined || !this.person?.id) return;
    this._levelAssessments = null;
    try {
      this._levelAssessments = await listLevelAssessments(this.person.id);
      this.requestUpdate();
    } catch { /* sin curva */ }
  }

  /** Bitácora propia para la curva de progresión (RMR-PCS-0037 · F2): carga
   *  perezosa y tolerante — sin bitácora, la gráfica simplemente no sale. */
  async _ensureLogbook() {
    if (this._logbook !== undefined || !this.person?.id) return;
    this._logbook = null;
    try {
      this._logbook = await getPersonLogbook(this.person.id);
      this.requestUpdate();
    } catch { /* sin curva */ }
  }

  /** Pestaña Kudos (RMR-TSK-0405): la herramienta general completa —
   *  muro semanal, dar las gracias y los privados propios. */
  _renderKudos() {
    return html`<kudos-app .uid=${this.person?.uid ?? null}></kudos-app>`;
  }

  /** Pestaña Retros: las retros del equipo del ingeniero, para participar (RMR-TSK-0247). */
  _renderRetros() {
    return html`<retro-app .uid=${this.person?.uid ?? null} .leaderUid=${this.person?.ownerLeaderUid ?? null}
      .canManage=${false} .members=${[]}
      .authorName=${this.person?.name ?? ''}></retro-app>`;
  }

  /** El subnivel, de la MISMA función que ve su manager (RMR-TSK-0695): expectativas
   *  aceptadas con el ajuste del manager encima. El mapa es formación y no lo mueve. */
  updated(changed) {
    if (!(changed.has('person') || changed.has('framework')) || !this.person?.id || !this.framework) return;
    const id = this.person.id;
    getPersonSubLevel(this.person, this.framework)
      .then((s) => { if (this.person?.id === id) Object.assign(this, { _subLevel: s, _subLevelError: '' }); })
      .catch((err) => { if (this.person?.id === id) this._subLevelError = `No se pudo calcular tu subnivel: ${err.message}`; });
  }

  /** «L2-3 — 75% de L3 cumplido (…) — ajustado por tu manager: «…»», igual en todas partes. */
  _subLevelText() {
    const s = this._subLevel;
    if (this._subLevelError) return this._subLevelError;
    if (!s) return null;
    const note = s.note ? `: «${s.note}»` : '';
    const manual = s.source === 'manual' ? `ajustado por tu manager${note}` : null;
    return [s.label, subLevelCalcText(s), manual].filter(Boolean).join(' — ');
  }

  _subLevelLine() {
    const text = this._subLevelText();
    return text ? html`<p class="profile">${text}</p>` : null;
  }

  /** Pestaña «Mi ficha» (RMR-TSK-0260): datos de la persona; si es su propia
   *  ficha, el editor debajo para cambiarlos. Un externo ve sus datos básicos. */
  _renderFicha() {
    // Todos tus datos en un solo sitio (RMR-TSK-0697), los mismos que ve tu manager en tu ficha.
    const p = this.person ?? {};
    const fw = this.framework;
    const internal = !p.external;
    const title = internal && fw ? composeTitle(fw, p.levelId, p.disciplines) : '';
    const discNames = (p.disciplines ?? []).map((id) => fw?.disciplines?.find((d) => d.id === id)?.name ?? id);
    const guilds = (p.guilds ?? []).map((g) => (g === p.primaryGuild ? `${g} (principal)` : g));
    const rows = [
      ['Nombre', p.name],
      ['Título', title || null],
      ['Progresión', internal ? this._subLevelText() : null],
      ['Disciplinas', discNames.join(', ') || null],
      ['Fecha de alta', p.startDate ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${p.startDate}T00:00:00`)) : null],
      ['Gremios', guilds.join(', ') || null],
      // A qué pertenece: el DOMINIO (su producto). El squad ya no se enseña: la
      // transición terminó y nadie tiene squad sin dominio (ADR de dominios, F5).
      ['Dominio', membershipLabel(p, this.domains)],
      ['Ubicación', p.location],
      ['Email', p.email ?? getCurrentUser()?.email ?? null],
      ['GitHub', p.githubLogin],
    ].filter(([, v]) => v);
    const note = internal ? null : html`<p class="datos-note">Eres una persona externa: aquí ves tus datos básicos y, en «Mis O2O», lo que tu responsable comparta contigo.</p>`;
    return html`
      ${note}
      <dl class="datos-dl">
        ${rows.map(([k, v]) => html`<div class="datos-row"><dt>${k}</dt><dd>${v}</dd></div>`)}
      </dl>
    `;
  }

  /** Pestaña «Motivadores» (RMR-TSK-0260): los juegos de cartas, integrados aquí
   *  (antes eran dos tarjetas sueltas fuera de las pestañas). */
  _renderMotivadores() {
    return html`
      <p class="mot-lead">Juegos de reflexión personal por rondas: ordena qué te mueve y qué necesitas sentir en tu equipo.</p>
      <div class="mot-grid">
        <a class="mot-card moving" href="/tools/motivators/moving">
          <span class="mot-emoji" aria-hidden="true">🃏</span>
          <span class="mot-text"><strong>Moving Motivators</strong><small>Qué te mueve en el trabajo</small></span>
        </a>
        <a class="mot-card affective" href="/tools/motivators/affective">
          <span class="mot-emoji" aria-hidden="true">💗</span>
          <span class="mot-text"><strong>Affective Motivators</strong><small>Qué necesitas sentir en tu equipo</small></span>
        </a>
      </div>
    `;
  }
}

if (!customElements.get('engineer-space')) {
  customElements.define('engineer-space', EngineerSpace);
}
