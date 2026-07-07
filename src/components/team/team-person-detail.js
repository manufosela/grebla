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
import './team-level-input.js';
import {
  addReading,
  getPersonTimeline,
  listAreas,
  registerConversation,
  listConversations,
  addSupportNote,
  listSupportNotes,
  removeSupportNote,
  updatePerson,
  listLabels,
  listGuilds,
  normalizeInviteEmail,
} from '../../tools/team/application/usecases/index.js';
import { listUsers } from '../../lib/users.js';
import { levelLabel, levelToNumber } from '../../tools/team/domain/levels.js';
import { sparkline, sparklineTrend, SPARK_MAX } from '../../tools/team/domain/services/sparkline.js';
import { BELBIN_ROLES } from '../../tools/team/domain/belbin.js';
import { getCurrentUser } from '../../lib/auth.js';
import {
  composeTitle,
  getLevel,
  expectationsForLevel,
  addendumsForDisciplines,
  aspirationalLevels,
} from '../../tools/career/data/framework.js';
import {
  assessmentRows,
  improvementPoints,
  careerSuggestion,
} from '../../tools/career/data/assessment.js';
import { getCareerAssessment, saveCareerAssessment } from '../../lib/careerAssessment.js';
import { getPersonLogbook } from '../../lib/engineer.js';
import { completedRoutes, formatDuration } from '../../tools/career/domain/logbook.js';
import { formatAchievedAt } from '../../tools/career/domain/achievements.js';

const CONTRIB_STATES = [
  { value: '', label: '—' },
  { value: 'secondary', label: 'Secundario' },
  { value: 'primary', label: 'Primario' },
];

