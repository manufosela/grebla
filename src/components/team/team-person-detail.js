/**
 * <team-person-detail>
 * Ficha de una persona. En esta fase cubre las dos dimensiones de nivel 1-7
 * independientes (R1): Seniority y Emocional. Para cada una: estado actual
 * (última lectura), formulario de registro (selector de nivel + nota) e
 * histórico ascendente (R2). Conocimiento, contribución, conversaciones y notas
 * llegan en fases posteriores.
 *
 * Propiedades:
 *  - persistence: PersistencePort (inyectado por <team-app>)
 *  - person: Person
 */
import { LitElement, html, css } from 'lit';
import { tableStyles } from '../common/table-styles.js';
import { noteStyles } from '../common/note-styles.js';
import { skeletonLines } from '../app-skeleton.js';
import './team-level-input.js';
import {
  addReading,
  getPersonTimeline,
  listAreas,
  updatePerson,
  listGuilds,
  normalizeInviteEmail,
} from '../../tools/team/application/usecases/index.js';
import { listUsers } from '../../lib/users.js';
import { listToolPolicies } from '../../lib/toolPolicies.js';
import { listLeaders } from '../../lib/leaders.js';
import '../common/person-permissions.js';
import { levelLabel, levelToNumber } from '../../tools/team/domain/levels.js';
import { appendLevelChange, normalizeLevelHistory, levelHistoryView, correctLevel } from '../../tools/team/domain/levelHistory.js';
import { assessmentProgressionSeries } from '../../tools/career/domain/progression.js';
import { listCareerRoutes } from '../../lib/careerMap.js';
import '../career/career-progression-chart.js';
import { sparkline, sparklineTrend, SPARK_MAX } from '../../tools/team/domain/services/sparkline.js';
import { BELBIN_ROLES, BELBIN_BY_SIGLA } from '../../tools/team/domain/belbin.js';
import { getCurrentUser } from '../../lib/auth.js';
import {
  composeTitle,
  getLevel,
  expectationsForLevel,
  addendumsForDisciplines,
  aspirationalLevels,
} from '../../tools/career/data/framework.js';
import { getLevelAssessment, saveLevelAssessment, listLevelAssessments, getPersonSubLevel } from '../../lib/careerAssessment.js';
import { normalizeLevelAssessment, markDimension, marksOf, closeAssessment, closureHistory, lastClosure } from '../../tools/career/data/levelAssessment.js';
import { levelProgressFor, levelCompletion, subLevelCalcText } from '../../tools/career/domain/levelProgress.js';
import { nextLevelFor } from '../../tools/career/domain/subLevel.js';
import { atTopOfLadder } from '../../tools/career/domain/ladderTop.js';
import { expectationWeight } from '../../tools/career/data/framework.js';
import '../career-person/career-person-panel.js';
import { getPersonLogbook, getMyCareerMap } from '../../lib/engineer.js';
import '../career/career-map-summary.js';
import '../career/career-recommend.js';
import { completedRoutes, formatDuration } from '../../tools/career/domain/logbook.js';
import { formatAchievedAt } from '../../tools/career/domain/achievements.js';
import { disciplinesForGuilds } from '../../tools/team/domain/guildDisciplines.js';
import { normalizePrimaryGuild } from '../../tools/team/domain/primaryGuild.js';
import { BELBIN_ITEMS, BELBIN_SCALE } from '../../tools/team/data/belbinItems.js';
import { proposeRoles, evidenceFor } from '../../tools/team/domain/belbinSurvey.js';
import { isNotionSynced } from '../../lib/notionSync.js';
import { withoutNotionFields } from '../../tools/team/domain/notionFields.js';
import { listOrgBranches } from '../../lib/orgBranches.js';
import { listOrgRoles } from '../../lib/orgRoles.js';
import { getEmployeeDomain } from '../../lib/orgConfig.js';
import { inviteDomainError } from '../../tools/team/domain/inviteDomain.js';
import { departmentHasGuilds } from '../../tools/team/domain/guildScope.js';
import '../o2o/manager-notes.js';
import '../o2o/person-o2o-panel.js';
import '../rm-person.js';
import { getOrgConfig } from '../../lib/firestore.js';
import { withRoleMirrorTab } from '../../tools/team/domain/roleMirrorScope.js';
import { ITEMS, DIMENSIONS as RM_DIMENSIONS } from '../../data/items.js';
import { ROLES } from '../../data/roles.js';

const CONTRIB_STATES = [
  { value: '', label: '—' },
  { value: 'secondary', label: 'Secundario' },
  { value: 'primary', label: 'Primario' },
];

const dateFmt = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

/** @param {string} iso */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

/**
 * Autor de una entrada tomado del usuario logueado. Sin fallback silencioso para
 * el uid: si no hay usuario con uid, devuelve undefined y no se registra autoría
 * (degradación con gracia). El nombre visible sí admite ?? (displayName → email).
 * @returns {{ uid: string, name: string }|undefined}
 */
function currentAuthor() {
  const user = getCurrentUser();
  if (!user?.uid) return undefined;
  return { uid: user.uid, name: user.displayName ?? user.email ?? 'Usuario' };
}

const DIMENSIONS = [
  {
    key: 'seniority',
    label: 'Seniority',
    bias: 'Sesgo de observabilidad: lo visible no es toda la capacidad. Provoca que emerja lo que no se manifiesta solo; no confundas volumen con madurez.',
  },
  {
    key: 'emotional',
    label: 'Emocional',
    bias: 'Sesgo jerárquico y relacional: la persona filtra lo que muestra a quien tiene autoridad. Contrasta con otros observadores y cuida a quien tratas menos. Marca como provisional si aún hay poca historia.',
  },
];

/**
 * Sub-pestañas de la ficha de persona. El orden define el recorrido con las
 * flechas del teclado y el primer elemento (`carrera`) es el activo por defecto.
 * @type {ReadonlyArray<{ id: string, label: string }>}
 */
const SUBTABS = [
  { id: 'datos', label: 'Datos' },
  { id: 'carrera', label: 'Carrera' },
  { id: 'dimensiones', label: 'Dimensiones' },
  { id: 'conversations', label: 'O2O' },
  { id: 'perf', label: 'Performance Review' },
];

/**
 * Sub-sub-pestañas de la pestaña «Dimensiones»: las cuatro dimensiones de
 * evaluación agrupadas bajo un único primer nivel. El orden define el recorrido
 * con las flechas del teclado y el primero (`seniority`) es el activo por defecto.
 * Los ids coinciden con los que envía el Mapa en `open-person` (deep-link).
 * @type {ReadonlyArray<{ id: string, label: string }>}
 */
const DIM_SUBTABS = [
  { id: 'seniority', label: 'Seniority' },
  { id: 'emotional', label: 'Emocional' },
  { id: 'knowledge', label: 'Conocimiento' },
  { id: 'contribution', label: 'Contribución' },
];

/** Carrera de una persona externa: nivel, plan y objetivos (RMR-TSK-0764). */
const EXTERNAL_SUBTABS = [
  { id: 'nivel', label: 'Nivel' },
  { id: 'plan', label: 'Plan' },
  { id: 'objetivos', label: 'Objetivos' },
];

/** Lo que sobra a quien está en el tope de su vía (RMR-TSK-0761). */
const TOP_HIDDEN = new Set(['seguimiento', 'aspiraciones']);

/** Sub-sub-pestañas de «Carrera»: parten el contenido para evitar un scroll largo. */
const CAREER_SUBTABS = [
  { id: 'nivel', label: 'Nivel' },
  { id: 'plan', label: 'Plan' },
  { id: 'expectativas', label: 'Expectativas y objetivos' },
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'mapa', label: 'Mapa' },
  { id: 'aspiraciones', label: 'Aspiraciones' },
];

export class TeamPersonDetail extends LitElement {
  static properties = {
    persistence: { attribute: false },
    person: { attribute: false },
    framework: { attribute: false },
    isAdmin: { attribute: false },
    currentUid: { attribute: false },
    editorPerson: { attribute: false },
    initialSubtab: { attribute: false },
    _leaderUids: { state: true },
    timeline: { state: true },
    areas: { state: true },
    loading: { state: true },
    error: { state: true },
    _subtab: { state: true },
    _dimSubtab: { state: true },
    _careerSubtab: { state: true },
    _form: { state: true },
    _know: { state: true },
    _contrib: { state: true },
    /** Respuestas del cuestionario de apoyo: reactivo, la propuesta se repinta
     *  a cada conducta marcada (RMR-TSK-0494). */
    _belbinAnswers: { state: true },
    /** Su mapa de carrera, leído al abrir Carrera › Mapa: { personId, data|error } (RMR-TSK-0736). */
    _careerMap: { state: true },
    /** Configuración de la organización para Role Mirror; undefined = sin leer (RMR-TSK-0734). */
    _orgConfig: { state: true },
    _career: { state: true },
    _logbook: { state: true },
    _routes: { state: true },
    _datos: { state: true },
    _guildsCat: { state: true },
    /** Roles del organigrama: la cabecera dice el rol de la persona (RMR-TSK-0761). */
    _rolesCat: { state: true },
    _usersCat: { state: true },
    _datosSaving: { state: true },
    _datosError: { state: true },
    /** ¿Manda Notion en esta instancia? Sus campos se ven pero no se editan (RMR-TSK-0588). */
    _notionSync: { state: true },
    _branchesCat: { state: true },
    _datosSaved: { state: true },
    _careerSaving: { state: true },
    _careerError: { state: true },
    /** Valoración contra el nivel SIGUIENTE (RMR-PCS-0044): lo guardado y el borrador. */
    _nextAssessment: { state: true },
    /** Subnivel efectivo (cálculo + ajuste del manager), el mismo de toda la app. */
    _subLevel: { state: true },
    _subLevelError: { state: true },
    /** Borrador del ajuste manual del subnivel; null si no se está ajustando. */
    _subDraft: { state: true },
    /** Todas las valoraciones por nivel, para la curva (RMR-TSK-0556). */
    _levelAssessments: { state: true },
    _progressDraft: { state: true },
    _progressSaving: { state: true },
    _progressError: { state: true },
    _progressSaved: { state: true },
    _toolPolicies: { state: true },
  };