const CONVERSATION_TYPES = [
  { value: 'o2o', label: '1:1 (O2O)' },
  { value: 'catchup', label: 'Catch-up' },
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

/**
 * Línea de autoría/fecha de una entrada (nota o conversación). Con autor muestra
 * «por {nombre} · {fecha}»; sin autor (registros antiguos) solo la fecha.
 * @param {{ date: string, createdBy?: { name: string } }} entry
 * @returns {string}
 */
function authorLine(entry) {
  const date = formatDate(entry.date);
  const name = entry.createdBy?.name;
  return name ? `por ${name} · ${date}` : date;
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
  { id: 'seniority', label: 'Seniority' },
  { id: 'emotional', label: 'Emocional' },
  { id: 'knowledge', label: 'Conocimiento' },
  { id: 'contribution', label: 'Contribución' },
  { id: 'conversations', label: 'Conversaciones' },
  { id: 'notes', label: 'Notas' },
];

export class TeamPersonDetail extends LitElement {
  static properties = {
    persistence: { attribute: false },
    person: { attribute: false },
    framework: { attribute: false },
    isAdmin: { attribute: false },
    initialSubtab: { attribute: false },
    timeline: { state: true },
    areas: { state: true },
    conversations: { state: true },
    notes: { state: true },
    loading: { state: true },
    error: { state: true },
    _subtab: { state: true },
    _form: { state: true },
    _know: { state: true },
    _contrib: { state: true },
    _conv: { state: true },
    _noteText: { state: true },
    _confirmNote: { state: true },
    _career: { state: true },
    _logbook: { state: true },
    _datos: { state: true },
    _guildsCat: { state: true },
    _labelsCat: { state: true },
    _usersCat: { state: true },
    _datosSaving: { state: true },
    _datosError: { state: true },
    _datosSaved: { state: true },
    _careerSaving: { state: true },
    _careerError: { state: true },
    _assessment: { state: true },
    _assessmentDraft: { state: true },
    _assessmentSaving: { state: true },
    _assessmentError: { state: true },
    _assessmentSaved: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .head { margin-bottom: 1rem; }
    .head h2 { margin: 0; font-size: 1.3rem; }
    .head .title { margin: 0.3rem 0 0; font-size: 0.95rem; font-weight: 600; color: var(--rm-text, #111827); }
    .head .chips { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
    .chip { background: var(--rm-track, #e9f0f2); border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.78rem; font-weight: 600; }
    section {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
    }
    h3 { font-size: 1rem; margin: 0 0 0.75rem; }
    .form { display: grid; gap: 0.6rem; margin: 0.5rem 0 1rem; }
    textarea, input[type='date'] {
      border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; padding: 0.5rem 0.6rem;
      font: inherit; font-size: 0.9rem; color: var(--rm-text, #111827); background: var(--rm-surface, #fff);
    }
    textarea { resize: vertical; min-height: 2.4rem; }
    .row { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    button.primary {
      border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff);
      border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    button.primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .hist { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    .hist li { display: flex; gap: 0.6rem; padding: 0.35rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .hist .when { color: var(--rm-muted, #9ca3af); white-space: nowrap; min-width: 7.5rem; }
    .hist .lvl { font-weight: 600; }
    .hist .note { color: var(--rm-muted, #6b7280); }
    .empty { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    label.fld { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    select { border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; padding: 0.5rem 0.6rem; font: inherit; font-size: 0.9rem; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    section.support { border-left: 4px solid var(--rm-warning, #f2887a); }
    .disclaimer { font-size: 0.8rem; color: var(--rm-muted, #6b7280); background: var(--rm-coral-soft, #fdecea); border-radius: 8px; padding: 0.5rem 0.75rem; margin: 0 0 0.75rem; }
    .hist .del { margin-left: auto; white-space: nowrap; }
    .link { border: 0; background: none; cursor: pointer; font-weight: 700; font-size: 0.8rem; color: var(--rm-muted, #6b7280); padding: 0 0.2rem; }
    .link.yes { color: var(--rm-danger, #dc2626); }
    .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.75rem; }
    .belbin { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.4rem 1rem; }
    .belbin-row { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
    .belbin-row .b-name { font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bias { font-size: 0.78rem; color: var(--rm-muted, #6b7280); background: var(--rm-coral-soft, #fdecea); border-radius: 8px; padding: 0.45rem 0.7rem; margin: 0 0 0.75rem; }
    section.career { border-left: 4px solid var(--rm-accent, #2a9d8f); }
    .career .sub { font-size: 0.85rem; font-weight: 700; color: var(--rm-text, #111827); margin: 1.1rem 0 0.35rem; }
    .career .now .code { font-weight: 700; }
    .career .now .desc { font-size: 0.85rem; color: var(--rm-text, #111827); margin: 0.2rem 0 0; }
    .career .now .profile { font-size: 0.8rem; color: var(--rm-muted, #6b7280); margin: 0.2rem 0 0; }
    .career .expect { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    .career .expect li { padding: 0.4rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .career .expect .dim { font-weight: 700; }
    .career .expect .txt { color: var(--rm-text, #111827); }
    .career .expect .todo { color: var(--rm-muted, #9ca3af); font-style: italic; }
    .career .addn { margin: 0.3rem 0 0; }
    .career .addn .disc { font-weight: 700; font-size: 0.85rem; margin: 0.6rem 0 0.2rem; }
    .career .addn ul { list-style: none; margin: 0; padding: 0; font-size: 0.83rem; }
    .career .addn li { padding: 0.25rem 0; }
    .career .addn .dim { font-weight: 600; }
    .career .aspire { list-style: none; margin: 0; padding: 0; }
    .career .aspire > li { border-top: 1px solid var(--rm-border, #eef0f2); }
    .career .aspire summary { cursor: pointer; padding: 0.45rem 0; font-size: 0.88rem; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
    .career .aspire summary::-webkit-details-marker { color: var(--rm-muted, #9ca3af); }
    .career .aspire .code { font-weight: 700; }
    .career .aspire .track { color: var(--rm-muted, #6b7280); font-size: 0.78rem; }
    .career .aspire .desc { font-size: 0.82rem; color: var(--rm-muted, #4b5563); margin: 0 0 0.5rem; padding-left: 1.1rem; }
    .career .target-declared { margin: 0.2rem 0 0; font-size: 0.9rem; font-weight: 700; color: var(--rm-accent, #2a9d8f); }
    .career .target-declared .code { font-weight: 800; }
    .career .target-none { margin: 0.2rem 0 0; font-size: 0.83rem; color: var(--rm-muted, #9ca3af); font-style: italic; }
    .career .routes-done { list-style: none; margin: 0.2rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .career .route-done-row { display: flex; flex-direction: column; gap: 0.05rem; padding: 0.4rem 0.55rem; border-radius: 8px; background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 8%, transparent); }
    .career .route-done-row .rd-name { font-weight: 700; font-size: 0.85rem; color: var(--rm-text, #111827); }
    .career .route-done-row .rd-meta { font-size: 0.76rem; color: var(--rm-muted, #6b7280); }
    /* Pestaña «Datos» (RMR-TSK-0173). */
    .datos { display: flex; flex-direction: column; gap: 0.9rem; max-width: 560px; }
    .datos .fld { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.82rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); }
    .datos .fld input { font: inherit; font-weight: 400; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; }
    .datos .fld .chk-loc { display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 400; font-size: 0.9rem; color: var(--rm-text, #111827); }
    .datos .fld .chk-loc input { width: auto; }
    .datos-checks { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.5rem 0.7rem; margin: 0; }
    .datos-checks legend { font-size: 0.8rem; font-weight: 700; color: var(--rm-navy, #1e3a5f); padding: 0 0.3rem; }
    .datos-checks .chk { display: inline-flex; align-items: center; gap: 0.35rem; margin: 0.15rem 0.7rem 0.15rem 0; font-size: 0.82rem; }
    .datos-checks .empty { font-size: 0.8rem; color: var(--rm-muted, #9ca3af); }
    .datos .acct { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: 0.85rem; margin: 0; }
    .datos .acct .empty { color: var(--rm-muted, #9ca3af); }
    .datos .acct .act { border: 1px solid var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f); background: var(--rm-surface, #fff); border-radius: 999px; padding: 0.35rem 0.8rem; font-weight: 700; cursor: pointer; }
    .datos-actions { display: flex; align-items: center; gap: 0.7rem; }
    .datos-actions .primary { background: var(--rm-accent, #2a9d8f); border: none; color: #fff; border-radius: 8px; padding: 0.5rem 1rem; font-weight: 800; cursor: pointer; }
    .datos-actions .saved { color: var(--rm-accent, #2a9d8f); font-weight: 700; font-size: 0.85rem; }
    .datos .fld-hint { font-weight: 400; font-size: 0.75rem; color: var(--rm-muted, #9ca3af); }

    /* ── Valoración frente al nivel (verde «cumple» / rojo «no llega») ── */
    .career .assess { list-style: none; margin: 0.3rem 0 0.75rem; padding: 0; display: grid; gap: 0.6rem; }
    .career .assess-row { border: 1px solid var(--rm-border, #e5e7eb); border-left-width: 4px; border-radius: 8px; padding: 0.6rem 0.8rem; }
    .career .assess-row.ok { border-left-color: var(--rm-accent, #2a9d8f); }
    .career .assess-row.bad { border-left-color: var(--rm-danger, #dc2626); }
    .career .assess-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
    .career .assess-head .dim { font-weight: 700; font-size: 0.9rem; }
    .career .seg { display: inline-flex; border: 1px solid var(--rm-border, #d1d5db); border-radius: 999px; overflow: hidden; }
    .career .seg-btn { border: 0; background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280); font: inherit; font-size: 0.8rem; font-weight: 700; padding: 0.35rem 0.9rem; cursor: pointer; }
    .career .seg-btn + .seg-btn { border-left: 1px solid var(--rm-border, #d1d5db); }
    .career .seg-btn:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: -2px; }
    .career .seg-btn.ok.on { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .career .seg-btn.bad.on { background: var(--rm-danger, #dc2626); color: var(--rm-on-accent, #fff); }
    .career .assess-row .exp { margin: 0.5rem 0 0; }
    .career .assess-row .exp summary { cursor: pointer; font-size: 0.82rem; color: var(--rm-muted, #6b7280); }
    .career .assess-row .exp p { margin: 0.3rem 0 0; font-size: 0.85rem; color: var(--rm-text, #111827); }
    .career .assess-row .todo { margin: 0.5rem 0 0; font-size: 0.82rem; color: var(--rm-muted, #9ca3af); font-style: italic; }
    .career .note-fld { margin: 0.5rem 0 0; }
    .career .saved { color: var(--rm-accent, #2a9d8f); font-size: 0.83rem; font-weight: 600; }
    .career .improve { list-style: none; margin: 0.3rem 0 0; padding: 0; font-size: 0.85rem; }
    .career .improve li { padding: 0.4rem 0; border-top: 1px solid var(--rm-border, #eef0f2); }
    .career .improve .dim { font-weight: 700; color: var(--rm-danger, #dc2626); }
    .career .improve .note { margin: 0.2rem 0 0; color: var(--rm-muted, #6b7280); font-size: 0.83rem; }
    .career .suggest { margin: 0.2rem 0 0; font-size: 0.9rem; color: var(--rm-text, #111827); }

    /* ── Rediseño de dimensiones: Actual destacado + alta plegable + tabla + gráfico ── */
    .actual {
      display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.4rem 0.9rem;
      border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--rm-accent, #2a9d8f);
      border-radius: 10px; padding: 0.7rem 1rem; margin: 0 0 0.9rem; background: var(--rm-track, #e9f0f2);
    }
    .actual .tag { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--rm-accent, #2a9d8f); }
    .actual .val { font-size: 1.15rem; font-weight: 800; line-height: 1.1; color: var(--rm-text, #111827); }
    .actual .at { font-size: 0.82rem; color: var(--rm-muted, #6b7280); }
    .actual.none { border-left-color: var(--rm-border, #d1d5db); background: transparent; }
    .actual .void { font-size: 0.92rem; color: var(--rm-muted, #9ca3af); font-style: italic; }
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
    .chart-empty { font-size: 0.83rem; color: var(--rm-muted, #9ca3af); font-style: italic; margin: 0.25rem 0; }

    table.htable { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    table.htable caption { text-align: left; font-size: 0.78rem; font-weight: 700; color: var(--rm-muted, #6b7280); padding: 0 0 0.4rem; }
    table.htable th, table.htable td { text-align: left; padding: 0.4rem 0.6rem 0.4rem 0; border-bottom: 1px solid var(--rm-border, #eef0f2); vertical-align: top; }
    table.htable thead th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--rm-muted, #9ca3af); font-weight: 700; }
    table.htable td.when { color: var(--rm-muted, #9ca3af); white-space: nowrap; }
    table.htable td.lvl { font-weight: 600; color: var(--rm-text, #111827); }
    table.htable td.note { color: var(--rm-muted, #6b7280); }

    ul.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    ul.bars .bar-row { display: grid; grid-template-columns: minmax(5rem, 8rem) 1fr auto; align-items: center; gap: 0.5rem; }
    ul.bars .bar-name { font-size: 0.82rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    ul.bars .bar-track { height: 0.55rem; background: var(--rm-track, #e9f0f2); border-radius: 999px; overflow: hidden; }
    ul.bars .bar-fill { display: block; height: 100%; background: var(--rm-accent, #2a9d8f); border-radius: 999px; }
    ul.bars .bar-val { font-size: 0.78rem; color: var(--rm-muted, #6b7280); white-space: nowrap; }

    .freq { font-size: 0.83rem; color: var(--rm-muted, #6b7280); margin: 0.85rem 0 0; }
    .freq strong { color: var(--rm-text, #111827); }

    /* ── Barra de sub-pestañas (patrón ARIA tablist, coherente con Ajustes) ── */
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280);
      border-radius: 999px; padding: 0.4rem 1rem; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    .tab:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .subpanel:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: var(--rm-radius, 12px); }

    /* ── Editor inline de carrera (nivel + disciplinas) ── */
    .career-editor { display: grid; gap: 0.75rem; margin: 0.25rem 0 1.25rem; }
    .career-editor .edit-hint { margin: 0; font-size: 0.83rem; color: var(--rm-muted, #6b7280); }
    .career-editor .fld { max-width: 28rem; }
    fieldset.disc { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 8px; padding: 0.6rem 0.9rem; margin: 0; }
    fieldset.disc legend { font-size: 0.78rem; color: var(--rm-muted, #6b7280); font-weight: 600; padding: 0 0.35rem; }
    .disc-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.35rem 1rem; }
    .disc-check { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; cursor: pointer; }
    .fw-admin { margin: 1rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #6b7280); }
    .fw-admin a { color: var(--rm-accent, #2a9d8f); font-weight: 600; }
    .link-inline {
      border: 0; background: none; padding: 0; margin: 0; cursor: pointer;
      font: inherit; font-weight: 700; color: var(--rm-accent, #2a9d8f); text-decoration: underline;
    }
    .link-inline:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; border-radius: 4px; }
  `;

  constructor() {
    super();
    this.persistence = null;
    /** @type {import('../../tools/team/domain/types.js').Person|null} */
    this.person = null;
    /** @type {import('../../tools/career/data/framework.js').CareerFramework|null} framework de carrera (para el título compuesto) */
    this.framework = null;
    /** @type {boolean} el enlace al panel de admin del framework solo se muestra al superadmin */
    this.isAdmin = false;
    /** @type {string|null} sub-pestaña con la que abrir la ficha (p. ej. al saltar desde una dimensión del Mapa) */
    this.initialSubtab = null;
    /** @type {string} sub-pestaña activa de la ficha (arranca en Datos) */
    this._subtab = 'datos';
    /** @type {{ levelId: string, disciplines: string[] }} edición inline de carrera (nivel + disciplinas) */
    this._career = { levelId: '', disciplines: [] };
    /** @type {boolean} guardado de carrera en curso */
    this._careerSaving = false;
    /** @type {string} error in-place del formulario de carrera */
    this._careerError = '';
    /** @type {import('../../tools/career/data/assessment.js').CareerAssessment} valoración frente al nivel (persistida) */
    this._assessment = { byDimension: {} };
    /** @type {Record<string, { meets: boolean, note: string }>} borrador editable de la valoración */
    this._assessmentDraft = {};
    /** @type {boolean} guardado de la valoración en curso */
    this._assessmentSaving = false;
    /** @type {string} error in-place de la valoración */
    this._assessmentError = '';
    /** @type {boolean} feedback tras guardar la valoración */
    this._assessmentSaved = false;
    /** @type {{ entries: import('../../tools/career/domain/logbook.js').LogEntry[] }|null}
     * bitácora de la persona (JG-23) para el historial de rutas completadas (F3) */
    this._logbook = null;
    /** Borrador editable de la pestaña «Datos» (RMR-TSK-0173). Se siembra desde
     * la persona al abrirla. @type {{ name: string, githubLogin: string, startDate: string, guilds: string[], labels: string[], uid: string }} */
    this._datos = { name: '', githubLogin: '', startDate: '', guilds: [], labels: [], uid: '' };
    /** Catálogos para los selectores de Datos (gremios, labels, cuentas). */
    this._guildsCat = [];
    this._labelsCat = [];
    this._usersCat = [];
    this._datosSaving = false;
    this._datosError = '';
    this._datosSaved = false;
    this.timeline = { seniority: [], emotional: [], knowledge: [], contribution: [] };
    /** @type {import('../../tools/team/domain/types.js').Area[]} */
    this.areas = [];
    /** @type {import('../../tools/team/domain/types.js').Conversation[]} */
    this.conversations = [];
    /** @type {import('../../tools/team/domain/types.js').SupportNote[]} */
    this.notes = [];
    this.loading = true;
    this.error = '';
    this._form = {
      seniority: { level: 0, toNext: false, note: '', date: '' },
      emotional: { level: 0, toNext: false, note: '', date: '' },
    };
    this._know = { areaId: '', level: 0, toNext: false, note: '', date: '' };
    this._contrib = { roles: {}, note: '', date: '' };
    this._conv = { type: 'o2o', date: '', notes: '' };
    this._noteText = '';
    /** @type {string|null} */
    this._confirmNote = null;
    this._loadedFor = null;
  }

  updated() {
    if (this.persistence && this.person && this._loadedFor !== this.person.id) {
      this._loadedFor = this.person.id;
      // Al abrir una persona nueva, respeta la sub-pestaña inicial solicitada
      // (p. ej. la dimensión pulsada en el Mapa); si no, arranca en «Carrera».
      if (this.initialSubtab && SUBTABS.some((t) => t.id === this.initialSubtab)) {
        this._subtab = this.initialSubtab;
      }
      this._seedCareer();
      this._seedDatos();
      this._load();
    }
  }

  /** Siembra el borrador de «Datos» desde la persona (RMR-TSK-0173). */
  _seedDatos() {
    const p = this.person;
    this._datos = {
      name: p?.name ?? '',
      githubLogin: p?.githubLogin ?? '',
      startDate: p?.startDate ?? '',
      guilds: [...(p?.guilds ?? [])],
      labels: [...(p?.labels ?? [])],
      uid: p?.uid ?? '',
      pendingEmail: p?.pendingEmail ?? '',
      location: p?.location ?? '',
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
      disciplines: [...(this.person.disciplines ?? [])],
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
    const ids = SUBTABS.map((t) => t.id);
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
   * Marca/desmarca una disciplina en el formulario inline de carrera.
   * @param {string} id  id de la disciplina
   * @param {boolean} checked
   * @returns {void}
   */
  _toggleCareerDiscipline(id, checked) {
    const disciplines = checked
      ? [...this._career.disciplines, id]
      : this._career.disciplines.filter((d) => d !== id);
    this._career = { ...this._career, disciplines };
  }

  /**
   * Guarda el nivel y las disciplinas de la persona (la asignación que hace el
   * líder). Reutiliza `updatePerson`, el mismo caso de uso que la sección Personas,
   * y refresca `this.person` reasignando un objeto nuevo para re-renderizar.
   * @returns {Promise<void>}
   */
  async _saveCareer() {
    this._careerError = '';
    this._careerSaving = true;
    const levelId = this._career.levelId || null;
    const disciplines = [...this._career.disciplines];
    try {
      await updatePerson(this.persistence, this.person.id, { levelId, disciplines });
      this.person = { ...this.person, levelId, disciplines };
    } catch (err) {
      this._careerError = err instanceof Error ? err.message : 'No se pudo guardar la carrera.';
    } finally {
      this._careerSaving = false;
    }
  }

  /**
   * Precarga el borrador editable de la valoración con las marcas persistidas.
   * Se llama tras cargar (`_load`) o guardar la valoración de la persona.
   * @returns {void}
   */
  _seedAssessmentDraft() {
    const byDimension = this._assessment?.byDimension ?? {};
    /** @type {Record<string, { meets: boolean, note: string }>} */
    const draft = {};
    for (const [id, mark] of Object.entries(byDimension)) {
      draft[id] = { meets: mark?.meets ?? true, note: String(mark?.note ?? '') };
    }
    this._assessmentDraft = draft;
    this._assessmentError = '';
    this._assessmentSaved = false;
  }

  /**
   * Marca una dimensión como «cumple» (true) o «no llega» (false) en el borrador.
   * @param {string} dimensionId
   * @param {boolean} meets
   * @returns {void}
   */
  _setAssessmentMeets(dimensionId, meets) {
    const prev = this._assessmentDraft[dimensionId] ?? { meets: true, note: '' };
    this._assessmentDraft = { ...this._assessmentDraft, [dimensionId]: { ...prev, meets } };
    this._assessmentSaved = false;
  }

  /**
   * Actualiza la nota de una dimensión en el borrador de valoración.
   * @param {string} dimensionId
   * @param {string} note
   * @returns {void}
   */
  _setAssessmentNote(dimensionId, note) {
    const prev = this._assessmentDraft[dimensionId] ?? { meets: true, note: '' };
    this._assessmentDraft = { ...this._assessmentDraft, [dimensionId]: { ...prev, note } };
    this._assessmentSaved = false;
  }

  /**
   * Guarda la valoración frente al nivel: construye una marca explícita por cada
   * dimensión del nivel (a partir de las filas resueltas) y la persiste con el
   * autor del login. Refresca la valoración y muestra feedback in-place.
   * @returns {Promise<void>}
   */
  async _saveAssessment() {
    this._assessmentError = '';
    this._assessmentSaving = true;
    try {
      const rows = assessmentRows(this.framework, this.person.levelId, { byDimension: this._assessmentDraft });
      /** @type {Record<string, { meets: boolean, note: string }>} */
      const byDimension = {};
      for (const row of rows) {
        byDimension[row.dimension.id] = { meets: row.meets, note: row.note };
      }
      await saveCareerAssessment(this.person.id, byDimension, currentAuthor());
      this._assessment = { byDimension };
      this._seedAssessmentDraft();
      this._assessmentSaved = true;
    } catch (err) {
      this._assessmentError = err instanceof Error ? err.message : 'No se pudo guardar la valoración.';
    } finally {
      this._assessmentSaving = false;
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
        ${SUBTABS.map((t) => {
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

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      const [timeline, areas, conversations, notes, assessment, logbook, labelsCat, guildsCat, usersCat] =
        await Promise.all([
          getPersonTimeline(this.persistence, this.person.id),
          listAreas(this.persistence),
          listConversations(this.persistence, this.person.id),
          listSupportNotes(this.persistence, this.person.id),
          getCareerAssessment(this.person.id),
          // Historial de rutas completadas (F3): best-effort, no debe tumbar la
          // ficha si falla (p. ej. sin permiso o sin bitácora aún).
          getPersonLogbook(this.person.id).catch(() => ({ entries: [] })),
          // Catálogos de la pestaña Datos (RMR-TSK-0173), best-effort.
          listLabels(this.persistence).catch(() => []),
          listGuilds(this.persistence).catch(() => []),
          listUsers().catch(() => []),
        ]);
      this.timeline = timeline;
      this.areas = areas;
      this.conversations = conversations;
      this.notes = notes;
      this._assessment = assessment;
      this._logbook = logbook;
      this._labelsCat = labelsCat;
      this._guildsCat = guildsCat;
      this._usersCat = usersCat;
      this._seedAssessmentDraft();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar la ficha.';
    } finally {
      this.loading = false;
    }
  }

  async _reload() {
    this._loadedFor = null;
    await this._load();
    this._loadedFor = this.person.id;
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
      await this._reload();
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
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la contribución.';
    }
  }

  async _saveConversation() {
    const c = this._conv;
    if (!c.notes.trim()) {
      this.error = 'Escribe las notas de la conversación.';
      return;
    }
    this.error = '';
    try {
      await registerConversation(this.persistence, this.person.id, {
        type: c.type,
        date: c.date || new Date().toISOString(),
        notes: c.notes.trim(),
        createdBy: currentAuthor(),
      });
      this._conv = { type: 'o2o', date: '', notes: '' };
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la conversación.';
    }
  }

  async _saveNote() {
    if (!this._noteText.trim()) return;
    this.error = '';
    try {
      await addSupportNote(this.persistence, this.person.id, this._noteText.trim(), currentAuthor());
      this._noteText = '';
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo guardar la nota.';
    }
  }

  async _deleteNote(id) {
    this._confirmNote = null;
    try {
      await removeSupportNote(this.persistence, this.person.id, id);
      await this._reload();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo borrar la nota.';
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
      await this._reload();
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
                        <th scope="col">Nivel</th>
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
      <ul class="bars" role="img" aria-label="Nivel actual de conocimiento por área">
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
                        <table class="htable">
                          <caption>Histórico por área</caption>
                          <thead>
                            <tr>
                              <th scope="col">Fecha</th>
                              <th scope="col">Área</th>
                              <th scope="col">Nivel</th>
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
                        </table>
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

  _renderConversations() {
    const c = this._conv;
    const typeLabel = (t) => CONVERSATION_TYPES.find((x) => x.value === t)?.label ?? t;
    return html`
      <section>
        <h3>Conversaciones</h3>
        <div class="form">
          <div class="row">
            <label class="fld">Tipo
              <select .value=${c.type} @change=${(e) => { this._conv = { ...this._conv, type: e.target.value }; }}>
                ${CONVERSATION_TYPES.map((t) => html`<option value=${t.value} ?selected=${t.value === c.type}>${t.label}</option>`)}
              </select>
            </label>
            <label class="fld">Fecha
              <input type="date" .value=${c.date} @input=${(e) => { this._conv = { ...this._conv, date: e.target.value }; }} />
            </label>
          </div>
          <label class="fld">Notas
            <textarea
              .value=${c.notes}
              @input=${(e) => { this._conv = { ...this._conv, notes: e.target.value }; }}
              placeholder="Qué se habló, acuerdos, comportamientos observados…"
            ></textarea>
          </label>
          <div class="row">
            <button class="primary" ?disabled=${!c.notes.trim()} @click=${this._saveConversation}>Registrar conversación</button>
          </div>
        </div>
        ${this.conversations.length === 0
          ? html`<p class="empty">Sin conversaciones registradas.</p>`
          : html`
              <ul class="hist">
                ${this.conversations.map(
                  (cv) => html`
                    <li>
                      <span class="when">${authorLine(cv)}</span>
                      <span class="lvl">${typeLabel(cv.type)}</span>
                      <span class="note">${cv.notes}</span>
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>
    `;
  }

  _renderNotes() {
    return html`
      <section class="support">
        <h3>Notas de acompañamiento</h3>
        <p class="disclaimer">
          Espacio sensible y <strong>no diagnóstico</strong>, separado de la dimensión Emocional.
          No tiene nivel y nunca se incluye en exports ni en agregados.
        </p>
        <div class="form">
          <label class="fld">Nueva nota
            <textarea
              .value=${this._noteText}
              @input=${(e) => { this._noteText = e.target.value; }}
              placeholder="Acompañamiento, contexto personal relevante para tu apoyo…"
            ></textarea>
          </label>
          <div class="row">
            <button class="primary" ?disabled=${!this._noteText.trim()} @click=${this._saveNote}>Guardar nota</button>
          </div>
        </div>
        ${this.notes.length === 0
          ? html`<p class="empty">Sin notas.</p>`
          : html`
              <ul class="hist">
                ${this.notes.map(
                  (n) => html`
                    <li>
                      <span class="when">${authorLine(n)}</span>
                      <span class="note">${n.text}</span>
                      <span class="del">
                        ${this._confirmNote === n.id
                          ? html`¿Borrar?
                              <button class="link yes" @click=${() => this._deleteNote(n.id)}>Sí</button>
                              <button class="link" @click=${() => { this._confirmNote = null; }}>No</button>`
                          : html`<button class="link" @click=${() => { this._confirmNote = n.id; }}>Borrar</button>`}
                      </span>
                    </li>
                  `,
                )}
              </ul>
            `}
      </section>
    `;
  }

  /**
   * Sección «Carrera» (F4): solo lectura. Muestra el nivel actual y sus
   * expectativas, el foco por disciplina (addendums) y los niveles a los que
   * aspirar. Se omite si la persona no tiene ni nivel ni disciplinas.
   */
  _renderCareer() {
    const fw = this.framework;
    const disciplineIds = this.person.disciplines ?? [];
    const level = getLevel(fw, this.person.levelId);

    const trackName = (trackId) => (fw?.tracks ?? []).find((t) => t.id === trackId)?.name ?? '';
    const expectations = level ? expectationsForLevel(fw, this.person.levelId) : [];
    const addendums = addendumsForDisciplines(fw, disciplineIds);
    const addendumsByDiscipline = Object.groupBy(addendums, (a) => a.discipline.id);
    const aspirations = level ? aspirationalLevels(fw, this.person.levelId) : [];

    return html`
      <section class="career">
        <h3>Carrera</h3>

        ${this._renderCareerEditor()}

        ${level ? this._renderAssessment(fw, level) : null}

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

        ${this.isAdmin
          ? html`<p class="fw-admin">
              El framework de carrera (niveles, expectativas…) se edita en el
              <a href="/admin#careerFramework">panel de administración</a>.
            </p>`
          : null}
      </section>
    `;
  }

  /**
   * Bloque de valoración de la persona frente a las expectativas de su nivel:
   * una fila por dimensión (verde «cumple» / rojo «no llega») con nota opcional,
   * la lista de puntos de mejora (los rojos) y una sugerencia de rol. Solo se
   * invoca cuando la persona tiene nivel asignado.
   * @param {import('../../tools/career/data/framework.js').CareerFramework|null} fw
   * @param {import('../../tools/career/data/framework.js').Level} level
   * @returns {import('lit').TemplateResult}
   */
  _renderAssessment(fw, level) {
    const rows = assessmentRows(fw, this.person.levelId, { byDimension: this._assessmentDraft });
    const reds = improvementPoints(rows);
    const aspirationalCodes = aspirationalLevels(fw, this.person.levelId).map((l) => l.code);
    const suggestion = careerSuggestion({ reds: reds.length, total: rows.length, aspirationalCodes });
    return html`
      <p class="sub">Valoración frente al nivel <span class="code">${level.code}</span> · ${level.title}</p>
      <ul class="assess">
        ${rows.map((row) => this._renderAssessmentRow(row))}
      </ul>
      ${this._assessmentError ? html`<p class="error">${this._assessmentError}</p>` : null}
      <div class="row">
        <button class="primary" ?disabled=${this._assessmentSaving} @click=${this._saveAssessment}>
          ${this._assessmentSaving ? 'Guardando…' : 'Guardar valoración'}
        </button>
        ${this._assessmentSaved
          ? html`<span class="saved" role="status">Valoración guardada.</span>`
          : null}
      </div>

      ${reds.length > 0
        ? html`
            <p class="sub">Puntos de mejora</p>
            <ul class="improve">
              ${reds.map(
                (row) => html`
                  <li>
                    <span class="dim">${row.dimension.name}</span>${row.text
                      ? html`: <span class="txt">${row.text}</span>`
                      : null}
                    ${row.note ? html`<p class="note">${row.note}</p>` : null}
                  </li>
                `,
              )}
            </ul>
          `
        : null}

      ${suggestion
        ? html`<p class="sub">Sugerencia de rol</p><p class="suggest">${suggestion}</p>`
        : null}
    `;
  }

  /**
   * Fila de valoración de una dimensión: nombre, control segmentado accesible
   * «Cumple / No llega», la expectativa (plegable) y una nota opcional.
   * @param {import('../../tools/career/data/assessment.js').AssessmentRow} row
   * @returns {import('lit').TemplateResult}
   */
  _renderAssessmentRow(row) {
    const dimId = row.dimension.id;
    const draft = this._assessmentDraft[dimId];
    const meets = draft?.meets ?? true;
    const note = draft?.note ?? '';
    return html`
      <li class="assess-row ${meets ? 'ok' : 'bad'}">
        <div class="assess-head">
          <span class="dim">${row.dimension.name}</span>
          <div class="seg" role="group" aria-label=${`Valoración de ${row.dimension.name}`}>
            <button
              type="button"
              class="seg-btn ok ${meets ? 'on' : ''}"
              aria-pressed=${meets ? 'true' : 'false'}
              @click=${() => this._setAssessmentMeets(dimId, true)}
            >Cumple</button>
            <button
              type="button"
              class="seg-btn bad ${meets ? '' : 'on'}"
              aria-pressed=${meets ? 'false' : 'true'}
              @click=${() => this._setAssessmentMeets(dimId, false)}
            >No llega</button>
          </div>
        </div>
        ${row.hasExpectation
          ? html`<details class="exp"><summary>Expectativa</summary><p>${row.text}</p></details>`
          : html`<p class="todo">Expectativa pendiente de definir</p>`}
        <label class="fld note-fld">Nota (opcional)
          <textarea
            rows="2"
            .value=${note}
            @input=${(e) => this._setAssessmentNote(dimId, e.target.value)}
          ></textarea>
        </label>
      </li>
    `;
  }

  /**
   * Editor inline de carrera: nivel (agrupado por track) y disciplinas (checkboxes)
   * de la persona. Es la asignación que hace el líder; la escala y expectativas del
   * framework siguen siendo de solo lectura. Precargado con `person.levelId` y
   * `person.disciplines` y guardado con `updatePerson`.
   * @returns {import('lit').TemplateResult}
   */
  _renderCareerEditor() {
    const fw = this.framework;
    const tracks = fw?.tracks ?? [];
    const levels = fw?.levels ?? [];
    const disciplines = fw?.disciplines ?? [];
    const groups = tracks
      .map((t) => ({ track: t, levels: levels.filter((l) => l.trackId === t.id) }))
      .filter((g) => g.levels.length > 0);
    const selected = this._career;
    return html`
      <div class="career-editor">
        <p class="edit-hint">Asigna el nivel y las disciplinas de esta persona.</p>
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
        <fieldset class="disc">
          <legend>Disciplinas</legend>
          ${disciplines.length === 0
            ? html`<span class="empty">No hay disciplinas en el framework de carrera.</span>`
            : html`<div class="disc-checks">
                ${disciplines.map(
                  (d) => html`
                    <label class="disc-check">
                      <input
                        type="checkbox"
                        .checked=${selected.disciplines.includes(d.id)}
                        @change=${(e) => this._toggleCareerDiscipline(d.id, e.target.checked)}
                      />
                      <span>${d.name}</span>
                    </label>
                  `,
                )}
              </div>`}
        </fieldset>
        ${this._careerError ? html`<p class="error">${this._careerError}</p>` : null}
        <div class="row">
          <button class="primary" ?disabled=${this._careerSaving} @click=${this._saveCareer}>
            ${this._careerSaving ? 'Guardando…' : 'Guardar carrera'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Objetivo de carrera declarado por la propia persona (`careerTargetLevelId`),
   * en SOLO LECTURA para el líder (informativo). Si no hay objetivo, muestra un
   * texto discreto.
   * @param {import('../../tools/career/data/framework.js').CareerFramework|null} fw
   * @returns {import('lit').TemplateResult}
   */
  _renderDeclaredTarget(fw) {
    const target = getLevel(fw, this.person.careerTargetLevelId);
    return html`
      <p class="sub">Objetivo de carrera</p>
      ${target
        ? html`<p class="target-declared">Declarado por la persona: <span class="code">${target.code}</span> · ${target.title}</p>`
        : html`<p class="target-none">Sin objetivo de carrera declarado.</p>`}
    `;
  }

  /**
   * Historial de rutas de carrera COMPLETADAS por la persona (F3, RMR-TSK-0171):
   * de su bitácora (completedRoutes), con el reto, las fechas inicio→fin y el
   * tiempo. Solo lectura; las reglas de Firestore ya permiten al líder dueño leer
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

  /** Meta de una ruta completada para el líder: «Del {inicio} al {fin} · {tiempo}»
   * (o «Completada el {fin}» si no hay inicio registrado).
   * @param {import('../../tools/career/domain/logbook.js').CompletedRoute} r */
  _routeDoneMeta(r) {
    const end = formatAchievedAt(r.completedAt) ?? 'fecha no registrada';
    const start = r.startedAt === null ? null : formatAchievedAt(r.startedAt);
    const dur = r.durationMs === null ? '' : ` · ${formatDuration(r.durationMs)}`;
    return start ? `Del ${start} al ${end}${dur}` : `Completada el ${end}${dur}`;
  }

  // ---- Pestaña «Datos» (identidad de la persona, RMR-TSK-0173) --------------

  /** @param {string} name @param {boolean} checked */
  _toggleDatosGuild(name, checked) {
    const guilds = checked ? [...this._datos.guilds, name] : this._datos.guilds.filter((g) => g !== name);
    this._datos = { ...this._datos, guilds };
  }

  /** @param {string} name @param {boolean} checked */
  _toggleDatosLabel(name, checked) {
    const labels = checked ? [...this._datos.labels, name] : this._datos.labels.filter((l) => l !== name);
    this._datos = { ...this._datos, labels };
  }

  /** Guarda los datos personales (nombre, github, fecha de alta, gremios, labels).
   * No toca uid/pendingEmail (eso es la acción «Invitar», aparte). */
  async _saveDatos() {
    if (!this.persistence || !this.person) return;
    const name = this._datos.name.trim();
    if (!name) {
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
        guilds: [...this._datos.guilds],
        labels: [...this._datos.labels],
        location: this._datos.location.trim() || null,
      };
      // El email SOLO se edita si aún no tiene cuenta (pendingEmail = auto-vínculo
      // al primer login). Si ya tiene cuenta, su email es el de su login (no se toca).
      if (!this.person.uid) {
        patch.pendingEmail = normalizeInviteEmail(this._datos.pendingEmail);
      }
      await updatePerson(this.persistence, this.person.id, patch);
      this.person = { ...this.person, ...patch }; // refleja en la cabecera sin recargar
      this._datosSaved = true;
      this.dispatchEvent(new CustomEvent('person-updated', { detail: { id: this.person.id }, bubbles: true, composed: true }));
    } catch (err) {
      this._datosError = err instanceof Error ? err.message : 'No se pudo guardar.';
    } finally {
      this._datosSaving = false;
    }
  }

  /** Fieldset de checkboxes (gremios/labels) desde su catálogo. */
  _renderDatosChecks(legend, catalog, selected, onToggle) {
    return html`<fieldset class="datos-checks">
      <legend>${legend}</legend>
      ${catalog.length === 0
        ? html`<span class="empty">Aún no hay ${legend.toLowerCase()} (se gestionan en Ajustes).</span>`
        : catalog.map(
            (c) => html`<label class="chk">
              <input type="checkbox" .checked=${selected.includes(c.name)} @change=${(e) => onToggle(c.name, e.target.checked)} />
              <span>${c.name}</span>
            </label>`,
          )}
    </fieldset>`;
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

  /** Pestaña «Datos»: identidad editable de la persona en un ÚNICO sitio. */
  _renderDatos() {
    const d = this._datos;
    return html`
      <section class="datos">
        <label class="fld">Nombre
          <input type="text" .value=${d.name} @input=${(e) => { this._datos = { ...d, name: e.target.value }; }} />
        </label>
        <label class="fld">GitHub (login)
          <input type="text" placeholder="usuario-github" .value=${d.githubLogin} @input=${(e) => { this._datos = { ...d, githubLogin: e.target.value }; }} />
        </label>
        <label class="fld">Fecha de alta
          <input type="date" .value=${d.startDate} @input=${(e) => { this._datos = { ...d, startDate: e.target.value }; }} />
        </label>
        ${this._renderLocationBlock()}
        ${this._renderDatosChecks('Gremios', this._guildsCat, d.guilds, (n, c) => this._toggleDatosGuild(n, c))}
        ${this._renderDatosChecks('Labels', this._labelsCat, d.labels, (n, c) => this._toggleDatosLabel(n, c))}
        ${this._renderEmailBlock()}
        ${this._datosError ? html`<p class="error">${this._datosError}</p>` : null}
        <div class="datos-actions">
          <button class="primary" type="button" ?disabled=${this._datosSaving} @click=${() => this._saveDatos()}>
            ${this._datosSaving ? 'Guardando…' : 'Guardar datos'}
          </button>
          ${this._datosSaved ? html`<span class="saved">✓ Guardado</span>` : null}
        </div>
      </section>
    `;
  }

  render() {
    if (!this.person) return null;
    const title = composeTitle(this.framework, this.person.levelId, this.person.disciplines);
    const disciplineNames = (this.framework?.disciplines ?? [])
      .filter((d) => (this.person.disciplines ?? []).includes(d.id))
      .map((d) => d.name);
    const guilds = this.person.guilds ?? [];
    return html`
      <div class="head">
        <h2>${this.person.name}</h2>
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
        ? html`<p class="empty">Cargando…</p>`
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
  _renderActivePanel() {
    const panel = {
      datos: () => this._renderDatos(),
      carrera: () => this._renderCareer(),
      seniority: () => this._renderDimension(DIMENSIONS[0]),
      emotional: () => this._renderDimension(DIMENSIONS[1]),
      knowledge: () => this._renderKnowledge(),
      contribution: () => this._renderContribution(),
      conversations: () => this._renderConversations(),
      notes: () => this._renderNotes(),
    }[this._subtab] ?? (() => this._renderCareer());
    return panel();
  }
}

if (!customElements.get('team-person-detail')) {
  customElements.define('team-person-detail', TeamPersonDetail);
}