  static styles = [tableStyles, noteStyles, css`
    :host { display: block; }
    .head { margin-bottom: 1rem; }
    .head h2 { margin: 0; font-size: 1.3rem; }
    .head .title { margin: 0.3rem 0 0; font-size: 0.95rem; font-weight: 600; color: var(--rm-text, #111827); }
    .head .role { margin: 0.2rem 0 0; font-size: 0.95rem; font-weight: 700; color: var(--rm-text, #111827); }
    .head .chips { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
    .chip { background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    h3 { font-size: 1rem; margin: 0 0 0.75rem; }
    .form { display: grid; gap: 0.6rem; margin: 0.5rem 0 1rem; }
    textarea, input[type='date'], input[type='text'] {
      border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; padding: 0.5rem 0.6rem;
      font: inherit; font-size: 0.9rem; color: var(--rm-text, #111827); background: var(--rm-field, #eef2f6);
    }
    textarea { resize: vertical; min-height: 2.4rem; }
    .row { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    button.primary {
      border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff);
      border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .hist { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    /* Cada entrada es un BLOQUE, no una fila. Antes era un flex horizontal con
       varios elementos en nowrap: cuando no cabian no bajaban de linea, se
       montaban unos encima de otros y no se leia nada (RMR-TSK-0592). */
    .hist li { padding: 0.55rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    /* La cabecera SI puede envolver: quien, cuando, de que tipo y de donde vino. */
    .hist .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; }
    .hist .when { color: var(--rm-muted, #5b6b7d); }
    .hist .lvl { font-weight: 600; }
    /* El texto, en su propia linea y a ancho completo: es lo que se viene a leer,
       no un resto que compite por el hueco que quede. */
    .hist .note { display: block; margin: 0.25rem 0 0; color: var(--rm-text, #111827); line-height: 1.5; white-space: pre-wrap; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.85rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    label.fld { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); font-weight: 600; }
    select { border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; padding: 0.5rem 0.6rem; font: inherit; font-size: 0.9rem; background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); }
    section.support { border-left: 4px solid var(--rm-warning, #f2887a); }
    .disclaimer { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); background: var(--rm-coral-soft, #fdecea); border-radius: 8px; padding: 0.5rem 0.75rem; margin: 0 0 0.75rem; }
    .hist .del { margin-left: auto; white-space: nowrap; }
    .link { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); padding: 0 0.2rem; }
    .link.yes { color: var(--rm-danger, #dc2626); }
    .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.75rem; }
    .belbin { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.4rem 1rem; }
    .belbin-survey { display: grid; gap: 0.5rem; margin: 0 0 1rem; }
    .bs-row {
      display: grid; grid-template-columns: 1fr auto; gap: 0.7rem; align-items: center;
      border-top: 1px solid var(--rm-border, #eef0f2); padding-top: 0.5rem;
    }
    .bs-text { font-size: 0.88rem; }
    .bs-result {
      border: 1px solid var(--rm-accent, #2a9d8f); border-radius: 10px;
      padding: 0.8rem 1rem; background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 6%, transparent);
    }
    .bs-group h4 { font-size: 0.85rem; margin: 0.2rem 0 0.4rem; }
    .bs-prop { margin: 0 0 0.6rem; }
    .bs-why { margin: 0.2rem 0 0; padding-left: 1.1rem; font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); }

    .belbin-row { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
    .belbin-row .b-name { font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bias { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); background: var(--rm-coral-soft, #fdecea); border-radius: 8px; padding: 0.45rem 0.7rem; margin: 0 0 0.75rem; }
    section.career { border-left: 4px solid var(--rm-accent, #2a9d8f); }
    .career .lead { font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 0.85rem; }
    .career .sub { font-size: 0.85rem; font-weight: 700; color: var(--rm-text, #111827); margin: 1.1rem 0 0.35rem; }
    .career .now .code { font-weight: 700; }
    .career .now .desc { font-size: 0.85rem; color: var(--rm-text, #111827); margin: 0.2rem 0 0; }
    .career .now .profile { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); margin: 0.2rem 0 0; }
    .career .expect { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    .career .expect li { padding: 0.4rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .career .expect .dim { font-weight: 700; }
    .career .expect .txt { color: var(--rm-text, #111827); }
    .career .expect .todo { color: var(--rm-muted, #5b6b7d); font-style: italic; }
    .career .addn { margin: 0.3rem 0 0; }
    .career .addn .disc { font-weight: 700; font-size: 0.85rem; margin: 0.6rem 0 0.2rem; }
    .career .addn ul { list-style: none; margin: 0; padding: 0; font-size: 0.83rem; }
    .career .addn li { padding: 0.25rem 0; }
    .career .addn .dim { font-weight: 600; }
    .career .aspire { list-style: none; margin: 0; padding: 0; }
    .career .aspire > li { border-top: 1px solid var(--rm-border, #eef0f2); }
    .career .aspire summary { cursor: pointer; padding: 0.45rem 0; font-size: 0.88rem; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
    .career .aspire summary::-webkit-details-marker { color: var(--rm-muted, #5b6b7d); }
    .career .aspire .code { font-weight: 700; }
    .career .aspire .track { color: var(--rm-muted, #5b6b7d); font-size: 0.78rem; }
    .career .aspire .desc { font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 0.5rem; padding-left: 1.1rem; }
    .career .target-declared { margin: 0.2rem 0 0; font-size: 0.9rem; font-weight: 700; color: var(--rm-accent, #2a9d8f); }
    .career .target-declared .code { font-weight: 800; }
    .career .target-none { margin: 0.2rem 0 0; font-size: 0.83rem; color: var(--rm-muted, #5b6b7d); font-style: italic; }
    .career .top-note { margin: 0 0 0.8rem; padding: 0.5rem 0.75rem; border-radius: 10px; font-size: 0.86rem;
      border: 1px solid var(--rm-border, #cbd5e1); color: var(--rm-text, #111827); background: var(--rm-surface, #fff); }
    .career .target-edit { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.4rem; }
    .career .target-edit select { font: inherit; font-size: 0.85rem; padding: 0.3rem 0.5rem; border-radius: 8px;
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); }
    .career .routes-done { list-style: none; margin: 0.2rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .career .route-done-row { display: flex; flex-direction: column; gap: 0.05rem; padding: 0.4rem 0.55rem; border-radius: 8px; background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 8%, transparent); }
    .career .route-done-row .rd-name { font-weight: 700; font-size: 0.85rem; color: var(--rm-text, #111827); }
    .career .route-done-row .rd-meta { font-size: 0.76rem; color: var(--rm-muted, #5b6b7d); }
    /* Pestaña «Datos» (RMR-TSK-0173). */
    /* Rejilla: los campos se reparten en varias columnas según el ancho, cada uno
       con su tamaño; no una sola columna estrecha con un campo por línea. */
    .datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
      gap: 0.9rem 1.2rem; align-items: start; }
    /* A fila completa: el email (lleva texto de ayuda), el aviso de cuenta, los
       fieldsets de checks, los mensajes y la barra de acciones. */
    .datos .fld:has(.fld-hint), .datos .acct, .datos .datos-checks,
    .datos .error, .datos .datos-actions, .datos .hint, .datos .notion-datos { grid-column: 1 / -1; }
    /* Datos de Notion en solo lectura (RMR-TSK-0588): etiqueta y valor en rejilla. */
    .datos .notion-datos { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; margin: 0; }
    .datos .notion-datos dt { font-size: 0.82rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .datos .notion-datos dd { margin: 0; color: var(--rm-text, #111827); }
    .datos .fld { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.82rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .datos .fld input { font: inherit; font-weight: 400; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; }
    .datos .fld .chk-loc { display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 400; font-size: 0.9rem; color: var(--rm-text, #111827); }
    .datos .fld .chk-loc input { width: auto; }
    .datos .fld.chk-ext { flex-direction: row; align-items: center; gap: 0.4rem; font-weight: 400; font-size: 0.9rem; color: var(--rm-text, #111827); }
    .datos .fld.chk-ext input { width: auto; }
    .datos-checks { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.5rem 0.7rem; margin: 0; }
    .datos-checks legend { font-size: 0.8rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); padding: 0 0.3rem; }
    .datos-checks .chk { display: inline-flex; align-items: center; gap: 0.35rem; margin: 0.15rem 0.7rem 0.15rem 0; font-size: 0.82rem; }
    .datos-checks .empty { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); }
    .datos-checks .orphan-tag { font-style: normal; font-size: 0.7rem; color: var(--rm-danger, #dc2626); }
    .datos .acct { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: 0.85rem; margin: 0; }
    .datos .acct .empty { color: var(--rm-muted, #5b6b7d); }
    .datos .acct .act { border: 1px solid var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f); background: var(--rm-surface, #fff); border-radius: 999px; padding: 0.35rem 0.8rem; font-weight: 700; cursor: pointer; }
    .datos-actions { display: flex; align-items: center; gap: 0.7rem; }
    .datos-actions .primary { background: var(--rm-accent, #2a9d8f); border: none; color: #fff; border-radius: 8px; padding: 0.5rem 1rem; font-weight: 800; cursor: pointer; }
    .datos-actions .saved { color: var(--rm-accent, #2a9d8f); font-weight: 700; font-size: 0.85rem; }
    .datos .fld-hint { font-weight: 400; font-size: 0.75rem; color: var(--rm-muted, #5b6b7d); }

    /* ── Subtab Organización: opciones grandes en rejilla (RMR-TSK-0369) ── */
    /* Sin fieldset/legend: el subtab ya nombra la categoría (no repetir). */
    .org-checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); gap: 0.6rem; }
    .org-checks .chk { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 0.9rem; border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; font-size: 0.95rem; color: var(--rm-text, #111827); cursor: pointer; transition: border-color 0.12s ease, background 0.12s ease; }
    .org-checks .chk:hover { border-color: var(--rm-accent, #2a9d8f); }
    .org-checks .chk:has(input:checked) { border-color: var(--rm-accent, #2a9d8f); background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 12%, transparent); font-weight: 700; }
    .org-checks .chk input { width: 1.15rem; height: 1.15rem; accent-color: var(--rm-accent, #2a9d8f); flex: none; }
    .org-checks .orphan-tag { font-style: normal; font-size: 0.72rem; color: var(--rm-danger, #dc2626); }

    /* ── Gremio principal (RMR-TSK-0594): solo con dos o más gremios ── */
    .primary-guild { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 0.9rem 1rem 1rem; margin: 0; display: grid; gap: 0.6rem; }
    .primary-guild legend { padding: 0 0.4rem; font-size: 0.9rem; font-weight: 700; color: var(--rm-text, #111827); }
    .primary-guild .hint { margin: 0; font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); }
    .primary-guild .warn { margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--rm-danger, #b91c1c); }


    /* ── Valoración frente al nivel (verde «cumple» / rojo «no llega») ── */
    .career .assess { list-style: none; margin: 0.3rem 0 0.75rem; padding: 0; display: grid; gap: 0.6rem; }
    .career .assess-row { border: 1px solid var(--rm-border, #e5e7eb); border-left-width: 4px; border-radius: 8px; padding: 0.6rem 0.8rem; }
    .career .assess-row.ok { border-left-color: var(--rm-accent, #2a9d8f); }
    .career .assess-row.bad { border-left-color: var(--rm-danger, #dc2626); }
    .career .assess-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
    .career .assess-head .dim { font-weight: 700; font-size: 0.9rem; }
    .career .seg { display: inline-flex; border: 1px solid var(--rm-border, #d1d5db); border-radius: 999px; overflow: hidden; }
    .career .seg-btn { border: 0; background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d); font: inherit; font-size: 0.8rem; font-weight: 700; padding: 0.35rem 0.9rem; cursor: pointer; }
    .career .seg-btn + .seg-btn { border-left: 1px solid var(--rm-border, #d1d5db); }
    .career .seg-btn:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: -2px; }
    .career .seg-btn.ok.on { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .career .seg-btn.bad.on { background: var(--rm-danger, #dc2626); color: var(--rm-on-accent, #fff); }
    .career .assess-row .exp { margin: 0.5rem 0 0; }
    .career .assess-row .exp summary { cursor: pointer; font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); }
    .career .assess-row .exp p { margin: 0.3rem 0 0; font-size: 0.85rem; color: var(--rm-text, #111827); }
    .career .assess-row .todo { margin: 0.5rem 0 0; font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); font-style: italic; }
    .career .note-fld { margin: 0.5rem 0 0; }
    .career .saved { color: var(--rm-accent, #2a9d8f); font-size: 0.83rem; font-weight: 600; }
    .career .improve { list-style: none; margin: 0.3rem 0 0; padding: 0; font-size: 0.85rem; }
    .career .improve li { padding: 0.4rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .career .improve .dim { font-weight: 700; color: var(--rm-danger, #dc2626); }
    .career .improve .note { margin: 0.2rem 0 0; color: var(--rm-muted, #5b6b7d); font-size: 0.83rem; }
    .career .suggest { margin: 0.2rem 0 0; font-size: 0.9rem; color: var(--rm-text, #111827); }

    /* ── Rediseño de dimensiones: Actual destacado + alta plegable + tabla + gráfico ── */
    .actual {
      display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.4rem 0.9rem;
      border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--rm-accent, #2a9d8f);
      border-radius: 10px; padding: 0.7rem 1rem; margin: 0 0 0.9rem; background: var(--rm-track, #e9f0f2);
    }
    .actual .tag { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rm-accent, #2a9d8f); }
    .actual .val { font-size: 1.15rem; font-weight: 800; line-height: 1.1; color: var(--rm-text, #111827); }
    .actual .at { font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); }
    .actual.none { border-left-color: var(--rm-border, #d1d5db); background: transparent; }
    .actual .void { font-size: 0.92rem; color: var(--rm-muted, #5b6b7d); font-style: italic; }
    .actual .areas { display: flex; flex-wrap: wrap; gap: 0.3rem; }

    details.add { margin: 0 0 1rem; border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; }
    details.add > summary { cursor: pointer; padding: 0.6rem 0.9rem; font-size: 0.88rem; font-weight: 700; color: var(--rm-accent, #2a9d8f); list-style: none; }
    details.add > summary::-webkit-details-marker { display: none; }
    details.add > summary:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: -2px; border-radius: 10px; }
    details.add[open] > summary { border-bottom: 1px solid var(--rm-border, #eef0f2); }
    details.add .form { margin: 0.8rem 0.9rem; }

    .evo { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 1.25rem; align-items: start; }
    @media (max-width: 640px) { .evo { grid-template-columns: 1fr; } }
    .evo-chart { min-width: 0; }
    .evo-table { min-width: 0; overflow-x: auto; }

    svg.spark { display: block; width: 100%; height: auto; }
    svg.spark .spark-line { stroke: var(--rm-accent, #2a9d8f); stroke-width: 2; fill: none; }
    svg.spark .spark-dot { fill: var(--rm-accent, #2a9d8f); }
    svg.spark .spark-axis { stroke: var(--rm-border, #e5e7eb); stroke-width: 1; }
    .chart-empty { font-size: 0.83rem; color: var(--rm-muted, #5b6b7d); font-style: italic; margin: 0.25rem 0; }

    table.htable { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    table.htable caption { text-align: left; font-size: 0.78rem; font-weight: 700; color: var(--rm-muted, #5b6b7d); padding: 0 0 0.4rem; }
    table.htable th, table.htable td { text-align: left; padding: 0.4rem 0.6rem 0.4rem 0; border-bottom: 1px solid var(--rm-border, #eef0f2); vertical-align: top; }
    table.htable thead th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--rm-muted, #5b6b7d); font-weight: 700; }
    table.htable td.when { color: var(--rm-muted, #5b6b7d); white-space: nowrap; }
    table.htable td.lvl { font-weight: 600; color: var(--rm-text, #111827); }
    table.htable td.note { color: var(--rm-muted, #5b6b7d); }

    ul.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    ul.bars .bar-row { display: grid; grid-template-columns: minmax(5rem, 8rem) 1fr auto; align-items: center; gap: 0.5rem; }
    ul.bars .bar-name { font-size: 0.82rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    ul.bars .bar-track { height: 0.55rem; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; }
    ul.bars .bar-fill { display: block; height: 100%; background: var(--rm-accent, #2a9d8f); border-radius: 999px; }
    ul.bars .bar-val { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); white-space: nowrap; }

    .freq { font-size: 0.83rem; color: var(--rm-muted, #5b6b7d); margin: 0.85rem 0 0; }
    .freq strong { color: var(--rm-text, #111827); }

    /* ── Barra de sub-pestañas (patrón ARIA tablist, coherente con Ajustes) ── */
    /* Pestañas REALES (subrayado de acento pegado a la línea base, no píldoras). */
    .tabs { display: flex; gap: 0.1rem; margin-bottom: 1.25rem; flex-wrap: wrap; border-bottom: 2px solid var(--rm-border, #e5e7eb); }
    .tab {
      border: 0; background: none; color: var(--rm-muted, #5b6b7d);
      padding: 0.6rem 1rem; font: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer;
      border-bottom: 3px solid transparent; margin-bottom: -2px; border-radius: 6px 6px 0 0;
    }
    .tab.active { color: var(--rm-accent, #2a9d8f); border-bottom-color: var(--rm-accent, #2a9d8f); }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); background: color-mix(in srgb, var(--rm-text, #111827) 5%, transparent); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: -2px; border-radius: 6px; }
    /* Tablist anidado (sub-sub-pestañas de «Dimensiones»): mismo patrón, un punto
       menos de tamaño para leerse como segundo nivel sin perder contraste. */
    .tabs-nested { margin-bottom: 1rem; }
    .tabs-nested .tab { font-size: 0.82rem; padding: 0.32rem 0.85rem; }
    .subpanel:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: var(--rm-radius, 12px); }

    /* ── Editor inline de carrera (nivel + disciplinas) ── */
    .career-editor { display: grid; gap: 0.75rem; margin: 0.25rem 0 1.25rem; }
    .career-editor .edit-hint { margin: 0; font-size: 0.83rem; color: var(--rm-muted, #5b6b7d); }
    .career-editor .fld { max-width: 28rem; }
    fieldset.disc { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 8px; padding: 0.6rem 0.9rem; margin: 0; }
    fieldset.disc legend { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); font-weight: 600; padding: 0 0.35rem; }
    .disc-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.35rem 1rem; }
    .disc-check { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; cursor: pointer; }
    .lvl-history { margin-top: 0.5rem; }
    .lvl-history .sub { font-size: 0.85rem; font-weight: 700; color: var(--rm-text, #111827); margin: 0; }
    .lvl-history ul { list-style: none; margin: 0.35rem 0 0; padding: 0; display: grid; gap: 0.3rem; }
    .lvl-history li { font-size: 0.85rem; display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: baseline; }
    .lvl-change { font-weight: 700; font-variant-numeric: tabular-nums; }
    .lvl-when { color: var(--rm-muted, #5b6b7d); font-size: 0.8rem; }
    .lvl-note { color: var(--rm-muted, #5b6b7d); font-style: italic; }
    .fw-admin { margin: 1rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); }
    .fw-admin a { color: var(--rm-accent, #2a9d8f); font-weight: 600; }
    .link-inline {
      border: 0; background: none; padding: 0; margin: 0; cursor: pointer;
      font: inherit; font-weight: 700; color: var(--rm-accent, #2a9d8f); text-decoration: underline;
    }
    .link-inline:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
  `];

  constructor() {
    super();
    this.persistence = null;
    /** @type {import('../../tools/team/domain/types.js').Person|null} */
    this.person = null;
    /** @type {import('../../tools/career/data/framework.js').CareerFramework|null} framework de carrera (para el título compuesto) */
    this.framework = null;
    /** @type {boolean} el enlace al panel de admin del framework solo se muestra al superadmin */
    this.isAdmin = false;
    /** @type {string|null} uid del editor (quien usa la ficha), para su alcance. */
    this.currentUid = null;
    /** @type {import('../../tools/team/domain/types.js').Person|null} ficha del editor (head→managers). */
    this.editorPerson = null;
    /** @type {string[]} uids de /leaders (managers), cargados del MISMO source que la regla personIsMyManager (/leaders/{uid}). */
    this._leaderUids = [];
    /** @type {string|null} sub-pestaña con la que abrir la ficha (p. ej. al saltar desde una dimensión del Mapa) */
    this.initialSubtab = null;
    /** @type {string} sub-pestaña activa de la ficha (arranca en Datos) */
    this._subtab = 'datos';
    /** @type {string} sub-sub-pestaña activa dentro de «Dimensiones» */
    this._dimSubtab = 'seniority';
    /** @type {string} sub-sub-pestaña activa dentro de «Carrera» */
    this._careerSubtab = 'nivel';
    /** @type {{ levelId: string, disciplines: string[], note: string }} edición inline de carrera (nivel + disciplinas + nota del cambio de nivel) */
    this._career = { levelId: '', disciplines: [], note: '' };
    /** @type {boolean} guardado de carrera en curso */
    this._careerSaving = false;
    /** @type {string} error in-place del formulario de carrera */
    this._careerError = '';
    this._nextAssessment = null;
    this._levelAssessments = [];
    this._progressDraft = null;
    this._progressSaving = false;
    this._progressError = '';
    this._progressSaved = false;
    /** @type {import('../../tools/career/domain/careerRoutes.js').CareerRoute[]} rutas publicadas (curva de progresión, F2) */
    this._routes = [];
    /** @type {{ entries: import('../../tools/career/domain/logbook.js').LogEntry[] }|null}
     * bitácora de la persona (JG-23) para el historial de rutas completadas (F3) */
    this._logbook = null;
    /** Borrador editable de la pestaña «Datos» (RMR-TSK-0173). Se siembra desde
     * la persona al abrirla. @type {{ name: string, githubLogin: string, startDate: string, guilds: string[], labels: string[], uid: string }} */
    this._datos = { name: '', githubLogin: '', startDate: '', guilds: [], primaryGuild: null, labels: [], squadIds: [], domainKeys: [], uid: '' };
    /** Catálogos de gremios (Carrera) y de cuentas (Datos). */
    this._guildsCat = [];
    this._rolesCat = [];
    this._usersCat = [];
    this._datosSaving = false;
    this._datosError = '';
    this._datosSaved = false;
    this._notionSync = false;
    /** @type {Array<{ id: string, hasGuilds: boolean }>} catálogo de departamentos */
    this._branchesCat = [];
    /** Políticas de herramientas (defaults por rol) para la matriz de permisos. */
    this._toolPolicies = [];
    this.timeline = { seniority: [], emotional: [], knowledge: [], contribution: [] };
    /** @type {import('../../tools/team/domain/types.js').Area[]} */
    this.areas = [];
    this.loading = true;
    this.error = '';
    this._form = {
      seniority: { level: 0, toNext: false, note: '', date: '' },
      emotional: { level: 0, toNext: false, note: '', date: '' },
    };
    this._know = { areaId: '', level: 0, toNext: false, note: '', date: '' };
    this._contrib = { roles: {}, note: '', date: '' };
    /** Respuestas del cuestionario de apoyo (RMR-TSK-0494). No se guardan: son
     *  el camino para llegar a una propuesta, no un dato de la persona. */
    this._belbinAnswers = {};
    this._loadedFor = null;
  }

  updated() {
    if (this.persistence && this.person && this._loadedFor !== this.person.id) {
      this._loadedFor = this.person.id;
      // Al abrir una persona nueva, arranca en los valores por defecto y solo
      // entonces respeta la sub-pestaña inicial solicitada (p. ej. la dimensión
      // pulsada en el Mapa), para no arrastrar la pestaña de la persona anterior.
      this._subtab = 'datos';
      this._dimSubtab = 'seniority';
      this._careerSubtab = 'nivel';
      // Ni el subnivel ni su ajuste a medias son de la persona nueva.
      this._subLevel = null;
      this._subDraft = null;
      if (this.initialSubtab) {
        if (DIM_SUBTABS.some((t) => t.id === this.initialSubtab)) {
          // Deep-link a una dimensión concreta: abre el grupo «Dimensiones» en ella.
          this._subtab = 'dimensiones';
          this._dimSubtab = this.initialSubtab;
        } else if (CAREER_SUBTABS.some((t) => t.id === this.initialSubtab)) {
          // Deep-link a una sección de carrera (la celda «Carrera» del Mapa abre
          // directamente Expectativas, que es donde se valora).
          this._subtab = 'carrera';
          this._careerSubtab = this.initialSubtab;
        } else if (SUBTABS.some((t) => t.id === this.initialSubtab)) {
          this._subtab = this.initialSubtab;
        }
      }
      this._seedCareer();
      this._seedDatos();
      this._load();
    }
  }

  /**
   * ¿Puede el editor gestionar los permisos de ESTA persona? (RMR-PCS-0027 · F8b/F8d)
   * Cada caso está RESPALDADO por una regla de Firestore, así el guardado nunca
   * choca con las reglas:
   *  - superadmin: cualquiera (isSuperAdmin).
   *  - manager: sus personas (ownerLeaderUid == su uid → regla isOwner).
   *  - head: sus managers directos (persona.reportsToPersonId == su personId →
   *    regla personIsMyManager, acotada a toolOverrides).
   */
  _canManagePerms() {
    if (this.isAdmin) return true;
    const p = this.person;
    if (!p) return false;
    // Head → managers DIRECTOS: la persona me reporta (reportsToPersonId) Y es un
    // manager de verdad (su uid está en /leaders) — alineado con la regla
    // personIsMyManager, para no habilitar la UI cuando el guardado se rechazaría.
    if (this.editorPerson?.id && p.reportsToPersonId === this.editorPerson.id
        && p.uid && this._leaderUids.includes(p.uid)) return true;
    return this.currentUid != null && p.ownerLeaderUid === this.currentUid;
  }

  /**
   * Sub-pestañas visibles. Los externos no tienen expectativas ni aspiraciones,
   * pero sí nivel (composición del equipo, RMR-BUG-0030), plan y objetivos.
   */
  _visibleSubtabs() {
    // «Permisos» (matriz de herramientas): superadmin siempre; manager/head sobre
    // la gente que gestionan (RMR-PCS-0027 · F8b).
    const perms = this._canManagePerms() ? [...SUBTABS, { id: 'permisos', label: 'Permisos' }] : SUBTABS;
    // Las performance reviews solo las ven sus managers: quien mira su propia ficha, no.
    const isSelf = Boolean(this.person?.uid) && this.person.uid === this.currentUid;
    // Externos: la pestaña sigue siendo «Carrera»; dentro, nivel, plan y objetivos (RMR-TSK-0764).
    return withRoleMirrorTab(isSelf ? perms.filter((t) => t.id !== 'perf') : perms, { person: this.person, isSelf });
  }

  /** Siembra el borrador de «Datos» desde la persona (RMR-TSK-0173). */
  _seedDatos() {
    const p = this.person;
    this._datos = {
      name: p?.name ?? '',
      githubLogin: p?.githubLogin ?? '',
      startDate: p?.startDate ?? '',
      uid: p?.uid ?? '',
      pendingEmail: p?.pendingEmail ?? '',
      location: p?.location ?? '',
      external: p?.external ?? false,
    };
    this._datosError = '';
    this._datosSaved = false;
  }

  /**
   * Precarga el formulario inline de carrera con el nivel y disciplinas actuales
   * de la persona. Se llama al cambiar de persona (no en cada render).
   * @returns {void}
   */
  _seedCareer() {
    this._career = {
      levelId: this.person.levelId ?? '',
      guilds: [...(this.person.guilds ?? [])],
      // Gremio PRINCIPAL (RMR-TSK-0594): se siembra normalizado, así que uno que
      // ya no esté entre sus gremios no llega al borrador.
      primaryGuild: normalizePrimaryGuild(this.person.guilds, this.person.primaryGuild),
      note: '',
      // Corrección de un nivel mal puesto: no escribe historia (RMR-TSK-0766).
      correction: false,
    };
    this._careerError = '';
  }

  /**
   * Navegación por teclado de la barra de sub-pestañas (patrón ARIA tablist con
   * activación automática): ←/→ recorren de forma circular y Home/End saltan a la
   * primera/última, moviendo el foco a la nueva pestaña.
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  _onSubtabsKeydown(e) {
    const ids = this._visibleSubtabs().map((t) => t.id);
    const i = ids.indexOf(this._subtab);
    let next = i;
    if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'ArrowRight') next = (i + 1) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    this._subtab = ids[next];
    // Tras el re-render, mueve el foco a la sub-pestaña recién activada.
    this.updateComplete.then(() => {
      /** @type {HTMLElement|null} */ (this.renderRoot.querySelector(`#psub-${this._subtab}`))?.focus();
    });
  }

  /**
   * Navegación por teclado de las sub-sub-pestañas de «Dimensiones» (mismo patrón
   * ARIA tablist con activación automática que el primer nivel): ←/→ circulares y
   * Home/End a la primera/última, moviendo el foco a la nueva pestaña.
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  _onDimSubtabsKeydown(e) {
    const ids = DIM_SUBTABS.map((t) => t.id);
    const i = ids.indexOf(this._dimSubtab);
    let next = i;
    if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'ArrowRight') next = (i + 1) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    this._dimSubtab = ids[next];
    this.updateComplete.then(() => {
      /** @type {HTMLElement|null} */ (this.renderRoot.querySelector(`#pdim-${this._dimSubtab}`))?.focus();
    });
  }

  /**
   * Guarda el nivel y los gremios de la persona (la asignación que hace el
   * manager). Las disciplinas del framework ya no se marcan: salen de los
   * gremios (RMR-TSK-0760), así que no pueden contradecirse. Reutiliza
   * `updatePerson` y refresca `this.person` con un objeto nuevo.
   * @returns {Promise<void>}
   */
  async _saveCareer() {
    this._careerError = '';
    this._careerSaving = true;
    const levelId = this._career.levelId || null;
    const guilds = [...this._career.guilds];
    try {
      const patch = {
        levelId, guilds,
        primaryGuild: normalizePrimaryGuild(guilds, this._career.primaryGuild),
        disciplines: disciplinesForGuilds(guilds, this._guildsCat),
      };
      // Historial de nivel (RMR-PCS-0037 · F1): si el nivel cambia, el relato se
      // añade solo — de dónde a dónde, cuándo, quién y la nota opcional del momento.
      // Una corrección (RMR-TSK-0766) no es una promoción: no escribe historia.
      if (levelId && levelId !== (this.person.levelId ?? null) && this._career.correction) {
        patch.levelHistory = correctLevel(this.person.levelHistory, levelId);
      } else if (levelId && levelId !== (this.person.levelId ?? null)) {
        patch.levelHistory = appendLevelChange(normalizeLevelHistory(this.person.levelHistory), {
          from: this.person.levelId ?? null,
          to: levelId,
          at: new Date().toISOString(),
          byUid: getCurrentUser()?.uid ?? null,
          note: this._career.note,
        });
      }
      await updatePerson(this.persistence, this.person.id, patch);
      this.person = { ...this.person, ...patch };
      this._career = { ...this._career, note: '', correction: false };
    } catch (err) {
      this._careerError = err instanceof Error ? err.message : 'No se pudo guardar la carrera.';
    } finally {
      this._careerSaving = false;
    }
  }

  // ── Avance hacia el nivel siguiente (RMR-PCS-0044 · F3) ────────────────────
  // Otra pregunta que la valoración de arriba: aquella dice si cumple el nivel
  // que YA tiene; esta, cuánto lleva del siguiente. De aquí sale el L1-2.

  /** El nivel contra el que se mide el avance, o null si no hay siguiente en su escalera. */
  get _nextLevel() {
    return nextLevelFor(this.framework?.levels ?? [], this.person?.levelId) ?? null;
  }

  /** Carga la valoración del nivel siguiente. Sin nivel siguiente no hay nada que cargar. */
  /** Nivel y subnivel efectivos, igual que en Personas y Seguimiento (RMR-TSK-0693). */
  _renderSubLevelLine() {
    if (this._subLevelError) return html`<p class="error" role="alert">${this._subLevelError}</p>`;
    const s = this._subLevel;
    if (!s) return null;
    const note = s.note ? `: ${s.note}` : '';
    const why = s.source === 'manual' ? ` · ajustado por el manager${note}` : '';
    // Ajusta quien lleva a la persona (las reglas mandan); uno mismo, no.
    const isSelf = Boolean(this.person?.uid) && this.person.uid === this.currentUid;
    const adjust = !isSelf && !this._subDraft
      ? html` <button type="button" class="link" @click=${() => { this._subDraft = { value: s.sub, note: s.note ?? '' }; }}>Ajustar</button>`
      : null;
    return html`<p class="suggest"><strong>${s.label}</strong> <span class="note">${subLevelCalcText(s)}${why}</span>${adjust}</p>
      ${this._subDraft ? this._renderSubLevelEditor(s) : null}`;
  }

  /** Ajuste manual del subnivel (RMR-TSK-0696): el mismo dato que se ajustaba en el seguimiento del mapa. */
  _renderSubLevelEditor(s) {
    const d = this._subDraft;
    const opts = [1, 2, 3].map((v) => html`<option value=${v} ?selected=${d.value === v}>.${v}</option>`);
    return html`<div class="row">
      <label class="fld">Subnivel
        <select @change=${(e) => { this._subDraft = { ...d, value: Number(e.target.value) }; }}>${opts}</select></label>
      <label class="fld">Por qué
        <input type="text" .value=${d.note} @input=${(e) => { this._subDraft = { ...d, note: e.target.value }; }} /></label>
      <button type="button" class="primary" @click=${() => this._saveSubOverride(d)}>Guardar</button>
      ${s.source === 'manual' ? html`<button type="button" @click=${() => this._saveSubOverride(null)}>Volver al automático</button>` : null}
      <button type="button" @click=${() => { this._subDraft = null; }}>Cancelar</button>
    </div>`;
  }

  async _saveSubOverride(draft) {
    const override = draft
      ? { value: draft.value, note: draft.note.trim() || null, byUid: getCurrentUser()?.uid ?? null, at: new Date().toISOString() }
      : null;
    try {
      await updatePerson(this.persistence, this.person.id, { subLevelOverride: override });
      this.person = { ...this.person, subLevelOverride: override };
      this._subDraft = null;
      this._subLevel = await getPersonSubLevel(this.person, this.framework);
    } catch (err) {
      this._subLevelError = `No se pudo guardar el ajuste: ${err instanceof Error ? err.message : err}`;
    }
  }

  async _loadLevelProgress() {
    // El subnivel, de la MISMA función que Personas y Seguimiento (RMR-TSK-0693),
    // también sin nivel siguiente: el ajuste del manager aplica igual.
    try {
      this._subLevel = await getPersonSubLevel(this.person, this.framework);
      this._subLevelError = '';
    } catch (err) {
      this._subLevel = null;
      this._subLevelError = `No se pudo calcular el subnivel: ${err instanceof Error ? err.message : err}`;
    }
    const next = this._nextLevel;
    if (!next) {
      this._nextAssessment = null;
      this._progressDraft = null;
      return;
    }
    try {
      const guardada = await getLevelAssessment(this.person.id, next.id);
      this._nextAssessment = guardada;
      // Todas las valoraciones, para la curva: una lectura, no una por nivel.
      this._levelAssessments = await listLevelAssessments(this.person.id).catch(() => []);
      this._progressDraft = guardada;
      this._progressError = '';
    } catch (err) {
      this._progressError = err instanceof Error ? err.message : 'No se pudo cargar el avance de nivel.';
    }
  }

  /** El cumplimiento del borrador, con los pesos del framework. */
  get _progressCompletion() {
    return this._nextLevel ? levelCompletion(this.framework, this._nextLevel.id, marksOf(this._progressDraft)) : null;
  }

  /** Marca (o desmarca) una expectativa del nivel siguiente; queda quién lo dijo. */
  _setProgressMark(dimensionId, meets) {
    const previa = this._progressDraft?.byDimension?.[dimensionId];
    this._progressDraft = markDimension(this._progressDraft, dimensionId, {
      meets, note: previa?.note ?? '', by: currentAuthor(), at: new Date().toISOString(),
    });
    this._progressSaved = false;
  }

  /** Nota de una expectativa del nivel siguiente (la evidencia que se discute en el O2O). */
  _setProgressNote(dimensionId, note) {
    const previa = this._progressDraft?.byDimension?.[dimensionId];
    this._progressDraft = markDimension(this._progressDraft, dimensionId, {
      meets: previa?.meets === true, note, by: currentAuthor(), at: new Date().toISOString(),
    });
    this._progressSaved = false;
  }

  /**
   * Guarda el avance. `cerrar` añade además un cierre: la foto del cumplimiento
   * de hoy, que es lo que permite exigir el 80 % sostenido para el .3.
   * @param {boolean} [cerrar]
   */
  async _saveProgress(cerrar = false) {
    const next = this._nextLevel;
    if (!next) return;
    this._progressError = '';
    this._progressSaving = true;
    try {
      const aGuardar = cerrar
        ? closeAssessment(this._progressDraft, this._progressCompletion, { by: currentAuthor(), at: new Date().toISOString() })
        : this._progressDraft;
      await saveLevelAssessment(this.person.id, next.id, aGuardar, currentAuthor());
      this._nextAssessment = aGuardar;
      this._progressDraft = aGuardar;
      this._progressSaved = true;
    } catch (err) {
      this._progressError = err instanceof Error ? err.message : 'No se pudo guardar el avance de nivel.';
    } finally {
      this._progressSaving = false;
    }
  }


  /**
   * Pide a `<team-app>` que abra la sección Ajustes (sub-pestaña «Áreas» por
   * defecto) mediante un evento; no navega con `location` dentro de la SPA.
   * @returns {void}
   */
  _gotoAreas() {
    this.dispatchEvent(new CustomEvent('goto-tab', {
      detail: { tab: 'settings' },
      bubbles: true,
      composed: true,
    }));
  }

  /**
   * Barra de sub-pestañas accesible (tablist con roving tabindex): solo la
   * pestaña activa es tabulable; las flechas mueven el foco y la selección.
   * @returns {import('lit').TemplateResult}
   */
  _renderSubtabs() {
    return html`
      <div class="tabs" role="tablist" aria-label="Secciones de la ficha" @keydown=${this._onSubtabsKeydown}>
        ${this._visibleSubtabs().map((t) => {
          const selected = this._subtab === t.id;
          return html`
            <button
              id="psub-${t.id}"
              class="tab ${selected ? 'active' : ''}"
              type="button"
              role="tab"
              aria-selected=${selected ? 'true' : 'false'}
              aria-controls="ppanel-${t.id}"
              tabindex=${selected ? '0' : '-1'}
              @click=${() => { this._subtab = t.id; }}
            >${t.label}</button>
          `;
        })}
      </div>
    `;
  }

  /**
   * Barra de sub-sub-pestañas genérica (tablist anidado accesible, roving
   * tabindex): reutiliza `.tabs`/`.tab`. `prefix` da ids únicos (`${prefix}-<id>`
   * para el tab y `${prefix}panel-<id>` para su panel); `onSelect(id)` cambia el
   * estado. Lo usan Organización y Carrera.
   */
  _renderNestedTabs(items, activeId, prefix, ariaLabel, onSelect) {
    return html`
      <div class="tabs tabs-nested" role="tablist" aria-label=${ariaLabel}
        @keydown=${(e) => this._nestedTabsKeydown(e, items, activeId, prefix, onSelect)}>
        ${items.map((t) => {
          const selected = activeId === t.id;
          return html`
            <button
              id="${prefix}-${t.id}"
              class="tab ${selected ? 'active' : ''}"
              type="button"
              role="tab"
              aria-selected=${selected ? 'true' : 'false'}
              aria-controls="${prefix}panel-${t.id}"
              tabindex=${selected ? '0' : '-1'}
              @click=${() => onSelect(t.id)}
            >${t.label}</button>
          `;
        })}
      </div>
    `;
  }

  /** Navegación por teclado (flechas/Home/End) de una barra de sub-sub-pestañas genérica. */
  _nestedTabsKeydown(e, items, activeId, prefix, onSelect) {
    const ids = items.map((t) => t.id);
    const i = ids.indexOf(activeId);
    let next = i;
    if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'ArrowRight') next = (i + 1) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    onSelect(ids[next]);
    this.updateComplete.then(() => {
      /** @type {HTMLElement|null} */ (this.renderRoot.querySelector(`#${prefix}-${ids[next]}`))?.focus();
    });
  }

  /**
   * Barra de sub-sub-pestañas de «Dimensiones» (tablist anidado, mismo patrón
   * accesible de roving tabindex): solo la activa es tabulable y las flechas
   * mueven foco y selección. Reutiliza las clases `.tabs`/`.tab` del primer nivel.
   * @returns {import('lit').TemplateResult}
   */
  _renderDimSubtabs() {
    return html`
      <div class="tabs tabs-nested" role="tablist" aria-label="Dimensiones de evaluación" @keydown=${this._onDimSubtabsKeydown}>
        ${DIM_SUBTABS.map((t) => {
          const selected = this._dimSubtab === t.id;
          return html`
            <button
              id="pdim-${t.id}"
              class="tab ${selected ? 'active' : ''}"
              type="button"
              role="tab"
              aria-selected=${selected ? 'true' : 'false'}
              aria-controls="pdimpanel-${t.id}"
              tabindex=${selected ? '0' : '-1'}
              @click=${() => { this._dimSubtab = t.id; }}
            >${t.label}</button>
          `;
        })}
      </div>
    `;
  }

  /**
   * Pestaña «Dimensiones»: agrupa las cuatro dimensiones de evaluación bajo un
   * tablist anidado, reutilizando los renderers de cada dimensión sin tocar su
   * lógica ni su persistencia.
   * @returns {import('lit').TemplateResult}
   */
  _renderDimensions() {
    const active = this._dimSubtab;
    const panel = {
      seniority: () => this._renderDimension(DIMENSIONS[0]),
      emotional: () => this._renderDimension(DIMENSIONS[1]),
      knowledge: () => this._renderKnowledge(),
      contribution: () => this._renderContribution(),
    }[active] ?? (() => this._renderDimension(DIMENSIONS[0]));
    return html`
      ${this._renderDimSubtabs()}
      <div
        id="pdimpanel-${active}"
        class="subpanel"
        role="tabpanel"
        aria-labelledby="pdim-${active}"
        tabindex="0"
      >
        ${panel()}
      </div>
    `;
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      const [timeline, areas, logbook, guildsCat, usersCat, toolPolicies, leaderUids, routes, notionSync, branchesCat, rolesCat] =
        await Promise.all([
          getPersonTimeline(this.persistence, this.person.id),
          listAreas(this.persistence),
          // Historial de rutas completadas (F3): best-effort, no debe tumbar la
          // ficha si falla (p. ej. sin permiso o sin bitácora aún).
          getPersonLogbook(this.person.id).catch(() => ({ entries: [] })),
          // Catálogos de gremios (Carrera) y cuentas (Datos), best-effort.
          listGuilds(this.persistence).catch(() => []),
          listUsers().catch(() => []),
          // Políticas de herramientas para la matriz de permisos (F8b). Se cargan
          // SIEMPRE (lectura pequeña, legible por cualquier autenticado): la pestaña
          // «Permisos» aparece según _canManagePerms, no según esta carga — así se
          // evita el orden circular con _leaderUids, que se resuelve en este mismo lote.
          listToolPolicies().catch(() => []),
          // uids de /leaders: para el alcance del head (¿la persona es un manager?),
          // del MISMO source que la regla personIsMyManager. Best-effort.
          listLeaders().then((ls) => ls.map((l) => l.uid)).catch(() => []),
          // Rutas publicadas para la curva de progresión (F2): best-effort — sin
          // rutas la gráfica simplemente no sale.
          listCareerRoutes().catch(() => []),
          // ¿Manda Notion en esta instancia? (RMR-TSK-0588) SIN catch a propósito:
          // decidir «no» por un fallo dejaría editable lo que no lo es.
          isNotionSynced(),
          // Catálogo de departamentos: dice cuáles tienen gremios (RMR-TSK-0593).
          listOrgBranches(),
          // Catálogo de roles, para decir en la cabecera qué es (RMR-TSK-0761).
          // Sin catch: una cabecera sin rol por un fallo callado engañaría.
          listOrgRoles(),
        ]);
      this._rolesCat = rolesCat;
      this._notionSync = notionSync;
      this._branchesCat = branchesCat;
      this.timeline = timeline;
      this.areas = areas;
      this._logbook = logbook;
      this._guildsCat = guildsCat;
      this._usersCat = usersCat;
      this._toolPolicies = toolPolicies;
      this._leaderUids = leaderUids;
      this._routes = routes;
      await this._loadLevelProgress();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar la ficha.';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Tras guardar una lectura solo cambia su historial, así que solo se trae eso
   * (RMR-TSK-0769). Antes se recargaba la ficha entera: salía el esqueleto de
   * carga y, al tomarla por una persona nueva, volvía a «Datos» a mitad de trabajo.
   */
  async _refreshTimeline() {
    this.timeline = await getPersonTimeline(this.persistence, this.person.id);
  }

  async _saveKnowledge() {
    const k = this._know;
    if (!k.areaId) { this.error = 'Elige un área.'; return; }
    if (!k.level) { this.error = 'Selecciona un nivel.'; return; }
    this.error = '';
    try {
      await addReading(this.persistence, 'knowledge', this.person.id, {
        areaId: k.areaId,
        level: k.level,
        toNext: k.toNext,
        note: k.note.trim() || undefined,
        date: k.date || new Date().toISOString(),
      });
      this._know = { areaId: '', level: 0, toNext: false, note: '', date: '' };
      await this._refreshTimeline();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar el conocimiento.';
    }
  }

  _setContribRole(sigla, value) {
    const roles = { ...this._contrib.roles };
    if (value) roles[sigla] = value;
    else delete roles[sigla];
    this._contrib = { ...this._contrib, roles };
  }

  /**
   * Cuestionario de apoyo (RMR-TSK-0494): preguntas sobre conductas OBSERVADAS,
   * no sobre cómo es la persona. Al aplicar, rellena el formulario de abajo —no
   * guarda nada—: lo que se registra es lo que el manager confirme.
   */
  _renderBelbinSurvey() {
    const propuesta = proposeRoles(this._belbinAnswers);
    const hay = propuesta.primary.length > 0 || propuesta.secondary.length > 0;
    return html`
      <div class="form">
        <p class="lead">
          Marca lo que hayas VISTO hacer a esta persona. Al final se propone un
          reparto de roles que puedes aceptar, cambiar o ignorar: lo que se
          registra es lo que confirmes tú.
        </p>
        <div class="belbin-survey">
          ${BELBIN_ITEMS.map((item) => html`
            <div class="bs-row">
              <span class="bs-text">${item.text}</span>
              <select aria-label=${item.text}
                @change=${(e) => this._setBelbinAnswer(item.id, e.target.value)}>
                ${BELBIN_SCALE.map((op) => html`<option value=${op.value}
                  ?selected=${(this._belbinAnswers[item.id] ?? 0) === op.value}>${op.label}</option>`)}
              </select>
            </div>`)}
        </div>
        ${hay ? this._renderBelbinProposal(propuesta) : html`<p class="empty">Sin conductas marcadas todavía: no hay nada que proponer.</p>`}
      </div>`;
  }

  /** La propuesta, SIEMPRE con el porqué: así se puede discutir frase a frase. */
  _renderBelbinProposal(propuesta) {
    const bloque = (titulo, siglas) => (siglas.length === 0 ? null : html`
      <div class="bs-group">
        <h4>${titulo}</h4>
        ${siglas.map((sigla) => html`
          <div class="bs-prop">
            <span class="b-name">${sigla} · ${BELBIN_BY_SIGLA[sigla]?.name ?? sigla}</span>
            <ul class="bs-why">
              ${evidenceFor(sigla, this._belbinAnswers).map((e) => html`<li>${e.text}</li>`)}
            </ul>
          </div>`)}
      </div>`);
    return html`
      <div class="bs-result">
        ${bloque('Se proponen como primarios', propuesta.primary)}
        ${bloque('Y como secundarios', propuesta.secondary)}
        <button class="primary" @click=${() => this._applyBelbinProposal(propuesta)}>
          Llevar al formulario
        </button>
        <p class="lead">No se guarda nada todavía: rellena el registro de abajo y decides tú.</p>
      </div>`;
  }

  /** @param {string} id @param {string} value */
  _setBelbinAnswer(id, value) {
    this._belbinAnswers = { ...this._belbinAnswers, [id]: Number(value) };
  }

  _applyBelbinProposal(propuesta) {
    const roles = {};
    for (const sigla of propuesta.primary) roles[sigla] = 'primary';
    for (const sigla of propuesta.secondary) roles[sigla] = 'secondary';
    this._contrib = { ...this._contrib, roles };
  }

  async _saveContribution() {
    const c = this._contrib;
    if (Object.keys(c.roles).length === 0) { this.error = 'Marca al menos un rol.'; return; }
    this.error = '';
    try {
      await addReading(this.persistence, 'contribution', this.person.id, {
        roles: c.roles,
        note: c.note.trim() || undefined,
        date: c.date || new Date().toISOString(),
      });
      this._contrib = { roles: {}, note: '', date: '' };
      await this._refreshTimeline();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la contribución.';
    }
  }

  _patchForm(dim, patch) {
    this._form = { ...this._form, [dim]: { ...this._form[dim], ...patch } };
  }

  async _save(dim) {
    const f = this._form[dim];
    if (!f.level) {
      this.error = 'Selecciona un nivel.';
      return;
    }
    this.error = '';
    try {
      await addReading(this.persistence, dim, this.person.id, {
        level: f.level,
        toNext: f.toNext,
        note: f.note.trim() || undefined,
        date: f.date || new Date().toISOString(),
      });
      this._patchForm(dim, { level: 0, toNext: false, note: '', date: '' });
      await this._refreshTimeline();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la lectura.';
    }
  }

  /**
   * Line chart SVG de la evolución del `value` (nivel 1..7.5) en el tiempo.
   * Requiere al menos 2 lecturas; con menos muestra un aviso sobrio. El SVG es
   * accesible (`role="img"` + `aria-label` con inicio, fin y tendencia). La
   * geometría se calcula con el helper puro `sparkline` (fuera del componente).
   * @param {Array<{ level: number, toNext?: boolean, value: number, date: string }>} history  Ascendente por fecha.
   * @param {string} label  Nombre de la dimensión, para el aria-label.
   * @returns {import('lit').TemplateResult}
   */
  _renderLineChart(history, label) {
    if (history.length < 2) {
      return html`<p class="chart-empty">Necesita al menos 2 lecturas para el gráfico.</p>`;
    }
    const geo = sparkline(
      history.map((r) => ({ value: r.value })),
      { width: 300, height: 120, padding: 12 },
    );
    const first = history.at(0);
    const last = history.at(-1);
    const trend = sparklineTrend(history);
    const aria = `Evolución de ${label}: de ${levelLabel(first.level, first.toNext)} (${formatDate(first.date)}) a ${levelLabel(last.level, last.toNext)} (${formatDate(last.date)}). Tendencia ${trend}.`;
    return html`
      <svg class="spark" viewBox="0 0 ${geo.width} ${geo.height}" role="img" aria-label=${aria}>
        <line
          class="spark-axis"
          x1="12"
          y1=${geo.height - 12}
          x2=${geo.width - 12}
          y2=${geo.height - 12}
        ></line>
        <polyline class="spark-line" points=${geo.polyline} vector-effect="non-scaling-stroke"></polyline>
        ${geo.points.map((p) => html`<circle class="spark-dot" cx=${p.x} cy=${p.y} r="3.5"></circle>`)}
      </svg>
    `;
  }

  _renderDimension({ key, label, bias }) {
    const history = this.timeline[key] ?? [];
    const current = history.at(-1);
    const f = this._form[key];
    return html`
      <section>
        <h3>${label}</h3>
        ${bias ? html`<p class="bias">⚠ ${bias}</p>` : null}

        ${current
          ? html`<div class="actual">
              <span class="tag">Actual</span>
              <span class="val">${levelLabel(current.level, current.toNext)}</span>
              <span class="at">${formatDate(current.date)}</span>
            </div>`
          : html`<div class="actual none"><span class="void">Sin lecturas todavía</span></div>`}

        <details class="add">
          <summary>➕ Añadir lectura</summary>
          <div class="form">
            <team-level-input
              .level=${f.level}
              .toNext=${f.toNext}
              @level-change=${(e) => this._patchForm(key, { level: e.detail.level, toNext: e.detail.toNext })}
            ></team-level-input>
            <label class="fld">Nota (opcional)
              <textarea
                .value=${f.note}
                @input=${(e) => this._patchForm(key, { note: e.target.value })}
                placeholder="Contexto de esta lectura…"
              ></textarea>
            </label>
            <div class="row">
              <label class="fld">Fecha
                <input type="date" .value=${f.date} @input=${(e) => this._patchForm(key, { date: e.target.value })} />
              </label>
              <button class="primary" ?disabled=${!f.level} @click=${() => this._save(key)}>Registrar lectura</button>
            </div>
          </div>
        </details>

        ${history.length === 0
          ? html`<p class="empty">Aún no hay histórico.</p>`
          : html`
              <div class="evo">
                <div class="evo-chart">${this._renderLineChart(history, label)}</div>
                <div class="evo-table">
                  <table class="htable">
                    <caption>Histórico de lecturas</caption>
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Grado</th>
                        <th scope="col">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${history.toReversed().map(
                        (r) => html`
                          <tr>
                            <td class="when">${formatDate(r.date)}</td>
                            <td class="lvl">${levelLabel(r.level, r.toNext)}</td>
                            <td class="note">${r.note ?? ''}</td>
                          </tr>
                        `,
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            `}
      </section>
    `;
  }

  /**
   * Barras horizontales con el nivel ACTUAL por área (conocimiento es por área,
   * no una serie temporal única, así que un line chart no aplica limpio). Cada
   * barra mapea el `value` (1..7.5) a un porcentaje del ancho. Accesible como
   * imagen con `aria-label`. Función de presentación pura sobre datos ya derivados.
   * @param {Map<string, { level: number, toNext?: boolean }>} currentByArea
   * @param {(id: string) => string} areaName
   * @returns {import('lit').TemplateResult}
   */
  _renderKnowledgeBars(currentByArea, areaName) {
    const rows = [...currentByArea.entries()];
    if (rows.length === 0) {
      return html`<p class="chart-empty">Sin lecturas para graficar.</p>`;
    }
    return html`
      <ul class="bars" role="img" aria-label="Grado actual de conocimiento por área">
        ${rows.map(([id, r]) => {
          const value = levelToNumber(r.level, r.toNext);
          const pct = Math.round((value / SPARK_MAX) * 100);
          return html`
            <li class="bar-row">
              <span class="bar-name" title=${areaName(id)}>${areaName(id)}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
              <span class="bar-val">${levelLabel(r.level, r.toNext)}</span>
            </li>
          `;
        })}
      </ul>
    `;
  }

  _renderKnowledge() {
    const history = this.timeline.knowledge ?? [];
    const currentByArea = new Map();
    for (const r of history) currentByArea.set(r.areaId, r); // asc → última gana
    const areaName = (id) => this.areas.find((a) => a.id === id)?.name ?? '—';
    const k = this._know;
    return html`
      <section>
        <h3>Conocimiento por área</h3>
        ${this.areas.length === 0
          ? html`<p class="empty">No hay áreas.
              <button type="button" class="link-inline" @click=${this._gotoAreas}>Créalas en Ajustes</button>
              para registrar conocimiento.</p>`
          : html`
              ${currentByArea.size > 0
                ? html`<div class="actual">
                    <span class="tag">Actual</span>
                    <span class="areas">
                      ${[...currentByArea.entries()].map(
                        ([id, r]) => html`<span class="chip">${areaName(id)}: ${levelLabel(r.level, r.toNext)}</span>`,
                      )}
                    </span>
                  </div>`
                : html`<div class="actual none"><span class="void">Sin lecturas todavía</span></div>`}

              <details class="add">
                <summary>➕ Registrar conocimiento</summary>
                <div class="form">
                  <label class="fld">Área
                    <select .value=${k.areaId} @change=${(e) => { this._know = { ...this._know, areaId: e.target.value }; }}>
                      <option value="">— Elige un área —</option>
                      ${this.areas.map((a) => html`<option value=${a.id} ?selected=${a.id === k.areaId}>${a.name}</option>`)}
                    </select>
                  </label>
                  <team-level-input
                    .level=${k.level}
                    .toNext=${k.toNext}
                    @level-change=${(e) => { this._know = { ...this._know, level: e.detail.level, toNext: e.detail.toNext }; }}
                  ></team-level-input>
                  <label class="fld">Nota (opcional)
                    <textarea .value=${k.note} @input=${(e) => { this._know = { ...this._know, note: e.target.value }; }}></textarea>
                  </label>
                  <div class="row">
                    <label class="fld">Fecha
                      <input type="date" .value=${k.date} @input=${(e) => { this._know = { ...this._know, date: e.target.value }; }} />
                    </label>
                    <button class="primary" ?disabled=${!k.areaId || !k.level} @click=${this._saveKnowledge}>Registrar conocimiento</button>
                  </div>
                </div>
              </details>

              ${history.length === 0
                ? html`<p class="empty">Sin histórico.</p>`
                : html`
                    <div class="evo">
                      <div class="evo-chart">${this._renderKnowledgeBars(currentByArea, areaName)}</div>
                      <div class="evo-table">
                        <div class="table-wrap"><table class="htable">
                          <caption>Histórico por área</caption>
                          <thead>
                            <tr>
                              <th scope="col">Fecha</th>
                              <th scope="col">Área</th>
                              <th scope="col">Grado</th>
                              <th scope="col">Nota</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${history.toReversed().map(
                              (r) => html`<tr>
                                <td class="when">${formatDate(r.date)}</td>
                                <td>${areaName(r.areaId)}</td>
                                <td class="lvl">${levelLabel(r.level, r.toNext)}</td>
                                <td class="note">${r.note ?? ''}</td>
                              </tr>`,
                            )}
                          </tbody>
                        </table></div>
                      </div>
                    </div>
                  `}
            `}
      </section>
    `;
  }

  /**
   * Roles primarios más frecuentes a lo largo del histórico de contribución.
   * Belbin no tiene valor numérico, así que en lugar de un gráfico de línea se
   * ofrece esta lectura agregada (los que empatan en máximo se listan juntos).
   * @param {Array<{ roles?: Record<string, 'primary'|'secondary'> }>} history
   * @returns {string}  Cadena vacía si no hay ningún rol primario registrado.
   */
  _topPrimaryRoles(history) {
    /** @type {Map<string, number>} */
    const counts = new Map();
    for (const entry of history) {
      for (const [sigla, kind] of Object.entries(entry.roles ?? {})) {
        if (kind === 'primary') counts.set(sigla, (counts.get(sigla) ?? 0) + 1);
      }
    }
    if (counts.size === 0) return '';
    const max = Math.max(...counts.values());
    return [...counts.entries()]
      .filter(([, n]) => n === max)
      .map(([sigla, n]) => `${sigla} (×${n})`)
      .join(' · ');
  }

  _renderContribution() {
    const history = this.timeline.contribution ?? [];
    const current = history.at(-1);
    const c = this._contrib;
    const summary = (roles) =>
      Object.entries(roles || {})
        .map(([s, kind]) => `${s} ${kind === 'primary' ? '(P)' : '(S)'}`)
        .join(' · ') || '—';
    const topPrimary = this._topPrimaryRoles(history);
    return html`
      <section>
        <h3>Contribución (Belbin)</h3>

        ${current
          ? html`<div class="actual">
              <span class="tag">Actual</span>
              <span class="val">${summary(current.roles)}</span>
              <span class="at">${formatDate(current.date)}</span>
            </div>`
          : html`<div class="actual none"><span class="void">Sin perfil todavía</span></div>`}

        <details class="add">
          <summary>🧭 Ayúdame a situarlos</summary>
          ${this._renderBelbinSurvey()}
        </details>

        <details class="add">
          <summary>➕ Registrar contribución</summary>
          <div class="form">
            <div class="belbin">
              ${BELBIN_ROLES.map(
                (role) => html`
                  <div class="belbin-row">
                    <span class="b-name" title=${role.name}>${role.sigla} · ${role.name}</span>
                    <select @change=${(e) => this._setContribRole(role.sigla, e.target.value)}>
                      ${CONTRIB_STATES.map(
                        (st) => html`<option value=${st.value} ?selected=${(c.roles[role.sigla] ?? '') === st.value}>${st.label}</option>`,
                      )}
                    </select>
                  </div>
                `,
              )}
            </div>
            <label class="fld">Nota (opcional)
              <textarea .value=${c.note} @input=${(e) => { this._contrib = { ...this._contrib, note: e.target.value }; }}></textarea>
            </label>
            <div class="row">
              <label class="fld">Fecha
                <input type="date" .value=${c.date} @input=${(e) => { this._contrib = { ...this._contrib, date: e.target.value }; }} />
              </label>
              <button class="primary" ?disabled=${Object.keys(c.roles).length === 0} @click=${this._saveContribution}>Registrar contribución</button>
            </div>
          </div>
        </details>

        ${history.length === 0
          ? html`<p class="empty">Aún no hay histórico.</p>`
          : html`
              <table class="htable">
                <caption>Histórico de roles</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Roles (P/S)</th>
                    <th scope="col">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  ${history.toReversed().map(
                    (r) => html`<tr>
                      <td class="when">${formatDate(r.date)}</td>
                      <td class="lvl">${summary(r.roles)}</td>
                      <td class="note">${r.note ?? ''}</td>
                    </tr>`,
                  )}
                </tbody>
              </table>
              ${topPrimary
                ? html`<p class="freq">Roles primarios más frecuentes: <strong>${topPrimary}</strong></p>`
                : null}
            `}
      </section>
    `;
  }

  /**
   * «O2O» (RMR-TSK-0649): los O2O hechos, los mismos de la herramienta O2O. Las
   * performance reviews tienen su propia pestaña (RMR-TSK-0694).
   */
  _renderO2O() {
    // Lo que ella ve en Mi espacio, más tus O2O enteros (RMR-TSK-0728).
    const nameOf = (uid) => this._usersCat.find((u) => u.uid === uid)?.displayName ?? null;
    return html`<person-o2o-panel .person=${this.person} .viewerUid=${this.currentUid ?? null}
      .nameOf=${nameOf}></person-o2o-panel>`;
  }

  /**
   * Sección «Nivel» para personas EXTERNAS (RMR-BUG-0030): a diferencia de la
   * plantilla, una persona externa no sigue el plan de carrera (sin journey,
   * expectativas ni aspiraciones — eso es del programa de crecimiento interno),
   * pero SÍ conviene poder clasificarla por nivel (L1/L2/L3…) para conocer la
   * composición del equipo. Reutiliza el mismo editor de nivel+disciplinas.
   * @param {import('../../tools/career/data/framework.js').CareerFramework|null} fw
   */
  _renderExternalLevel(fw) {
    const level = getLevel(fw, this.person.levelId);
    // Externos (RMR-TSK-0764): sin expectativas ni aspiraciones, pero con su
    // plan y sus objetivos, que también hay que acordar con ellos.
    const shown = EXTERNAL_SUBTABS.some((t) => t.id === this._careerSubtab) ? this._careerSubtab : 'nivel';
    const panel = {
      nivel: () => html`
        <p class="lead">Las personas externas no siguen el plan de carrera (sin expectativas ni aspiraciones), pero se pueden clasificar por nivel para conocer la composición del equipo.</p>
        ${this._renderCareerEditor()}
        ${level ? this._renderExternalLevelNow(level) : null}`,
      plan: () => html`<career-person-panel .person=${this.person} .framework=${fw} section="plan" canAssess></career-person-panel>`,
      objetivos: () => html`<career-person-panel .person=${this.person} .framework=${fw} section="objetivos" canAssess></career-person-panel>`,
    }[shown];
    return html`
      <section class="career">
        <h3>Carrera</h3>
        ${this._renderNestedTabs(EXTERNAL_SUBTABS, shown, 'pcar', 'Secciones de carrera', (id) => { this._careerSubtab = id; })}
        <div id="pcarpanel-${shown}" class="subpanel" role="tabpanel" aria-labelledby="pcar-${shown}" tabindex="0">
          ${panel()}
        </div>
      </section>
    `;
  }

  /** Bloque «Nivel actual» de una persona externa (sin plan de carrera). */
  _renderExternalLevelNow(level) {
    const desc = level.description ? html`<p class="desc">${level.description}</p>` : null;
    const profile = level.typicalProfile ? html`<p class="profile">Perfil típico: ${level.typicalProfile}</p>` : null;
    return html`
      <p class="sub">Nivel actual</p>
      <div class="now">
        <p><span class="code">${level.code}</span> · ${level.title}</p>
        ${desc}
        ${profile}
      </div>
    `;
  }

  /**
   * Sección «Carrera» (F4): solo lectura. Muestra el nivel actual y sus
   * expectativas, el foco por disciplina (addendums) y los niveles a los que
   * aspirar. Se omite si la persona no tiene ni nivel ni disciplinas.
   */
  _renderCareer() {
    const fw = this.framework;
    if (this.person?.external) return this._renderExternalLevel(fw);
    const disciplineIds = this.person.disciplines ?? [];
    const level = getLevel(fw, this.person.levelId);

    const trackName = (trackId) => (fw?.tracks ?? []).find((t) => t.id === trackId)?.name ?? '';
    const addendums = addendumsForDisciplines(fw, disciplineIds);
    const addendumsByDiscipline = Object.groupBy(addendums, (a) => a.discipline.id);
    const aspirations = level ? aspirationalLevels(fw, this.person.levelId) : [];

    const active = this._careerSubtab;
    const nivelPanel = () => html`
      ${this._renderSubLevelLine()}
      ${this._renderCareerEditor()}
      ${level
        ? html`
            <p class="sub">Nivel actual</p>
            <div class="now">
              <p><span class="code">${level.code}</span> · ${level.title}</p>
              ${level.description ? html`<p class="desc">${level.description}</p>` : null}
              ${level.typicalProfile ? html`<p class="profile">Perfil típico: ${level.typicalProfile}</p>` : null}
            </div>
          `
        : null}
      ${this.isAdmin
        ? html`<p class="fw-admin">
            El framework de carrera (niveles, expectativas…) se edita en el
            <a href="/admin#careerFramework">panel de administración</a>.
          </p>`
        : null}
    `;
    // Mi carrera (RMR-TSK-0684): la misma vista que ve el ingeniero en Mi espacio.
    const careerPanel = (section) => html`<career-person-panel .person=${this.person} .framework=${fw}
      section=${section} canAssess @private-notes-request=${() => { this._subtab = 'perf'; }}></career-person-panel>`;
    const expectativasPanel = () => html`
      ${level ? careerPanel('expectativas') : null}
      ${addendums.length > 0
        ? html`
            <p class="sub">Enfoque por disciplina</p>
            <div class="addn">
              ${Object.values(addendumsByDiscipline).map(
                (rows) => html`
                  <p class="disc">${rows[0].discipline.name}</p>
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
      ${!level && addendums.length === 0
        ? html`<p class="empty">Asigna el nivel en «Nivel» para ver las expectativas.</p>`
        : null}
    `;
    const aspiracionesPanel = () => html`
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
      ${this._renderDeclaredTarget(fw)}
      ${this._renderCompletedRoutes()}
    `;
    const seguimientoPanel = () => (level ? careerPanel('seguimiento') : html`<p class="empty">Asigna el nivel en «Nivel».</p>`);
    // En el tope de su vía (RMR-TSK-0761) no hay avance ni aspiraciones hacia
    // otro nivel: esas pestañas sobran y se dice cómo se le valora.
    const top = atTopOfLadder(fw?.levels, this.person.levelId);
    const tabs = top ? CAREER_SUBTABS.filter((t) => !TOP_HIDDEN.has(t.id)) : CAREER_SUBTABS;
    const shown = tabs.some((t) => t.id === active) ? active : 'nivel';
    const panel = {
      nivel: nivelPanel, plan: () => careerPanel('plan'), expectativas: expectativasPanel, seguimiento: seguimientoPanel,
      mapa: () => this._renderCareerMap(), aspiraciones: aspiracionesPanel,
    }[shown] ?? nivelPanel;

    return html`
      <section class="career">
        <h3>Carrera</h3>
        ${top ? html`<p class="top-note">Está en el tope de su itinerario: no hay un nivel por encima al que avanzar.
          Se le valora por las expectativas de su nivel y por sus objetivos (en «Expectativas y objetivos»).</p>` : null}
        ${this._renderNestedTabs(tabs, shown, 'pcar', 'Secciones de carrera', (id) => { this._careerSubtab = id; })}
        <div id="pcarpanel-${shown}" class="subpanel" role="tabpanel" aria-labelledby="pcar-${shown}" tabindex="0">
          ${panel()}
        </div>
      </section>
    `;
  }

  /**
   * Su mapa de carrera, como lo ve en Mi espacio pero en tercera persona y sin
   * jugar (RMR-TSK-0736): nadie juega el mapa de otro. Se lee al abrir la pestaña.
   */
  _renderCareerMap() {
    const personId = this.person.id;
    if (this._careerMap?.personId !== personId) {
      if (this._careerMapReq !== personId) {
        this._careerMapReq = personId;
        getMyCareerMap(personId)
          .then((data) => { if (this.person?.id === personId) this._careerMap = { personId, data }; })
          .catch((err) => { if (this.person?.id === personId) this._careerMap = { personId, error: err.message }; });
      }
      return skeletonLines(6);
    }
    if (this._careerMap.error) return html`<p class="error" role="alert">No se pudo cargar su mapa: ${this._careerMap.error}</p>`;
    const m = this._careerMap.data;
    return html`<career-map-summary .person=${this.person} .island=${m.island} .journey=${m.journey}
      .archipelago=${m.archipelago} .achievements=${m.achievements} .endorsements=${m.endorsements}
      .questions=${m.questions}></career-map-summary>
      ${this._isOwnFicha() ? null : html`<career-recommend .person=${this.person} .island=${m.island}
        .viewer=${currentAuthor()}></career-recommend>`}`;
  }

  /** La propia ficha: lo tuyo no te lo recomiendas (RMR-TSK-0739). */
  _isOwnFicha() {
    return Boolean(this.person?.uid) && this.person.uid === this.currentUid;
  }

  /**
   * Avance hacia el nivel siguiente: el porcentaje por pesos, el sub-nivel que
   * sale de ahí y una fila por expectativa. Lo que nadie ha marcado no cumple:
   * el nivel siguiente se gana, no se presupone.
   * @returns {import('lit').TemplateResult|null}
   */
  _renderLevelProgress() {
    const next = this._nextLevel;
    if (!next) return null;
    const filas = expectationsForLevel(this.framework, next.id).filter((r) => r.text !== '');
    if (filas.length === 0) {
      return html`<p class="sub">Avance hacia ${next.code}</p>
        <p class="todo">Ese nivel todavía no tiene expectativas escritas: sin ellas no hay avance que medir.</p>`;
    }
    const progreso = levelProgressFor({
      person: this.person,
      framework: this.framework,
      marks: marksOf(this._progressDraft),
      history: closureHistory(this._nextAssessment),
    });
    const ultimo = lastClosure(this._nextAssessment);
    return html`
      <p class="sub">Avance hacia ${next.code} · ${next.title}</p>
      ${this._renderProgressHead(progreso, ultimo)}
      <ul class="assess">${filas.map((row) => this._renderProgressRow(row, next.id))}</ul>
      ${this._progressError ? html`<p class="error">${this._progressError}</p>` : null}
      <div class="row">
        <button type="button" ?disabled=${this._progressSaving} @click=${() => this._saveProgress(false)}>
          ${this._progressSaving ? 'Guardando…' : 'Guardar avance'}
        </button>
        <button type="button" class="primary" ?disabled=${this._progressSaving}
          title="Deja constancia del cumplimiento de hoy: es lo que permite exigir que el 80 % se mantenga"
          @click=${() => this._saveProgress(true)}>Cerrar valoración</button>
        ${this._progressSaved ? html`<span class="saved" role="status">Avance guardado.</span>` : null}
      </div>`;
  }

  /** Cabecera del avance: sub-nivel, porcentaje, qué falta y desde cuándo. */
  _renderProgressHead(progreso, ultimo) {
    if (!progreso) return null;
    const cerrado = ultimo ? `Última valoración cerrada: ${ultimo.pct} % el ${formatAchievedAt(ultimo.at)}.` : 'Todavía no se ha cerrado ninguna valoración.';
    const pendiente = progreso.pendingSub === 3
      ? html`<p class="note">Llega al 80 %, pero el ${progreso.levelCode}-3 pide mantenerlo: hace falta otra valoración cerrada por encima del 80 %.</p>`
      : null;
    const subir = progreso.readyToPromote
      ? html`<p class="note">Cumple el 100 % de ${progreso.nextLevelCode}: toca plantear la subida de nivel.</p>`
      : null;
    const core = progreso.coreMissing.length > 0
      ? html`<p class="note">Imprescindibles sin cubrir: ${progreso.coreMissing.length}.</p>`
      : null;
    return html`
      <p class="suggest"><strong>${progreso.label}</strong> · ${progreso.pct} % (${progreso.earned} de ${progreso.total} puntos)</p>
      <p class="note">${cerrado}</p>
      ${pendiente}${subir}${core}`;
  }

  /** Una expectativa del nivel siguiente: cumple o no, con su peso y su nota. */
  _renderProgressRow(row, levelId) {
    const dimId = row.dimension.id;
    const marca = this._progressDraft?.byDimension?.[dimId];
    const meets = marca?.meets === true;
    const celda = (this.framework?.expectations ?? []).find((e) => e.levelId === levelId && e.dimensionId === dimId);
    const peso = expectationWeight(celda);
    const quien = marca?.by?.name ? html`<span class="note">Lo valoró ${marca.by.name}</span>` : null;
    return html`
      <li class="assess-row ${meets ? 'ok' : 'bad'}">
        <div class="assess-head">
          <span class="dim">${row.dimension.name} <span class="note">peso ${peso}${celda?.core ? ' · imprescindible' : ''}</span></span>
          <div class="seg" role="group" aria-label=${`Avance en ${row.dimension.name}`}>
            <button type="button" class="seg-btn ok ${meets ? 'on' : ''}" aria-pressed=${meets ? 'true' : 'false'}
              @click=${() => this._setProgressMark(dimId, true)}>Cumple</button>
            <button type="button" class="seg-btn bad ${meets ? '' : 'on'}" aria-pressed=${meets ? 'false' : 'true'}
              @click=${() => this._setProgressMark(dimId, false)}>Todavía no</button>
          </div>
        </div>
        <details class="exp"><summary>Expectativa</summary><p>${row.text}</p></details>
        <label class="fld note-fld">Evidencia (opcional)
          <textarea rows="2" .value=${marca?.note ?? ''} @input=${(e) => this._setProgressNote(dimId, e.target.value)}></textarea>
        </label>
        ${quien}
      </li>`;
  }

  /**
   * Editor inline de carrera: nivel (agrupado por track) y disciplinas (checkboxes)
   * de la persona. Es la asignación que hace el manager; la escala y expectativas del
   * framework siguen siendo de solo lectura. Precargado con `person.levelId` y
   * `person.disciplines` y guardado con `updatePerson`.
   * @returns {import('lit').TemplateResult}
   */
  _renderCareerEditor() {
    const fw = this.framework;
    const tracks = fw?.tracks ?? [];
    const levels = fw?.levels ?? [];
    const groups = tracks
      .map((t) => ({ track: t, levels: levels.filter((l) => l.trackId === t.id) }))
      .filter((g) => g.levels.length > 0);
    const selected = this._career;
    return html`
      <div class="career-editor">
        <p class="edit-hint">Asigna el nivel y los gremios de esta persona.</p>
        <label class="fld">Nivel
          <select
            .value=${selected.levelId}
            @change=${(e) => { this._career = { ...this._career, levelId: e.target.value }; }}
          >
            <option value="">— sin nivel —</option>
            ${groups.map(
              (g) => html`
                <optgroup label=${g.track.name}>
                  ${g.levels.map(
                    (l) => html`<option value=${l.id} ?selected=${l.id === selected.levelId}>${l.code} · ${l.title}</option>`,
                  )}
                </optgroup>
              `,
            )}
          </select>
        </label>
        ${selected.levelId && selected.levelId !== (this.person?.levelId ?? '')
          ? html`<label class="fld chk-ext">
              <input type="checkbox" .checked=${!!selected.correction}
                @change=${(e) => { this._career = { ...this._career, correction: e.target.checked }; }} />
              Es una corrección, no un cambio de nivel (no deja histórico)
            </label>
            ${selected.correction ? null : html`<label class="fld">Nota del cambio de nivel (opcional)
              <input
                type="text"
                maxlength="200"
                placeholder="Ej.: promoción tras el ciclo de evaluación"
                .value=${selected.note}
                @input=${(e) => { this._career = { ...this._career, note: e.target.value }; }}
              />
            </label>`}`
          : null}
        ${this._renderCareerGuilds(selected)}
        ${this._careerError ? html`<p class="error">${this._careerError}</p>` : null}
        <div class="row">
          <button class="primary" ?disabled=${this._careerSaving} @click=${this._saveCareer}>
            ${this._careerSaving ? 'Guardando…' : 'Guardar carrera'}
          </button>
        </div>
        ${this._renderLevelTimeline()}
        ${this._renderProgressionChart()}
      </div>
    `;
  }

  /**
   * Curva de progresión del sub-nivel (RMR-PCS-0037 · F2): serie derivada al
   * vuelo de la bitácora + historial contra las rutas publicadas. Sin puntos
   * (sin bitácora fechada, sin rutas, sin nivel) no se pinta nada.
   * @returns {import('lit').TemplateResult|null}
   */
  _renderProgressionChart() {
    // Con las VALORACIONES, no con los certificados del mapa (RMR-TSK-0556):
    // recorrer un camino de formación no sube de nivel, así que no puede mover
    // esta curva.
    const { points, milestones } = assessmentProgressionSeries({
      person: this.person ?? {},
      framework: this.framework,
      assessments: this._levelAssessments ?? [],
    });
    if (points.length === 0) return null;
    return html`
      <div class="lvl-history">
        <p class="sub">Progresión en el tiempo</p>
        <career-progression-chart .points=${points} .milestones=${milestones}></career-progression-chart>
      </div>
    `;
  }

  /**
   * Línea de tiempo del nivel (RMR-PCS-0037 · F1): los cambios registrados en
   * `person.levelHistory`, de reciente a antiguo. Las fichas anteriores a la
   * épica empiezan su relato en el primer cambio — sin historial no se pinta nada.
   * @returns {import('lit').TemplateResult|null}
   */
  _renderLevelTimeline() {
    const rows = levelHistoryView(this.person?.levelHistory, this.framework?.levels ?? []);
    if (rows.length === 0) return null;
    return html`
      <div class="lvl-history">
        <p class="sub">Historial de nivel</p>
        <ul>
          ${rows.map(
            (r) => html`<li>
              <span class="lvl-change">${r.fromCode ? html`${r.fromCode} → ` : ''}${r.toCode}</span>
              <span class="lvl-when">${r.when}</span>
              ${r.note ? html`<span class="lvl-note">— ${r.note}</span>` : null}
            </li>`,
          )}
        </ul>
      </div>
    `;
  }

  /**
   * Objetivo de carrera declarado por la propia persona (`careerTargetLevelId`),
   * en SOLO LECTURA para el manager (informativo). Si no hay objetivo, muestra un
   * texto discreto.
   * @param {import('../../tools/career/data/framework.js').CareerFramework|null} fw
   * @returns {import('lit').TemplateResult}
   */
  _renderDeclaredTarget(fw) {
    const target = getLevel(fw, this.person.careerTargetLevelId);
    // A qué nivel quiere llegar (RMR-TSK-0761). Lo fija la persona en Mi espacio
    // o, si lo habláis, su responsable aquí: los dos ven y editan lo mismo.
    const options = aspirationalLevels(fw, this.person.levelId);
    return html`
      <p class="sub">Objetivo de carrera</p>
      ${target
        ? html`<p class="target-declared"><span class="code">${target.code}</span> · ${target.title}</p>`
        : html`<p class="target-none">Sin objetivo de carrera: lo marca la persona en Mi espacio o su responsable aquí.</p>`}
      ${options.length ? html`<div class="target-edit">
        <label>Fijar objetivo
          <select @change=${(e) => this._saveTarget(e.target.value || null)} ?disabled=${this._careerSaving}>
            <option value="" ?selected=${!target}>Sin objetivo</option>
            ${options.map((l) => html`<option value=${l.id} ?selected=${l.id === target?.id}>${l.code} · ${l.title}</option>`)}
          </select>
        </label>
      </div>` : null}
      ${this._careerError ? html`<p class="error" role="alert">${this._careerError}</p>` : null}
    `;
  }

  /** @param {string|null} levelId */
  async _saveTarget(levelId) {
    this._careerError = '';
    this._careerSaving = true;
    try {
      await updatePerson(this.persistence, this.person.id, { careerTargetLevelId: levelId });
      this.person = { ...this.person, careerTargetLevelId: levelId };
    } catch (err) {
      this._careerError = err instanceof Error ? err.message : 'No se pudo guardar el objetivo de carrera.';
    } finally {
      this._careerSaving = false;
    }
  }

  /**
   * Historial de rutas de carrera COMPLETADAS por la persona (F3, RMR-TSK-0171):
   * de su bitácora (completedRoutes), con el reto, las fechas inicio→fin y el
   * tiempo. Solo lectura; las reglas de Firestore ya permiten al manager dueño leer
   * /people/{id}/career/logbook.
   */
  _renderCompletedRoutes() {
    const done = this._logbook ? completedRoutes(this._logbook) : [];
    return html`
      <p class="sub">Rutas de carrera completadas</p>
      ${done.length === 0
        ? html`<p class="target-none">Sin rutas completadas todavía.</p>`
        : html`<ul class="routes-done">
            ${done.map(
              (r) => html`<li class="route-done-row">
                <span class="rd-name">🏆 ${r.name}</span>
                <span class="rd-meta">${this._routeDoneMeta(r)}</span>
              </li>`,
            )}
          </ul>`}
    `;
  }

  /** Meta de una ruta completada para el manager: «Del {inicio} al {fin} · {tiempo}»
   * (o «Completada el {fin}» si no hay inicio registrado).
   * @param {import('../../tools/career/domain/logbook.js').CompletedRoute} r */
  _routeDoneMeta(r) {
    const end = formatAchievedAt(r.completedAt) ?? 'fecha no registrada';
    const start = r.startedAt === null ? null : formatAchievedAt(r.startedAt);
    const dur = r.durationMs === null ? '' : ` · ${formatDuration(r.durationMs)}`;
    return start ? `Del ${start} al ${end}${dur}` : `Completada el ${end}${dur}`;
  }

  // ---- Gremios, en Carrera (RMR-TSK-0760) ------------------------------------

  /**
   * Gremios de la persona, una sola lista (RMR-TSK-0760): antes había gremios en
   * Organización y disciplinas aquí, y podían no casar. La disciplina del
   * framework sale de cada gremio y se enseña para que se vea de dónde viene.
   * Solo en los departamentos que tienen gremios (hoy Tech, RMR-TSK-0593).
   */
  _renderCareerGuilds(d) {
    if (!departmentHasGuilds(this.person?.orgBranch, this._branchesCat)) return null;
    const names = new Map((this.framework?.disciplines ?? []).map((x) => [x.id, x.name]));
    const derived = disciplinesForGuilds(d.guilds, this._guildsCat).map((id) => names.get(id) ?? id);
    return html`<fieldset class="disc">
      <legend>Gremios</legend>
      ${this._renderDatosChecks('Gremios', this._guildsCat, d.guilds, (n, c) => this._toggleCareerGuild(n, c))}
      <p class="edit-hint">Disciplina en el framework: ${derived.length ? derived.join(', ') : 'ninguna'}.</p>
    </fieldset>
    ${this._renderPrimaryGuild(d)}`;
  }

  /** @param {string} name @param {boolean} checked */
  _toggleCareerGuild(name, checked) {
    const guilds = checked ? [...this._career.guilds, name] : this._career.guilds.filter((g) => g !== name);
    // El principal se recalcula con la lista nueva: al quitarle el gremio que
    // era principal, deja de serlo en el momento — no al guardar.
    this._career = { ...this._career, guilds, primaryGuild: normalizePrimaryGuild(guilds, this._career.primaryGuild) };
  }

  /** @param {string} name */
  _pickPrimaryGuild(name) {
    this._career = { ...this._career, primaryGuild: normalizePrimaryGuild(this._career.guilds, name) };
  }

  // ---- Pestaña «Datos» (identidad de la persona, RMR-TSK-0173) --------------

  /** Guarda los datos personales (nombre, github, fecha de alta, ubicación).
   * No toca uid/pendingEmail (eso es la acción «Invitar», aparte), ni los
   * gremios, que se guardan con la carrera (RMR-TSK-0760). */
  async _saveDatos() {
    if (!this.persistence || !this.person) return;
    const name = this._datos.name.trim();
    if (!name && !this._notionSync) {
      this._datosError = 'El nombre es obligatorio.';
      return;
    }
    this._datosSaving = true;
    this._datosError = '';
    this._datosSaved = false;
    try {
      const patch = {
        name,
        githubLogin: this._datos.githubLogin.trim() || null,
        startDate: this._datos.startDate || null,
        location: this._datos.location.trim() || null,
        external: !!this._datos.external,
      };
      // El email SOLO se edita si aún no tiene cuenta (pendingEmail = auto-vínculo
      // al primer login). Si ya tiene cuenta, su email es el de su login (no se toca).
      if (!this.person.uid) {
        patch.pendingEmail = normalizeInviteEmail(this._datos.pendingEmail);
        // Solo emails de la organización (RMR-TSK-0774); las reglas lo imponen igual.
        const outside = inviteDomainError(patch.pendingEmail, await getEmployeeDomain());
        if (outside) throw new Error(outside);
      }
      // Con Notion conectado, lo suyo no viaja: lo escribe el importador (RMR-TSK-0588).
      const allowed = withoutNotionFields(patch, this._notionSync);
      await updatePerson(this.persistence, this.person.id, allowed);
      this.person = { ...this.person, ...allowed }; // refleja en la cabecera sin recargar
      this._datosSaved = true;
      this.dispatchEvent(new CustomEvent('person-updated', { detail: { id: this.person.id }, bubbles: true, composed: true }));
    } catch (err) {
      this._datosError = err instanceof Error ? err.message : 'No se pudo guardar.';
    } finally {
      this._datosSaving = false;
    }
  }

  /** Fieldset de checkboxes (gremios/labels) del catálogo MÁS los que la persona
   * tenga fuera del catálogo (p. ej. metidos por importación): así se pueden
   * desmarcar y quitar aunque no existan en el catálogo. */
  _renderDatosChecks(legend, catalog, selected, onToggle) {
    const catalogNames = new Set(catalog.map((c) => c.name));
    const orphans = (selected ?? []).filter((name) => !catalogNames.has(name));
    if (catalog.length === 0 && orphans.length === 0) {
      return html`<p class="empty">Aún no hay ${legend.toLowerCase()} (se gestionan en Ajustes).</p>`;
    }
    return html`<div class="org-checks">
      ${catalog.map((c) => this._datosCheck(c.name, selected, onToggle, false))}
      ${orphans.map((name) => this._datosCheck(name, selected, onToggle, true))}
    </div>`;
  }

  /**
   * Gremio PRINCIPAL (RMR-TSK-0594). Solo aparece con DOS o más gremios: con uno
   * no hay nada que elegir, y preguntarlo sería ruido. Son radios y no un
   * `<select>` a propósito — con dos o tres opciones se ven todas de un vistazo,
   * y un select con `<option>` en la misma plantilla de Lit no refleja su valor.
   *
   * Mientras no haya elegido, se dice: quien mira la ficha necesita saber que ahí
   * falta un dato, no encontrarse una elección hecha por nosotros.
   * @param {{ guilds: string[], primaryGuild: string|null }} d
   */
  _renderPrimaryGuild(d) {
    if ((d.guilds ?? []).length < 2) return null;
    return html`<fieldset class="primary-guild">
      <legend>Gremio principal</legend>
      <p class="hint">
        Está en varios gremios. El principal es el que cuenta al agrupar por gremio;
        los demás se conservan como contexto.
      </p>
      ${d.primaryGuild ? null : html`<p class="warn">Sin elegir: al contar por gremio, esta persona no suma en ninguno.</p>`}
      <div class="org-checks">
        ${d.guilds.map((name) => html`<label class="chk">
          <input
            type="radio"
            name="primary-guild"
            .checked=${d.primaryGuild === name}
            @change=${() => this._pickPrimaryGuild(name)}
          />
          <span>${name}</span>
        </label>`)}
      </div>
    </fieldset>`;
  }

  /** Un checkbox de gremio/label; `orphan` marca los que están fuera del catálogo. */
  _datosCheck(name, selected, onToggle, orphan) {
    return html`<label class="chk">
      <input type="checkbox" .checked=${selected.includes(name)} @change=${(e) => onToggle(name, e.target.checked)} />
      <span>${name}${orphan ? html` <em class="orphan-tag">(fuera de catálogo)</em>` : null}</span>
    </label>`;
  }

  /**
   * Bloque de EMAIL/cuenta (RMR-TSK-0175): si la persona ya tiene cuenta, su
   * email es el de su login (solo lectura); si aún no ha entrado, el email es
   * editable (pendingEmail) y al entrar por primera vez con él, su cuenta se
   * vincula sola. Se guarda con el resto de Datos.
   */
  _renderEmailBlock() {
    if (this.person?.uid) {
      const u = this._usersCat.find((x) => x.uid === this.person.uid);
      const suffix = u?.email ? ` · ${u.email}` : '';
      return html`<div class="acct">
        <p>🔗 Cuenta vinculada${suffix}.</p>
        <span class="empty">El email lo toma de su cuenta; no se edita aquí.</span>
      </div>`;
    }
    return html`<label class="fld">Email (aún no ha entrado)
      <input
        type="email"
        placeholder="persona@empresa.com"
        .value=${this._datos.pendingEmail}
        @input=${(e) => { this._datos = { ...this._datos, pendingEmail: e.target.value }; }}
      />
      <span class="fld-hint">Al entrar por primera vez con este email, su cuenta se vincula sola. Cuida la ortografía: un typo la dejaría sin vincular.</span>
    </label>`;
  }

  /** Marca/desmarca «En Madrid»: al marcar fija location='Madrid'; al desmarcar
   * la vacía para que se indique dónde. @param {boolean} checked */
  _setInMadrid(checked) {
    this._datos = { ...this._datos, location: checked ? 'Madrid' : '' };
  }

  /** Ubicación (RMR-TSK-0179): «En Madrid» sí/no y, si no, dónde. */
  _renderLocationBlock() {
    const inMadrid = this._datos.location === 'Madrid';
    return html`<div class="fld">
      <span>Ubicación</span>
      <label class="chk-loc">
        <input type="checkbox" .checked=${inMadrid} @change=${(e) => this._setInMadrid(e.target.checked)} />
        En Madrid
      </label>
      ${inMadrid
        ? null
        : html`<input
            type="text"
            placeholder="¿Dónde? (ciudad / remoto)"
            .value=${this._datos.location}
            @input=${(e) => { this._datos = { ...this._datos, location: e.target.value }; }}
          />`}
    </div>`;
  }

  /**
   * Feedback + botón de guardado de la ficha de datos. Tanto «Datos» como
   * «Organización» editan el mismo borrador `this._datos` y persisten TODO con
   * `_saveDatos` (nombre, github, ubicación, externo, gremios, labels, squads y
   * email), así que comparten esta misma acción — cambia solo la etiqueta.
   * @param {string} label  texto del botón
   * @returns {import('lit').TemplateResult}
   */
  _renderDatosActions(label) {
    return html`
      ${this._datosError ? html`<p class="error">${this._datosError}</p>` : null}
      <div class="datos-actions">
        <button class="primary" type="button" ?disabled=${this._datosSaving} @click=${() => this._saveDatos()}>
          ${this._datosSaving ? 'Guardando…' : label}
        </button>
        ${this._datosSaved ? html`<span class="saved">✓ Guardado</span>` : null}
      </div>
    `;
  }

  /** Pestaña «Datos»: identidad básica editable de la persona (nombre, github,
   * fecha de alta, ubicación, externo/a y email). La clasificación por gremios,
   * labels y squads vive en la pestaña «Organización». */
  _renderDatos() {
    const d = this._datos;
    return html`
      <section class="datos">
        ${this._notionSync ? this._renderNotionDatos(d) : this._renderEditableNotionDatos(d)}
        <label class="fld">GitHub (login)
          <input type="text" placeholder="usuario-github" .value=${d.githubLogin} @input=${(e) => { this._datos = { ...d, githubLogin: e.target.value }; }} />
        </label>
        ${this._renderLocationBlock()}
        ${this._renderDatosActions('Guardar datos')}
      </section>
    `;
  }

  /** Sin Notion (la demo): nombre, alta, externo y email se editan aquí. */
  _renderEditableNotionDatos(d) {
    return html`
      <label class="fld">Nombre
        <input type="text" .value=${d.name} @input=${(e) => { this._datos = { ...d, name: e.target.value }; }} />
      </label>
      <label class="fld">Fecha de alta
        <input type="date" .value=${d.startDate} @input=${(e) => { this._datos = { ...d, startDate: e.target.value }; }} />
      </label>
      <label class="fld chk-ext">
        <input type="checkbox" .checked=${!!d.external} @change=${(e) => { this._datos = { ...d, external: e.target.checked }; }} />
        Es externo/a
      </label>
      ${this._renderEmailBlock()}`;
  }

  /** Con Notion (RMR-TSK-0588): se ven, no se editan; la fuente de verdad es Notion. */
  _renderNotionDatos(d) {
    const email = this.person?.email ?? d.pendingEmail ?? '';
    const external = d.external ? 'Sí' : 'No';
    return html`
      <p class="hint">Nombre, alta, externo, email, departamento y manager vienen de Notion: se cambian allí.</p>
      <dl class="notion-datos">
        <dt>Nombre</dt><dd>${d.name || '—'}</dd>
        <dt>Fecha de alta</dt><dd>${d.startDate || '—'}</dd>
        <dt>Externo/a</dt><dd>${external}</dd>
        <dt>Email</dt><dd>${email || '—'}</dd>
      </dl>`;
  }

  render() {
    if (!this.person) return null;
    // El subnivel delante del título, el mismo de Personas y Seguimiento (RMR-TSK-0696).
    const baseTitle = composeTitle(this.framework, this.person.levelId, this.person.disciplines);
    const title = this._subLevel?.label && baseTitle ? `${this._subLevel.label} · ${baseTitle}` : baseTitle;
    const disciplineNames = (this.framework?.disciplines ?? [])
      .filter((d) => (this.person.disciplines ?? []).includes(d.id))
      .map((d) => d.name);
    const guilds = this.person.guilds ?? [];
    const role = (this._rolesCat ?? []).find((r) => r.id === this.person.orgRole)?.label ?? null;
    return html`
      <div class="head">
        <h2>${this.person.name}</h2>
        ${role ? html`<p class="role">${role}</p>` : null}
        ${title ? html`<p class="title">${title}</p>` : null}
        ${disciplineNames.length > 0
          ? html`<span class="chips">${disciplineNames.map((n) => html`<span class="chip">${n}</span>`)}</span>`
          : null}
        ${guilds.length > 0
          ? html`<span class="chips">${guilds.map((g) => html`<span class="chip">${g}</span>`)}</span>`
          : null}
      </div>
      ${this.error ? html`<p class="error">${this.error}</p>` : null}
      ${this.loading
        ? skeletonLines(3)
        : html`
            ${this._renderSubtabs()}
            <div
              id="ppanel-${this._subtab}"
              class="subpanel"
              role="tabpanel"
              aria-labelledby="psub-${this._subtab}"
              tabindex="0"
            >
              ${this._renderActivePanel()}
            </div>
          `}
    `;
  }

  /**
   * Renderiza solo la sección de la sub-pestaña activa, reutilizando los
   * `_render*` existentes sin alterar su lógica.
   * @returns {import('lit').TemplateResult}
   */
  // ── Permisos de herramientas por persona (RMR-PCS-0027 · F8b) ──────────────

  /**
   * La matriz vive en <person-permissions>, compartida con Administración ›
   * Permisos: son la misma cosa vista desde dos puertas, y tenerla dos veces ya
   * hizo que divergieran (RMR-TSK-0460).
   */
  _renderPermisos() {
    return html`<section class="perms">
      <person-permissions
        .person=${this.person}
        .policies=${this._toolPolicies ?? []}
        .save=${(personId, toolOverrides) => this._savePerms(personId, toolOverrides)}
      ></person-permissions>
    </section>`;
  }

  /** Persiste las excepciones y deja la persona en memoria al día. */
  async _savePerms(personId, toolOverrides) {
    await updatePerson(this.persistence, personId, { toolOverrides });
    this.person = { ...this.person, toolOverrides };
  }

  /** La fase de la organización ajusta el perfil ideal: se lee al abrir la pestaña, una vez. */
  _renderRoleMirror() {
    if (this._orgConfig === undefined) {
      this._orgConfigReq ??= getOrgConfig()
        .catch((err) => { console.warn('Role Mirror · sin configuración de la organización', err); return null; })
        .then((config) => { this._orgConfig = config; });
      return skeletonLines(6);
    }
    return html`<rm-person .person=${this.person} .items=${ITEMS} .roles=${ROLES}
      .dimensions=${RM_DIMENSIONS} .orgConfig=${this._orgConfig}></rm-person>`;
  }

  _renderActivePanel() {
    const panel = {
      datos: () => this._renderDatos(),
      carrera: () => this._renderCareer(),
      dimensiones: () => this._renderDimensions(),
      conversations: () => this._renderO2O(),
      perf: () => html`<manager-notes person-id=${this.person.id}></manager-notes>`,
      // El mismo Role Mirror de la herramienta (RMR-TSK-0734): perfil, propuesta e histórico.
      rolemirror: () => this._renderRoleMirror(),
      permisos: () => this._renderPermisos(),
    }[this._subtab] ?? (() => this._renderDatos());
    return panel();
  }
}

if (!customElements.get('team-person-detail')) {
  customElements.define('team-person-detail', TeamPersonDetail);
}
