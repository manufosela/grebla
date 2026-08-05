/**
 * <survey-admin> — panel de administración de Encuestas (RMR-TSK-0325). Para
 * People (superadmin en Fase 1): lista las encuestas, permite crear/editar una
 * (título, preguntas de escala o texto, plantilla eNPS+Q12, umbral de anonimato)
 * y abrirla/cerrarla. El superadmin escribe /surveys directamente (reglas); los
 * tokens y las respuestas siguen siendo exclusivos de las Cloud Functions.
 */
import { LitElement, html, css } from 'lit';
import '../common/busy-overlay.js';
import { skeletonLines } from '../app-skeleton.js';
import './survey-padron.js';
import './survey-flow-canvas.js';
import { climateTemplate, serializeTemplate, parseTemplate, parseQuestionsCsv } from '../../tools/survey/domain/templates.js';
import { surveyDraftErrors, choiceOptions, draftToPayload } from '../../tools/survey/domain/questions.js';
import { defaultEmailTemplate } from '../../tools/survey/domain/email.js';
import { END, flowErrors, ruleOp, ruleValue } from '../../tools/survey/domain/flow.js';
import { parseParticipants, padronToParticipants } from '../../tools/survey/domain/participants.js';
import { listPadron } from '../../lib/padron.js';
import {
  participationByDept, participationTotal, answerValues, textAnswers, scaleResult, segmentedScale, choiceTally,
} from '../../tools/survey/domain/results.js';
import {
  listSurveys, createSurvey, updateSurvey, setSurveyStatus, deleteSurvey, surveyHasResponses, createSurveyTokens, listTokens, listAnswers,
  resetSurveyResponses, updateSurveyParticipant, deleteSurveyParticipant, sendSurveyTestEmail, sendSurveyBulkEmails,
  listSurveyTemplates, saveSurveyTemplate, renameSurveyTemplate, deleteSurveyTemplate,
} from '../../lib/survey.js';

const STATUS_LABEL = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada' };
const QUESTION_KIND = { scale: 'Escala', text: 'Texto', choice: 'Opción única' };
// Operadores por tipo de pregunta: escala compara por orden; opción única, por igualdad.
const OP_TEXT = { eq: '= igual a', neq: '≠ distinto de', gt: '> mayor que', gte: '≥ mayor o igual que', lt: '< menor que', lte: '≤ menor o igual que' };
const OPS_SCALE = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];
const OPS_CHOICE = ['eq', 'neq'];
// Ejes de segmentación de resultados (los que el padrón anonimiza en cada respuesta).
const SEGMENT_FIELDS = ['department', 'tenure', 'location', 'age'];
const SEGMENT_LABELS = { department: 'Departamento', tenure: 'Antigüedad', location: 'Ubicación', age: 'Edad' };
const SEGMENT_MIN = 5; // k-anonimato mínimo por grupo, aunque el umbral de la encuesta sea menor

export class SurveyAdmin extends LitElement {
  static properties = {
    canDelete: { type: Boolean }, // solo superadmin: el glue lo activa
    _phase: { state: true }, // 'list' | 'edit'
    _surveys: { state: true },
    _loading: { state: true },
    _confirmDeleteId: { state: true },
    _deletingId: { state: true },
    _confirmReset: { state: true },
    _resettingId: { state: true },
    _notice: { state: true },
    _segmentField: { state: true },
    _partEdits: { state: true },
    _partConfirmDelete: { state: true },
    _partRowBusy: { state: true },
    _hasResponses: { state: true },
    _renamingId: { state: true },
    _renameTitle: { state: true },
    _renameBusy: { state: true },
    _editId: { state: true },
    _title: { state: true },
    _questions: { state: true },
    _threshold: { state: true },
    _defaultMin: { state: true },
    _defaultMax: { state: true },
    _emailSubject: { state: true },
    _emailBody: { state: true },
    _editTab: { state: true },
    _flowLayout: { state: true },
    _selectedNodeId: { state: true },
    _allExpanded: { state: true },
    _templates: { state: true },
    _showSaveTpl: { state: true },
    _tplName: { state: true },
    _tplBusy: { state: true },
    _tplError: { state: true },
    _renameId: { state: true },
    _saving: { state: true },
    _partSurvey: { state: true },
    _partText: { state: true },
    _partTokens: { state: true },
    _partBusy: { state: true },
    _padron: { state: true },
    _padronDept: { state: true },
    _padronActive: { state: true },
    _padronError: { state: true },
    _testEmail: { state: true },
    _sendBusy: { state: true },
    _testAnswers: { state: true },
    _showTestAnswers: { state: true },
    _sendNotice: { state: true },
    _confirmBulk: { state: true },
    _copiedAll: { state: true },
    _resSurvey: { state: true },
    _resAnswers: { state: true },
    _resTokens: { state: true },
    _resLoading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); color: var(--rm-text, #1e3a5f); }
    h2 { font-size: 1.15rem; margin: 0 0 1rem; }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; margin: 0 0 1rem; }
    button { font: inherit; cursor: pointer; border-radius: 8px; font-weight: 600; }
    .primary { background: var(--teal); border: 1px solid var(--teal); color: var(--rm-on-accent, #fff); padding: 0.5rem 1.1rem; }
    .primary:disabled { opacity: 0.5; cursor: default; }
    .ghost { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); padding: 0.4rem 0.8rem; font-size: 0.82rem; }
    .ghost:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .ghost.danger { color: #b42318; }
    .ghost.danger:hover { border-color: #b42318; color: #b42318; }
    .ghost:disabled { opacity: 0.5; cursor: default; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.55rem 0.5rem; border-bottom: 1px solid var(--rm-border, #eef0f2); }
    th { color: var(--rm-muted, #5b6b7d); font-weight: 600; font-size: 0.78rem; }
    .chip { display: inline-block; font-size: 0.7rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 999px; }
    .chip.draft { background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); }
    .chip.open { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .chip.closed { background: #fdecea; color: #b42318; }
    .row-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .toolbar { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.2rem; align-items: center; }
    .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; }
    .field label { font-size: 0.82rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); }
    input, select { padding: 0.5rem 0.65rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); }
    input:focus, select:focus { outline: none; border-color: var(--teal); background: var(--rm-surface, #fff); }
    input.title { max-width: 34rem; }
    input.num { width: 4.5rem; }
    .q { border: 1px solid var(--rm-border, #eef0f2); border-radius: 10px; padding: 0.7rem 0.8rem; margin-bottom: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .q-top { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .q-top .kind { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--rm-muted, #5b6b7d); }
    .q-label { flex: 1 1 18rem; min-width: 0; }
    .opts-field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); }
    .q-opts { display: flex; gap: 0.9rem; align-items: center; flex-wrap: wrap; font-size: 0.82rem; }
    .flow { border-top: 1px dashed var(--rm-border, #e3ebef); padding-top: 0.55rem; margin-top: 0.2rem; display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.82rem; }
    .flow-line { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; color: var(--rm-muted, #5b6b7d); font-weight: 600; }
    .flow select, .flow input { font-size: 0.82rem; padding: 0.3rem 0.45rem; }
    .rule { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; color: var(--rm-text, #1e3a5f); }
    .flow .ghost { align-self: flex-start; }
    .q-opts label { display: inline-flex; align-items: center; gap: 0.3rem; }
    .q-move button, .q-del { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d); border-radius: 6px; padding: 0.15rem 0.5rem; font-size: 0.8rem; cursor: pointer; }
    .q-del:hover { border-color: #b42318; color: #b42318; }
    button.q-move { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d); border-radius: 6px; padding: 0.15rem 0.45rem; font-size: 0.8rem; cursor: pointer; }
    button.q-move:disabled { opacity: 0.35; cursor: default; }
    .rule-hint { margin: 0.1rem 0 0.2rem; color: var(--rm-muted, #5b6b7d); font-size: 0.76rem; font-style: italic; }
    .add-row { display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 0.6rem 0 1.4rem; }
    .save-row { display: flex; gap: 0.8rem; align-items: center; }
    .error { color: #b42318; font-size: 0.85rem; }
    .muted { color: var(--rm-muted, #6b7280); font-size: 0.85rem; align-self: center; }
    .test-answer { border: 1px dashed var(--rm-border, #cbd5e1); border-radius: 8px; padding: 0.6rem 0.85rem; margin: 0.5rem 0; }
    .test-answer ul { margin: 0.3rem 0 0; padding-left: 1.1rem; font-size: 0.86rem; }
    .test-answer li { margin: 0.15rem 0; }
    .notice { color: var(--rm-accent-700, #1f7a6e); background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 12%, transparent);
      border: 1px solid var(--rm-accent, #2a9d8f); border-radius: 8px; padding: 0.5rem 0.7rem; font-size: 0.85rem; }
    .reset-confirm { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); }
    .rename-btn { border: none; background: transparent; color: var(--rm-muted, #5b6b7d); cursor: pointer; font-size: 0.9rem; padding: 0 0.2rem; opacity: 0.6; }
    .rename-btn:hover { opacity: 1; color: var(--teal, #2a9d8f); }
    .rename-row { display: inline-flex; align-items: center; gap: 0.35rem; }
    .rename-in { font-size: 0.9rem; padding: 0.25rem 0.45rem; min-width: 12rem; }
    .seg-picker { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin: 0.2rem 0 0.9rem; }
    .seg-picker label { display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); }
    .seg-picker select { padding: 0.3rem 0.5rem; }
    .seg-hint { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); font-style: italic; }
    .parts-list { display: flex; flex-direction: column; margin: 0.5rem 0; }
    .part-block { border: 1px solid var(--rm-border, #dde7ec); border-bottom: none; padding: 0.6rem 0.8rem;
      display: flex; flex-direction: column; gap: 0.5rem; }
    .part-block:first-child { border-radius: 10px 10px 0 0; }
    .part-block:last-child { border-bottom: 1px solid var(--rm-border, #dde7ec); border-radius: 0 0 10px 10px; }
    .part-block:nth-child(even) { background: var(--rm-surface-hover, #f2f7f9); }
    .pb-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .pb-email { font-weight: 700; color: var(--rm-text, #1e3a5f); word-break: break-all; }
    .pb-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.5rem; }
    .pb-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.72rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); }
    .pb-field input { font-size: 0.85rem; padding: 0.3rem 0.45rem; }
    .pb-foot { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .pb-link { flex: 1 1 16rem; font-size: 0.8rem; padding: 0.3rem 0.45rem; font-family: ui-monospace, monospace; }
    .notice { color: var(--rm-accent-700, #1f7a6e); font-size: 0.85rem; font-weight: 600; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; padding: 0.5rem 0; }
    textarea { width: 100%; box-sizing: border-box; padding: 0.55rem 0.7rem; font: inherit; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #1e3a5f); resize: vertical; }
    textarea:focus { outline: none; border-color: var(--teal); background: var(--rm-surface, #fff); }
    code { background: var(--rm-surface-hover, #eef3f5); padding: 0.05rem 0.3rem; border-radius: 4px; font-size: 0.85em; }
    input.link { width: 100%; box-sizing: border-box; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); }
    h3 { font-size: 1rem; margin: 1.4rem 0 0.6rem; color: var(--rm-text, #1e3a5f); }
    .qr { border: 1px solid var(--rm-border, #eef0f2); border-radius: 10px; padding: 0.7rem 0.85rem; margin-bottom: 0.6rem; }
    .qr-label { margin: 0 0 0.35rem; font-weight: 600; color: var(--rm-text, #1e3a5f); }
    .qr-summary { margin: 0 0 0.4rem; font-size: 0.9rem; color: var(--rm-text, #1e3a5f); }
    .dist, .seg { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.3rem; }
    .dchip { font-size: 0.78rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 6px; background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); }
    .schip { font-size: 0.78rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; background: color-mix(in srgb, var(--teal) 14%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .hidden-note { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); font-style: italic; margin: 0.4rem 0 0; }
    .texts { margin: 0.2rem 0 0; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: var(--rm-text, #1e3a5f); }
    /* Editor: pestañas */
    .tabs { display: inline-flex; gap: 0.25rem; padding: 0.28rem; background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; margin: 0.6rem 0 1.1rem; }
    .tab { background: none; border: 0; padding: 0.5rem 1.15rem; font-weight: 600; font-size: 0.9rem; color: var(--rm-muted, #5b6b7d); cursor: pointer; border-radius: 9px; transition: background 0.12s, color 0.12s, box-shadow 0.12s; }
    .tab:hover { color: var(--teal); }
    .tab.on { background: var(--teal); color: var(--rm-on-accent, #fff); box-shadow: 0 1px 4px rgba(42,157,143,0.4); }
    .tab-body { min-height: 180px; }
    .settings { display: flex; gap: 1.4rem; flex-wrap: wrap; margin-bottom: 1rem; padding: 0.8rem 1rem; background: var(--rm-surface-hover, #f6f9fa); border: 1px solid var(--rm-border, #e6eef1); border-radius: 10px; }
    .settings .field { margin-bottom: 0; }
    .q-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin: 0.4rem 0 0.7rem; }
    .q-head h3 { margin: 0; }
    .count-pill { display: inline-block; font-size: 0.72rem; font-weight: 700; background: var(--teal); color: var(--rm-on-accent, #fff); border-radius: 999px; padding: 0.05rem 0.5rem; }
    .linkbtn { background: none; border: 0; color: var(--teal); font-weight: 600; font-size: 0.82rem; cursor: pointer; padding: 0.2rem 0.3rem; }
    .linkbtn:hover { text-decoration: underline; }
    /* Preguntas colapsables */
    .q-details { padding: 0; display: block; overflow: hidden; box-shadow: 0 1px 3px rgba(20,50,80,0.06); }
    .q-summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 0.55rem; padding: 0.55rem 0.75rem; }
    .q-summary::-webkit-details-marker { display: none; }
    .q-summary::before { content: '▸'; color: var(--rm-muted, #90a4b0); transition: transform 0.15s; }
    .q-details[open] > .q-summary::before { transform: rotate(90deg); }
    .q-details[open] > .q-summary { border-bottom: 1px solid var(--rm-border, #eef0f2); }
    .q-details > .q-top, .q-details > .q-opts, .q-details > .opts-field, .q-details > .flow { margin: 0.5rem 0.75rem; }
    .q-sumlabel { flex: 1; min-width: 0; color: var(--rm-text, #1e3a5f); font-size: 0.9rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .q-summary .kind { padding: 0.12rem 0.45rem; border-radius: 6px; background: var(--rm-surface-hover, #eef3f5); }
    .q-summary .kind.choice { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .q-summary .kind.scale { background: #e5eefa; color: #2b5f9e; }
    /* Grupos de botones diferenciados */
    .btn-group { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin: 0.7rem 0; padding: 0.5rem 0.7rem; border-radius: 10px; }
    .btn-group .group-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--rm-muted, #5b6b7d); margin-right: 0.15rem; }
    .add-group { background: color-mix(in srgb, var(--teal) 8%, transparent); border: 1px solid color-mix(in srgb, var(--teal) 22%, transparent); }
    .io-group { background: var(--rm-surface-hover, #f2f5f7); border: 1px dashed var(--rm-border, #cfdae1); }
    .addbtn { border: 1px solid var(--teal); background: var(--rm-surface, #fff); color: var(--rm-accent-700, var(--teal)); padding: 0.4rem 0.85rem; border-radius: 8px; font-weight: 700; font-size: 0.82rem; cursor: pointer; box-shadow: 0 1px 2px rgba(42,157,143,0.18); }
    .addbtn:hover { background: var(--teal); color: var(--rm-on-accent, #fff); }
    .ghost.file { cursor: pointer; }
    .save-bar { position: sticky; bottom: 0; background: var(--rm-surface, #fff); padding: 0.8rem 0; margin-top: 1rem; border-top: 1px solid var(--rm-border, #eef0f2); display: flex; }
    /* Biblioteca de plantillas */
    .tpl-picker { padding: 0.9rem 1rem; background: var(--rm-surface-hover, #f6f9fa); border: 1px dashed var(--rm-border, #cfdae1); border-radius: 10px; margin-bottom: 0.8rem; }
    .tpl-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .tpl-item { display: inline-flex; align-items: center; gap: 0.15rem; }
    .tpl { border: 1px solid var(--teal); background: var(--rm-surface, #fff); color: var(--rm-accent-700, var(--teal)); padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 600; font-size: 0.82rem; cursor: pointer; }
    .tpl:hover { background: var(--teal); color: var(--rm-on-accent, #fff); }
    .tpl-tag { font-size: 0.66rem; opacity: 0.7; text-transform: uppercase; }
    .act { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d); border-radius: 6px; padding: 0.2rem 0.45rem; font-size: 0.78rem; cursor: pointer; }
    .act.danger:hover { border-color: #b42318; color: #b42318; }
    .save-tpl { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin: 0.6rem 0; padding: 0.6rem 0.8rem; background: color-mix(in srgb, var(--teal) 7%, transparent); border: 1px solid color-mix(in srgb, var(--teal) 20%, transparent); border-radius: 10px; }
    .save-tpl input { flex: 1 1 14rem; }
    /* Pestaña de flujo: lienzo + panel lateral */
    .flow-wrap { display: flex; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    .flow-canvas { flex: 1 1 56%; min-width: 0; max-height: 72vh; overflow: auto; }
    .flow-panel { flex: 1 1 250px; min-width: 240px; max-width: 360px; border: 1px solid var(--rm-border, #dde7ec); border-radius: 12px; padding: 0.7rem 0.8rem; background: var(--rm-surface, #fff); box-shadow: 0 1px 4px rgba(20,50,80,0.07); }
    .fp-title { margin: 0; font-size: 0.82rem; font-weight: 700; color: var(--rm-muted, #5b6b7d); }
    .fp-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.6rem; }
    .fp-close { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-muted, #5b6b7d); border-radius: 6px; padding: 0.1rem 0.45rem; font-size: 0.85rem; cursor: pointer; }
    .fp-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.8rem; padding-top: 0.7rem; border-top: 1px solid var(--rm-border, #e3ebef); }
    .flow-label { margin: 0 0 0.15rem; font-size: 0.78rem; font-weight: 700; color: var(--rm-muted, #5b6b7d); }
  `;

  constructor() {
    super();
    this.canDelete = false;
    this._phase = 'list';
    this._surveys = [];
    this._loading = false;
    this._confirmDeleteId = null;
    this._deletingId = null;
    this._confirmReset = null;
    this._resettingId = null;
    this._notice = '';
    this._segmentField = 'department';
    this._partEdits = {};
    this._partConfirmDelete = null;
    this._partRowBusy = null;
    this._hasResponses = {};
    this._renamingId = null;
    this._renameTitle = '';
    this._renameBusy = false;
    this._editId = null;
    this._title = '';
    this._questions = [];
    this._threshold = 5;
    this._defaultMin = 1;
    this._defaultMax = 5;
    this._emailSubject = '';
    this._emailBody = '';
    this._editTab = 'questions';
    this._flowLayout = {};
    this._selectedNodeId = null;
    this._allExpanded = false;
    this._templates = [];
    this._showSaveTpl = false;
    this._tplName = '';
    this._tplBusy = false;
    this._tplError = '';
    this._renameId = null;
    this._saving = false;
    this._partSurvey = null;
    this._partText = '';
    this._partTokens = [];
    this._partBusy = false;
    this._padron = [];
    this._padronDept = '';
    this._padronActive = true;
    this._padronError = '';
    this._testEmail = '';
    this._sendBusy = false;
    /** Respuestas de PRUEBA (visor 🧪, RMR-TSK-0425): null = sin cargar. */
    this._testAnswers = null;
    this._showTestAnswers = false;
    this._sendNotice = '';
    this._confirmBulk = false;
    this._copiedAll = false;
    this._resSurvey = null;
    this._resAnswers = [];
    this._resTokens = [];
    this._resLoading = false;
    this._error = '';
    this._loaded = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this._loaded) { this._loaded = true; this._loadList(); this._loadTemplatesLib(); }
  }

  async _loadList() {
    this._loading = true;
    this._error = '';
    try {
      this._surveys = await listSurveys();
      // Solo el superadmin borra: cargar si cada encuesta tiene respuestas (para
      // deshabilitar el borrado de las que ya tienen datos) únicamente si puede.
      if (this.canDelete && this._surveys.length) {
        const flags = await Promise.all(this._surveys.map((s) => surveyHasResponses(s.id)));
        this._hasResponses = Object.fromEntries(this._surveys.map((s, i) => [s.id, flags[i]]));
      }
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las encuestas.';
    } finally {
      this._loading = false;
    }
  }

  _new() {
    this._editId = null;
    this._title = '';
    this._questions = [];
    this._threshold = 5;
    this._defaultMin = 1;
    this._defaultMax = 5;
    const tpl = defaultEmailTemplate();
    this._emailSubject = tpl.subject;
    this._emailBody = tpl.body;
    this._flowLayout = {};
    this._editTab = 'questions';
    this._error = '';
    this._phase = 'edit';
  }

  _edit(survey) {
    this._editId = survey.id;
    this._title = survey.title ?? '';
    this._questions = (survey.questions ?? []).map((q) => ({ ...q }));
    this._threshold = Number.isInteger(survey.threshold) ? survey.threshold : 5;
    this._defaultMin = Number.isInteger(survey.defaultScale?.min) ? survey.defaultScale.min : 1;
    this._defaultMax = Number.isInteger(survey.defaultScale?.max) ? survey.defaultScale.max : 5;
    const tpl = defaultEmailTemplate();
    this._emailSubject = survey.email?.subject ?? tpl.subject;
    this._emailBody = survey.email?.body ?? tpl.body;
    this._flowLayout = survey.layout ?? {};
    this._editTab = 'questions';
    this._error = '';
    this._phase = 'edit';
  }

  _loadTemplate() { this._questions = climateTemplate(); }

  async _loadTemplatesLib() {
    try {
      this._templates = await listSurveyTemplates();
      this._tplError = '';
    } catch (err) {
      this._tplError = err instanceof Error ? err.message : 'No se pudieron cargar las plantillas.';
    }
  }

  /** Carga las preguntas de una plantilla en el editor (con ids nuevos). */
  _useTemplate(questions) {
    this._questions = (questions ?? []).map((q) => ({ ...q, id: crypto.randomUUID() }));
    this._flowLayout = {};
  }

  _askSaveTpl() { this._showSaveTpl = true; this._renameId = null; this._tplName = ''; this._tplError = ''; }
  _askRenameTpl(t) { this._showSaveTpl = true; this._renameId = t.id; this._tplName = t.name ?? ''; this._tplError = ''; }
  _cancelSaveTpl() { this._showSaveTpl = false; this._renameId = null; }

  /** Guarda una plantilla nueva o renombra una existente (según _renameId). */
  async _saveTpl() {
    const name = String(this._tplName ?? '').trim();
    if (!name) { this._tplError = 'Ponle un nombre a la plantilla.'; return; }
    this._tplBusy = true; this._tplError = '';
    try {
      if (this._renameId) await renameSurveyTemplate(this._renameId, name);
      else await saveSurveyTemplate(name, this._questions.map((q) => this._normalizeQuestion(q)));
      this._showSaveTpl = false; this._renameId = null;
      await this._loadTemplatesLib();
    } catch (err) {
      this._tplError = err instanceof Error ? err.message : 'No se pudo guardar la plantilla.';
    } finally {
      this._tplBusy = false;
    }
  }

  async _deleteTpl(t) {
    try {
      await deleteSurveyTemplate(t.id);
      await this._loadTemplatesLib();
    } catch (err) {
      this._tplError = err instanceof Error ? err.message : 'No se pudo borrar la plantilla.';
    }
  }

  /** Importa una plantilla JSON al editor, generando ids a las que no lo traigan. */
  async _onTemplateFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reimportar el mismo archivo
    if (!file) return;
    try {
      const { title, questions } = parseTemplate(await file.text());
      this._questions = questions.map((q) => (q.id ? q : { ...q, id: crypto.randomUUID() }));
      if (title && !this._title.trim()) this._title = title;
      this._error = '';
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo importar la plantilla.';
    }
  }

  /** Descarga las preguntas actuales como plantilla JSON (Blob, sin document.write). */
  _exportTemplate() {
    const json = serializeTemplate({ title: this._title, questions: this._questions });
    const slug = (this._title || 'plantilla').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'plantilla'}-encuesta.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Importa preguntas simples desde un CSV (usa la escala por defecto de la encuesta). */
  async _onQuestionsCsv(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const questions = parseQuestionsCsv(await file.text(), { min: this._defaultMin, max: this._defaultMax });
      this._questions = questions.map((q) => ({ ...q, id: crypto.randomUUID() }));
      this._error = '';
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo importar el CSV.';
    }
  }

  _addQuestion(type) {
    const base = { id: crypto.randomUUID(), label: '' };
    let q;
    if (type === 'text') q = { ...base, type: 'text', required: false };
    else if (type === 'choice') q = { ...base, type: 'choice', required: true, options: [] };
    else q = { ...base, type: 'scale', min: this._defaultMin, max: this._defaultMax, required: true };
    this._questions = [...this._questions, q];
  }

  _setTab(tab) { this._editTab = tab; }
  _onLayoutChange(e) { this._flowLayout = { ...e.detail }; }
  _onNodeSelect(e) { this._selectedNodeId = e.detail.id; }
  /** Cierra la edición del nodo actual (vuelve al lienzo sin nodo abierto). */
  _closeNode() { this._selectedNodeId = null; }

  /** Abre o cierra todas las preguntas (manipula los <details> directamente). */
  _setAllQ(open) {
    this._allExpanded = open;
    this.updateComplete.then(() => {
      this.shadowRoot?.querySelectorAll('details.q-details').forEach((d) => { d.open = open; });
    });
  }

  _patchQuestion(index, patch) {
    this._questions = this._questions.map((q, i) => (i === index ? { ...q, ...patch } : q));
  }

  _removeQuestion(index) {
    this._questions = this._questions.filter((_, i) => i !== index);
  }

  _moveQuestion(index, dir) {
    const to = index + dir;
    if (to < 0 || to >= this._questions.length) return;
    const next = [...this._questions];
    [next[index], next[to]] = [next[to], next[index]];
    this._questions = next;
  }

  /** Normaliza una pregunta para persistir: opciones limpias, sin `next` vacío ni reglas sin destino. */
  _normalizeQuestion(q) {
    const out = { ...q };
    if (out.type === 'choice') out.options = choiceOptions(out);
    if (!out.next) delete out.next;
    const rules = (Array.isArray(out.rules) ? out.rules : []).filter((r) => r && r.goto);
    if (rules.length) out.rules = rules;
    else delete out.rules;
    return out;
  }

  _setNext(i, value) { this._patchQuestion(i, { next: value }); }

  _addRule(i) {
    const q = this._questions[i];
    const rule = q.type === 'choice'
      ? { op: 'eq', value: choiceOptions(q)[0] ?? '', goto: '' }
      : { op: 'gte', value: q.min ?? 1, goto: '' };
    this._patchQuestion(i, { rules: [...(q.rules ?? []), rule] });
  }

  _setRule(i, j, patch) {
    const rules = (this._questions[i].rules ?? []).map((r, k) => (k === j ? { ...r, ...patch } : r));
    this._patchQuestion(i, { rules });
  }

  _removeRule(i, j) {
    this._patchQuestion(i, { rules: (this._questions[i].rules ?? []).filter((_, k) => k !== j) });
  }

  /** Reordena una regla (el orden importa: gana la primera cuya condición se cumple). */
  _moveRule(i, j, dir) {
    const rules = [...(this._questions[i].rules ?? [])];
    const k = j + dir;
    if (k < 0 || k >= rules.length) return;
    [rules[j], rules[k]] = [rules[k], rules[j]];
    this._patchQuestion(i, { rules });
  }

  async _save() {
    const title = this._title.trim();
    // Normaliza antes de validar/persistir: limpia opciones de choice, quita el
    // `next` vacío («siguiente en orden») y las reglas sin destino.
    const questions = this._questions.map((q) => this._normalizeQuestion(q));
    const defaultScale = { min: this._defaultMin, max: this._defaultMax };
    if (!Number.isInteger(defaultScale.min) || !Number.isInteger(defaultScale.max) || defaultScale.min < 0 || defaultScale.min >= defaultScale.max) {
      this._error = 'La escala por defecto no es válida (min entero ≥ 0 y menor que max).';
      return;
    }
    const errors = [...surveyDraftErrors({ title, questions, threshold: this._threshold }), ...flowErrors(questions)];
    if (errors.length) { this._error = errors[0]; return; }
    this._saving = true;
    this._error = '';
    try {
      // Mismo payload (con defaultScale y plantilla de correo) para alta y edición.
      const payload = draftToPayload({
        title, questions, threshold: this._threshold, defaultScale,
        email: { subject: this._emailSubject, body: this._emailBody },
        layout: this._flowLayout,
      });
      if (this._editId) await updateSurvey(this._editId, payload);
      else await createSurvey(payload);
      await this._loadList();
      this._phase = 'list';
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar.';
    } finally {
      this._saving = false;
    }
  }

  async _setStatus(survey, status) {
    try {
      await setSurveyStatus(survey.id, status);
      await this._loadList();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cambiar el estado.';
    }
  }

  _askDelete(survey) { this._confirmDeleteId = survey.id; this._error = ''; }
  _cancelDelete() { this._confirmDeleteId = null; }

  _askReset(survey) { this._confirmReset = survey.id; this._error = ''; this._notice = ''; }
  _cancelReset() { this._confirmReset = null; }

  /** Borra respuestas (todas o solo las de prueba) y deja los enlaces reutilizables. */
  async _doReset(survey, onlyTest) {
    this._resettingId = survey.id;
    this._error = '';
    try {
      const res = await resetSurveyResponses(survey.id, onlyTest);
      this._confirmReset = null;
      this._notice = onlyTest
        ? `Borradas ${res.cleared} respuestas de prueba. Esos enlaces vuelven a estar disponibles.`
        : `Reiniciada: ${res.cleared} respuestas borradas. Los ${res.tokensReset} enlaces vuelven a estar disponibles.`;
    } catch (err) {
      this._error = `No se pudo reiniciar: ${err?.message ?? err}`;
    } finally {
      this._resettingId = null;
    }
  }

  /** Borra la encuesta y sus datos (CF, solo superadmin). Tras confirmación inline. */
  async _deleteSurvey(survey) {
    this._deletingId = survey.id;
    this._error = '';
    try {
      await deleteSurvey(survey.id);
      this._confirmDeleteId = null;
      await this._loadList();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar la encuesta.';
    } finally {
      this._deletingId = null;
    }
  }

  async _openParticipants(survey) {
    this._partSurvey = survey;
    this._partText = '';
    this._partTokens = [];
    // El visor 🧪 se resetea al cambiar de encuesta: la caché era de la anterior.
    this._testAnswers = null;
    this._showTestAnswers = false;
    this._padron = [];
    this._padronDept = '';
    this._padronActive = true;
    this._error = '';
    this._padronError = '';
    this._phase = 'participants';
    // Cargas independientes: un fallo del padrón NO debe ocultarse como «vacío»
    // ni impedir ver los tokens ya generados.
    try {
      this._partTokens = (await listTokens(survey.id)).filter((t) => t.test !== true);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los participantes.';
    }
    try {
      this._padron = await listPadron();
    } catch (err) {
      this._padronError = err instanceof Error ? err.message : 'No se pudo cargar el padrón.';
    }
  }

  /** Departamentos únicos presentes en el padrón, para el filtro. */
  get _padronDepartments() {
    return [...new Set(this._padron.map((p) => p.department).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  /** Personas del padrón que recibirían enlace con el filtro actual. */
  get _padronSelection() {
    return padronToParticipants(this._padron, { department: this._padronDept || null, onlyActive: this._padronActive });
  }

  /** Lee un CSV subido y vuelca su contenido al área de texto para revisar. */
  async _onCsvFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a subir el mismo fichero
    if (!file) return;
    try {
      this._partText = await file.text();
      this._error = '';
    } catch {
      this._error = 'No se pudo leer el fichero.';
    }
  }

  /** Crea los tokens de una lista de participantes y recarga la tabla. */
  async _createTokens(participants) {
    if (!participants.length) { this._error = 'No hay ningún participante válido.'; return; }
    this._partBusy = true;
    this._error = '';
    try {
      await createSurveyTokens(this._partSurvey.id, participants);
      this._partTokens = (await listTokens(this._partSurvey.id)).filter((t) => t.test !== true);
      this._partText = '';
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron generar los enlaces.';
    } finally {
      this._partBusy = false;
    }
  }

  _generate() {
    const participants = parseParticipants(this._partText);
    if (!participants.length) { this._error = 'Pega o sube al menos un email válido.'; return; }
    return this._createTokens(participants);
  }

  _sendMsg(err) { return err instanceof Error ? err.message : 'No se pudo enviar el correo.'; }

  /** Envía un correo de prueba (enlace que no cuenta) al email indicado. */
  async _sendTest() {
    const to = String(this._testEmail ?? '').trim();
    if (!to.includes('@')) { this._error = 'Escribe un email de prueba válido.'; return; }
    this._sendBusy = true; this._error = ''; this._sendNotice = '';
    try {
      const res = await sendSurveyTestEmail(this._partSurvey.id, to);
      this._sendNotice = `Correo de prueba enviado a ${to}. Su respuesta no contará en los resultados.${
        res?.surveyOpen === false
          ? ' La encuesta sigue en borrador: el enlace no se podrá responder hasta que la abras.'
          : ''
      }`;
    } catch (err) {
      this._error = this._sendMsg(err);
    } finally {
      this._sendBusy = false;
    }
  }

  /** Visor 🧪: carga perezosa de las respuestas de prueba (excluidas SIEMPRE de los resultados). */
  async _toggleTestAnswers() {
    this._showTestAnswers = !this._showTestAnswers;
    if (!this._showTestAnswers || this._testAnswers !== null) return;
    try {
      const answers = await listAnswers(this._partSurvey.id);
      this._testAnswers = answers.filter((a) => a.test === true);
    } catch (err) {
      console.error('[encuestas] no se pudieron cargar las respuestas de prueba:', err);
      this._error = 'No se pudieron cargar las respuestas de prueba.';
      this._showTestAnswers = false;
    }
  }

  /** Valor de una respuesta formateado para el visor de pruebas. */
  _fmtAnswer(value) {
    if (Array.isArray(value)) return value.join(', ');
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }

  _renderTestAnswers() {
    const questions = this._partSurvey?.questions ?? [];
    const labelOf = (id) => questions.find((q) => q.id === id)?.label ?? id;
    return html`
      <div class="save-row">
        <button class="ghost" @click=${() => this._toggleTestAnswers()}>
          🧪 ${this._showTestAnswers ? 'Ocultar' : 'Ver'} respuestas de prueba${this._testAnswers ? ` (${this._testAnswers.length})` : ''}
        </button>
      </div>
      ${this._showTestAnswers && this._testAnswers
        ? this._testAnswers.length === 0
          ? html`<p class="muted">No hay respuestas de prueba todavía.</p>`
          : this._testAnswers.map(
              (a) => html`<div class="test-answer">
                <p class="muted">Prueba · ${a.updatedAt ? new Date(a.updatedAt).toLocaleString('es-ES') : 'sin fecha'} — no cuenta en los resultados</p>
                <ul>
                  ${Object.entries(a.answers ?? {}).map(
                    ([qid, value]) => html`<li><strong>${labelOf(qid)}:</strong> ${this._fmtAnswer(value)}</li>`,
                  )}
                </ul>
              </div>`,
            )
        : null}`;
  }

  _askBulk() { this._confirmBulk = true; this._error = ''; this._sendNotice = ''; }
  _cancelBulk() { this._confirmBulk = false; }

  /** Envío masivo a todos los participantes (tras confirmación inline). */
  async _sendBulk() {
    this._sendBusy = true; this._error = ''; this._sendNotice = '';
    try {
      const { sent, failed } = await sendSurveyBulkEmails(this._partSurvey.id);
      this._confirmBulk = false;
      this._sendNotice = `Enviados ${sent} correo${sent === 1 ? '' : 's'}${failed ? `, ${failed} fallido${failed === 1 ? '' : 's'}` : ''}.`;
    } catch (err) {
      this._error = this._sendMsg(err);
    } finally {
      this._sendBusy = false;
    }
  }

  _generateFromPadron() {
    const participants = this._padronSelection;
    if (!participants.length) { this._error = 'El padrón no tiene a nadie con ese filtro.'; return; }
    return this._createTokens(participants);
  }

  _linkFor(token) {
    return `${location.origin}/encuesta?s=${this._partSurvey.id}&t=${token}`;
  }

  async _copyAll() {
    const lines = this._partTokens.map((t) => `${t.email},${this._linkFor(t.token)}`).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      this._copiedAll = true;
      setTimeout(() => { this._copiedAll = false; }, 2000);
    } catch {
      this._error = 'No se pudo copiar; selecciona el texto de la tabla a mano.';
    }
  }

  async _openResults(survey) {
    this._resSurvey = survey;
    this._resAnswers = [];
    this._resTokens = [];
    this._resLoading = true;
    this._error = '';
    this._phase = 'results';
    try {
      const [answers, tokens] = await Promise.all([listAnswers(survey.id), listTokens(survey.id)]);
      // Los enlaces y respuestas de PRUEBA no cuentan en los agregados ni en la participación.
      this._resAnswers = answers.filter((a) => a.test !== true);
      this._resTokens = tokens.filter((t) => t.test !== true);
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar los resultados.';
    } finally {
      this._resLoading = false;
    }
  }

  _renderQuestionResult(q, answers, threshold) {
    if (q.type === 'choice') {
      // k-anonimato POR OPCIÓN: se ocultan las opciones con menos de `threshold`
      // respuestas y, si hay alguna oculta, no se muestra el total (evita inferir
      // su conteo por resta).
      const { visible, suppressed, total } = choiceTally(answers, q, threshold);
      if (!visible.length) {
        return html`<div class="qr">
          <p class="qr-label">${q.label}</p>
          <p class="hidden-note">Aún no hay suficientes respuestas por opción (mínimo ${threshold}) para mostrar la distribución sin comprometer el anonimato.</p>
        </div>`;
      }
      return html`<div class="qr">
        <p class="qr-label">${q.label}</p>
        ${suppressed.length ? null : html`<p class="qr-summary">n=${total}</p>`}
        <div class="dist">${visible.map((c) => html`<span class="dchip">${c.key}: ${c.count}</span>`)}</div>
        ${suppressed.length ? html`<p class="hidden-note">${suppressed.length} opción${suppressed.length === 1 ? '' : 'es'} con muy pocas respuestas se ocultan por privacidad.</p>` : null}
      </div>`;
    }
    if (q.type === 'text') {
      const texts = textAnswers(answers, q.id);
      // Los textos verbatim pueden identificar a alguien: se ocultan hasta
      // alcanzar el umbral de anonimato (como los segmentos numéricos).
      if (texts.length < threshold) {
        return html`<div class="qr">
          <p class="qr-label">${q.label}</p>
          <p class="hidden-note">${texts.length} respuesta${texts.length === 1 ? '' : 's'} de texto: se ocultan hasta llegar a ${threshold} para no comprometer el anonimato.</p>
        </div>`;
      }
      return html`<div class="qr">
        <p class="qr-label">${q.label}</p>
        <ul class="texts">${texts.map((t) => html`<li>${t}</li>`)}</ul>
      </div>`;
    }
    const r = scaleResult(q, answerValues(answers, q.id));
    const segMin = Math.max(SEGMENT_MIN, threshold);
    const seg = segmentedScale(answers, q, this._segmentField, segMin);
    return html`<div class="qr">
      <p class="qr-label">${q.label}</p>
      <p class="qr-summary">
        ${r.enps !== null ? html`<strong>eNPS ${r.enps}</strong> · ` : null}
        ${r.n ? html`media ${r.average.toFixed(1)} · n=${r.n}` : 'sin respuestas'}
      </p>
      ${r.distribution.length ? html`<div class="dist">${r.distribution.map((d) => html`<span class="dchip">${d.value}: ${d.count}</span>`)}</div>` : null}
      ${seg.visible.length ? html`<div class="seg">${seg.visible.map((s) => html`<span class="schip">${s.key}: ${s.enps !== null ? `eNPS ${s.enps}` : `media ${s.average.toFixed(1)}`} (n=${s.count})</span>`)}</div>` : null}
      ${seg.suppressed.length ? html`<p class="hidden-note">${seg.suppressed.length} grupo${seg.suppressed.length === 1 ? '' : 's'} oculto${seg.suppressed.length === 1 ? '' : 's'} por privacidad (menos de ${segMin} respuestas).</p>` : null}
    </div>`;
  }

  _renderResults() {
    if (this._resLoading) return skeletonLines(5);
    const survey = this._resSurvey;
    const threshold = Number.isInteger(survey.threshold) ? survey.threshold : 5;
    const part = participationTotal(this._resTokens);
    const byDept = participationByDept(this._resTokens);
    return html`
      <div class="toolbar"><button class="ghost" @click=${() => { this._phase = 'list'; }}>← Volver</button></div>
      <h2>${survey.title} · Resultados</h2>
      <p class="lead">${this._resAnswers.length} respuesta${this._resAnswers.length === 1 ? '' : 's'} · participación ${part.responded}/${part.total} (${part.pct}%). Umbral de anonimato: ${threshold}.</p>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      <h3>Participación por departamento</h3>
      ${byDept.length ? html`<table>
        <thead><tr><th>Departamento</th><th>Respondidos</th><th>%</th></tr></thead>
        <tbody>${byDept.map((d) => html`<tr><td>${d.department}</td><td>${d.responded}/${d.total}</td><td>${d.pct}%</td></tr>`)}</tbody>
      </table>` : html`<p class="empty">Aún no hay participantes cargados.</p>`}
      <h3>Resultados por pregunta</h3>
      <div class="seg-picker">
        <label>Agrupar por:
          <select @change=${(e) => { this._segmentField = e.target.value; }}>
            ${SEGMENT_FIELDS.map((f) => html`<option value=${f} ?selected=${this._segmentField === f}>${SEGMENT_LABELS[f]}</option>`)}
          </select>
        </label>
        <span class="seg-hint">Cada grupo con menos de ${Math.max(SEGMENT_MIN, threshold)} respuestas se oculta.</span>
      </div>
      ${this._resAnswers.length
        ? (survey.questions ?? []).map((q) => this._renderQuestionResult(q, this._resAnswers, threshold))
        : html`<p class="empty">Aún no hay respuestas.</p>`}`;
  }

  _startRename(s) { this._renamingId = s.id; this._renameTitle = s.title ?? ''; this._error = ''; }
  _cancelRename() { this._renamingId = null; }

  /** Renombra la encuesta: solo el campo `title` (no toca id, enlaces ni respuestas). */
  async _saveRename(s) {
    const title = this._renameTitle.trim();
    if (!title) { this._error = 'El nombre no puede estar vacío.'; return; }
    this._renameBusy = true; this._error = '';
    try {
      await updateSurvey(s.id, { title });
      this._renamingId = null;
      await this._loadList();
    } catch (err) {
      this._error = `No se pudo renombrar: ${err?.message ?? err}`;
    } finally {
      this._renameBusy = false;
    }
  }

  /** Botón de borrar. Deshabilitado si la encuesta tiene respuestas (reiniciar primero). */
  _renderDeleteAction(s) {
    if (this._hasResponses[s.id]) {
      return html`<button class="ghost danger" disabled title="Tiene respuestas: reiníciala antes de borrarla">Borrar</button>`;
    }
    if (this._confirmDeleteId !== s.id) {
      return html`<button class="ghost danger" @click=${() => this._askDelete(s)}>Borrar</button>`;
    }
    const busy = this._deletingId === s.id;
    return html`<button class="ghost danger" ?disabled=${busy} @click=${() => this._deleteSurvey(s)}>${busy ? 'Borrando…' : '¿Confirmar?'}</button>
      <button class="ghost" ?disabled=${busy} @click=${() => this._cancelDelete()}>Cancelar</button>`;
  }

  /** Acción de reinicio: botón, o confirmación inline con «Todas» / «Solo prueba». */
  _renderResetAction(s) {
    if (s.status === 'draft') return null; // en borrador no hay respuestas
    if (this._confirmReset !== s.id) {
      return html`<button class="ghost" title="Borra respuestas y reutiliza los enlaces" @click=${() => this._askReset(s)}>Reiniciar</button>`;
    }
    const busy = this._resettingId === s.id;
    return html`<span class="reset-confirm">¿Borrar respuestas?
      <button class="ghost danger" ?disabled=${busy} @click=${() => this._doReset(s, false)}>${busy ? 'Reiniciando…' : 'Todas'}</button>
      <button class="ghost" ?disabled=${busy} @click=${() => this._doReset(s, true)}>Solo prueba</button>
      <button class="ghost" ?disabled=${busy} @click=${() => this._cancelReset()}>Cancelar</button></span>`;
  }

  _renderList() {
    if (this._loading) return skeletonLines(4);
    return html`
      <div class="toolbar">
        <button class="primary" @click=${() => this._new()}>Nueva encuesta</button>
        <button class="ghost" @click=${() => { this._phase = 'padron'; }}>Padrón de empresa</button>
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._notice ? html`<p class="notice">${this._notice}</p>` : null}
      ${this._surveys.length ? html`
        <table>
          <thead><tr><th>Encuesta</th><th>Estado</th><th>Preguntas</th><th></th></tr></thead>
          <tbody>${this._surveys.map((s) => html`<tr>
            <td>${this._renamingId === s.id
              ? html`<span class="rename-row">
                  <input class="rename-in" .value=${this._renameTitle} ?disabled=${this._renameBusy}
                    @input=${(e) => { this._renameTitle = e.target.value; }}
                    @keydown=${(e) => { if (e.key === 'Enter') this._saveRename(s); if (e.key === 'Escape') this._cancelRename(); }} />
                  <button class="ghost" ?disabled=${this._renameBusy} @click=${() => this._saveRename(s)}>${this._renameBusy ? '…' : 'Guardar'}</button>
                  <button class="ghost" ?disabled=${this._renameBusy} @click=${() => this._cancelRename()}>✕</button>
                </span>`
              : html`${s.title || '(sin título)'}
                  <button class="rename-btn" title="Renombrar" @click=${() => this._startRename(s)}>✎</button>`}</td>
            <td><span class="chip ${s.status}">${STATUS_LABEL[s.status] ?? s.status}</span></td>
            <td>${(s.questions ?? []).length}</td>
            <td><div class="row-actions">
              <button class="ghost" @click=${() => this._edit(s)}>Editar</button>
              <button class="ghost" @click=${() => this._openParticipants(s)}>Enlaces</button>
              <button class="ghost" @click=${() => this._openResults(s)}>Resultados</button>
              ${s.status === 'draft' ? html`<button class="ghost" @click=${() => this._setStatus(s, 'open')}>Abrir</button>` : null}
              ${s.status === 'open' ? html`<button class="ghost" @click=${() => this._setStatus(s, 'closed')}>Cerrar</button>` : null}
              ${s.status === 'closed' ? html`<button class="ghost" @click=${() => this._setStatus(s, 'open')}>Reabrir</button>` : null}
              ${this._renderResetAction(s)}
              ${this.canDelete ? this._renderDeleteAction(s) : null}
            </div></td>
          </tr>`)}</tbody>
        </table>`
        : html`<p class="empty">Aún no hay encuestas. Crea la primera.</p>`}`;
  }

  /** Selector de destino (siguiente en orden / otra pregunta / terminar) para next y goto. */
  _renderDestSelect(value, onChange, selfId) {
    return html`<select @change=${(e) => onChange(e.target.value)}>
      <option value="" ?selected=${!value}>Siguiente en orden</option>
      ${this._questions.map((other, idx) => (other.id === selfId ? null : html`<option value=${other.id} ?selected=${value === other.id}>P${idx + 1}: ${(other.label || '(sin enunciado)').slice(0, 32)}</option>`))}
      <option value=${END} ?selected=${value === END}>Terminar encuesta</option>
    </select>`;
  }

  _renderFlow(q, i) {
    const canBranch = q.type === 'choice' || q.type === 'scale';
    const rules = q.rules ?? [];
    return html`<div class="flow">
      ${canBranch ? html`
        <p class="flow-label">Condiciones (se evalúan en orden; gana la primera que se cumple):</p>
        ${rules.map((r, j) => html`<div class="rule">
          <span>Si la respuesta es</span>
          <select @change=${(e) => this._setRule(i, j, { op: e.target.value })}>
            ${(q.type === 'choice' ? OPS_CHOICE : OPS_SCALE).map((op) => html`<option value=${op} ?selected=${ruleOp(r) === op}>${OP_TEXT[op]}</option>`)}
          </select>
          ${q.type === 'choice'
            ? html`<select @change=${(e) => this._setRule(i, j, { value: e.target.value })}>
                ${choiceOptions(q).map((opt) => html`<option value=${opt} ?selected=${ruleValue(r) === opt}>${opt}</option>`)}
              </select>`
            : html`<input class="num" type="number" .value=${String(ruleValue(r) ?? '')}
                @input=${(e) => this._setRule(i, j, { value: Number(e.target.value) })} />`}
          <span>→ ir a</span>
          ${this._renderDestSelect(r.goto, (v) => this._setRule(i, j, { goto: v }), q.id)}
          <button class="q-move" title="Subir regla" ?disabled=${j === 0} @click=${() => this._moveRule(i, j, -1)}>↑</button>
          <button class="q-move" title="Bajar regla" ?disabled=${j === rules.length - 1} @click=${() => this._moveRule(i, j, 1)}>↓</button>
          <button class="q-del" title="Quitar regla" @click=${() => this._removeRule(i, j)}>✕</button>
        </div>`)}
        <button class="ghost" @click=${() => this._addRule(i)}>+ Regla condicional</button>` : null}
      <label class="flow-line">${canBranch ? 'Si no se cumple ninguna condición, ir a:' : 'Al terminar, ir a:'} ${this._renderDestSelect(q.next, (v) => this._setNext(i, v), q.id)}</label>
    </div>`;
  }

  _renderQuestion(q, i) {
    return html`<details class="q q-details">
      <summary class="q-summary">
        <span class="kind ${q.type}">${QUESTION_KIND[q.type] ?? 'Escala'}</span>
        <span class="q-sumlabel">${q.label || html`<em>(sin enunciado)</em>`}</span>
      </summary>
      ${this._renderQuestionBody(q, i)}
    </details>`;
  }

  _renderQuestionBody(q, i) {
    return html`
      <div class="q-top">
        <input class="q-label" type="text" placeholder="Enunciado de la pregunta" .value=${q.label ?? ''}
          @input=${(e) => this._patchQuestion(i, { label: e.target.value })} />
        <span class="q-move">
          <button title="Subir" @click=${() => this._moveQuestion(i, -1)}>↑</button>
          <button title="Bajar" @click=${() => this._moveQuestion(i, 1)}>↓</button>
        </span>
        <button class="q-del" title="Quitar" @click=${() => this._removeQuestion(i)}>✕</button>
      </div>
      ${q.type === 'choice' ? html`
        <label class="opts-field">Opciones (una por línea)
          <textarea rows="3" placeholder="Producto&#10;Ventas&#10;Soporte" .value=${(q.options ?? []).join('\n')}
            @input=${(e) => this._patchQuestion(i, { options: e.target.value.split('\n') })}></textarea>
        </label>` : null}
      <div class="q-opts">
        ${q.type === 'scale' ? html`
          <label>de <input class="num" type="number" .value=${String(q.min ?? 1)}
            @input=${(e) => this._patchQuestion(i, { min: Number(e.target.value) })} /></label>
          <label>a <input class="num" type="number" .value=${String(q.max ?? 5)}
            @input=${(e) => this._patchQuestion(i, { max: Number(e.target.value) })} /></label>` : null}
        <label><input type="checkbox" .checked=${q.required !== false}
          @change=${(e) => this._patchQuestion(i, { required: e.target.checked })} /> Obligatoria</label>
      </div>
      ${this._renderFlow(q, i)}`;
  }

  _renderEdit() {
    const TABS = [['questions', 'Preguntas'], ['flow', 'Flujo visual'], ['email', 'Correo']];
    return html`
      <div class="toolbar"><button class="ghost" @click=${() => { this._phase = 'list'; }}>← Volver</button></div>
      <div class="field">
        <label for="t">Título de la encuesta</label>
        <input id="t" class="title" type="text" placeholder="p. ej. «Encuesta de clima — agosto»" .value=${this._title}
          @input=${(e) => { this._title = e.target.value; }} />
      </div>
      <div class="tabs" role="tablist">
        ${TABS.map(([id, label]) => html`<button class="tab ${this._editTab === id ? 'on' : ''}"
          role="tab" aria-selected=${this._editTab === id ? 'true' : 'false'} @click=${() => this._setTab(id)}>${label}</button>`)}
      </div>
      <div class="tab-body">
        ${this._editTab === 'questions' ? this._renderQuestionsTab() : null}
        ${this._editTab === 'flow' ? this._renderFlowTab() : null}
        ${this._editTab === 'email' ? this._renderEmailTab() : null}
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      <div class="save-bar">
        <button class="primary" ?disabled=${this._saving} @click=${() => this._save()}>${this._saving ? 'Guardando…' : 'Guardar encuesta'}</button>
      </div>`;
  }

  _renderQuestionsTab() {
    const n = this._questions.length;
    return html`
      <div class="settings">
        <div class="field">
          <label for="th">Umbral de anonimato</label>
          <input id="th" class="num" type="number" min="2" .value=${String(this._threshold)}
            @input=${(e) => { this._threshold = Number(e.target.value) || 5; }} />
        </div>
        <div class="field">
          <label>Escala por defecto</label>
          <div class="q-opts">
            <label>de <input class="num" type="number" .value=${String(this._defaultMin)}
              @input=${(e) => { this._defaultMin = Number(e.target.value); }} /></label>
            <label>a <input class="num" type="number" .value=${String(this._defaultMax)}
              @input=${(e) => { this._defaultMax = Number(e.target.value); }} /></label>
          </div>
        </div>
      </div>
      <div class="q-head">
        <h3>Preguntas${n ? html` <span class="count-pill">${n}</span>` : ''}</h3>
        ${n > 1 ? html`<button class="linkbtn" @click=${() => this._setAllQ(!this._allExpanded)}>${this._allExpanded ? 'Colapsar todas' : 'Descolapsar todas'}</button>` : null}
      </div>
      ${n ? this._questions.map((q, i) => this._renderQuestion(q, i)) : this._renderTemplatePicker()}
      <div class="btn-group add-group">
        <span class="group-label">Añadir pregunta</span>
        <button class="addbtn scale" @click=${() => this._addQuestion('scale')}>+ Escala</button>
        <button class="addbtn text" @click=${() => this._addQuestion('text')}>+ Texto</button>
        <button class="addbtn choice" @click=${() => this._addQuestion('choice')}>+ Opción única</button>
      </div>
      <div class="btn-group io-group">
        <span class="group-label">Plantilla y archivos</span>
        ${n ? html`<button class="ghost" @click=${() => this._askSaveTpl()}>Guardar como plantilla</button>` : null}
        <label class="ghost file">Importar CSV<input type="file" accept=".csv,text/csv,text/plain" @change=${(e) => this._onQuestionsCsv(e)} hidden /></label>
        <label class="ghost file">Importar JSON<input type="file" accept=".json,application/json" @change=${(e) => this._onTemplateFile(e)} hidden /></label>
        <button class="ghost" ?disabled=${!n} @click=${() => this._exportTemplate()}>Exportar JSON</button>
      </div>
      ${this._showSaveTpl ? this._renderSaveTplForm() : null}
      <p class="lead" style="margin-top:0.6rem">CSV para preguntas simples: <code>tipo,enunciado,min,max,obligatoria,opciones</code> (opciones de choice separadas por <code>|</code>). Los saltos condicionales se hacen en el flujo visual o con JSON.</p>`;
  }

  /** Selector de plantilla para una encuesta en blanco: la base + las guardadas (usar/renombrar/borrar). */
  _renderTemplatePicker() {
    return html`
      <div class="tpl-picker">
        <p class="empty">Encuesta en blanco. Empieza desde una plantilla o añade preguntas abajo.</p>
        <div class="tpl-list">
          <button class="tpl base" @click=${() => this._loadTemplate()}>eNPS + Q12 <span class="tpl-tag">base</span></button>
          ${this._templates.map((t) => html`<span class="tpl-item">
            <button class="tpl" @click=${() => this._useTemplate(t.questions)}>${t.name}</button>
            <button class="act" title="Renombrar" @click=${() => this._askRenameTpl(t)}>✎</button>
            <button class="act danger" title="Borrar" @click=${() => this._deleteTpl(t)}>✕</button>
          </span>`)}
        </div>
        ${this._tplError ? html`<p class="error">${this._tplError}</p>` : null}
      </div>`;
  }

  /** Formulario para guardar una plantilla nueva o renombrar una existente. */
  _renderSaveTplForm() {
    return html`<div class="save-tpl">
      <input type="text" placeholder="Nombre de la plantilla" .value=${this._tplName}
        @input=${(e) => { this._tplName = e.target.value; }} />
      <button class="primary" ?disabled=${this._tplBusy} @click=${() => this._saveTpl()}>${this._renameId ? 'Renombrar' : 'Guardar plantilla'}</button>
      <button class="ghost" @click=${() => this._cancelSaveTpl()}>Cancelar</button>
      ${this._tplError ? html`<span class="error">${this._tplError}</span>` : null}
    </div>`;
  }

  /** Pestaña de flujo: lienzo + panel lateral que edita la pregunta del nodo seleccionado. */
  _renderFlowTab() {
    const idx = this._questions.findIndex((q) => q.id === this._selectedNodeId);
    const q = idx >= 0 ? this._questions[idx] : null;
    return html`<div class="flow-wrap">
      <survey-flow-canvas class="flow-canvas" .questions=${this._questions} .layout=${this._flowLayout} .selectedId=${this._selectedNodeId}
        @layout-change=${(e) => this._onLayoutChange(e)} @node-select=${(e) => this._onNodeSelect(e)}></survey-flow-canvas>
      <aside class="flow-panel">
        ${q
          ? html`
            <div class="fp-head">
              <h4 class="fp-title">${QUESTION_KIND[q.type] ?? 'Pregunta'} · editar nodo</h4>
              <button class="fp-close" title="Cerrar edición" @click=${() => this._closeNode()}>✕</button>
            </div>
            ${this._renderQuestionBody(q, idx)}
            <div class="fp-actions">
              <button class="primary" @click=${() => this._closeNode()}>✓ Hecho</button>
              <button class="ghost" ?disabled=${this._saving} @click=${() => this._save()}>${this._saving ? 'Guardando…' : 'Guardar encuesta'}</button>
            </div>`
          : html`<p class="empty">Haz clic en un nodo para editar su pregunta aquí; arrástralo para moverlo.</p>`}
      </aside>
    </div>`;
  }

  _renderEmailTab() {
    return html`
      <p class="lead">El texto que acompaña al enlace al enviar la encuesta. Escribe <code>{{enlace}}</code> donde quieras que aparezca el enlace personal.</p>
      <div class="field">
        <label for="es">Asunto</label>
        <input id="es" class="title" type="text" .value=${this._emailSubject}
          @input=${(e) => { this._emailSubject = e.target.value; }} />
      </div>
      <div class="field">
        <label for="eb">Cuerpo</label>
        <textarea id="eb" rows="9" .value=${this._emailBody}
          @input=${(e) => { this._emailBody = e.target.value; }}></textarea>
      </div>`;
  }

  /** Bloque del padrón en Participantes: error de carga, vacío o el generador. */
  _renderPadronBlock() {
    if (this._padronError) return html`<p class="error">No se pudo cargar el padrón: ${this._padronError}</p>`;
    if (this._padron.length) return this._renderPadronSource();
    return html`<p class="lead">El padrón está vacío. Puedes rellenarlo en «Padrón de empresa» o generar los enlaces con un CSV aquí abajo.</p>`;
  }

  /** Generar enlaces tirando del padrón de empresa, con filtro por departamento y activos. */
  _renderPadronSource() {
    const sel = this._padronSelection;
    return html`<div class="field">
      <label>Desde el <strong>padrón de empresa</strong> (${this._padron.length} persona${this._padron.length === 1 ? '' : 's'}). Filtra y genera un enlace por persona; los metadatos (departamento, antigüedad) salen del padrón.</label>
      <div class="q-opts">
        <label>Departamento
          <select @change=${(e) => { this._padronDept = e.target.value; }}>
            <option value="" ?selected=${!this._padronDept}>Todos</option>
            ${this._padronDepartments.map((d) => html`<option value=${d} ?selected=${this._padronDept === d}>${d}</option>`)}
          </select>
        </label>
        <label><input type="checkbox" .checked=${this._padronActive}
          @change=${(e) => { this._padronActive = e.target.checked; }} /> Solo activos</label>
      </div>
      <div class="save-row">
        <button class="primary" ?disabled=${this._partBusy || !sel.length} @click=${() => this._generateFromPadron()}>
          ${this._partBusy ? 'Generando…' : `Generar enlaces desde el padrón (${sel.length})`}
        </button>
      </div>
    </div>`;
  }

  /** Valor actual de un campo de participante (edición en curso o el ya guardado). */
  _partValue(t, field) {
    return this._partEdits[t.token]?.[field] ?? t.metadata?.[field] ?? '';
  }

  _editPart(token, field, value) {
    this._partEdits = { ...this._partEdits, [token]: { ...this._partEdits[token], [field]: value } };
  }

  /** Recarga la lista de participantes (excluye los de prueba). */
  async _reloadParticipants() {
    this._partTokens = (await listTokens(this._partSurvey.id)).filter((t) => t.test !== true);
  }

  async _savePart(t) {
    this._partRowBusy = t.token; this._error = ''; this._notice = '';
    try {
      const metadata = {};
      for (const f of ['department', 'startDate', 'birthDate', 'location']) {
        const v = String(this._partValue(t, f)).trim();
        if (v) metadata[f] = v;
      }
      await updateSurveyParticipant(this._partSurvey.id, t.token, metadata);
      await this._reloadParticipants();
      const { [t.token]: _drop, ...rest } = this._partEdits;
      this._partEdits = rest;
      this._notice = `Datos de ${t.email} actualizados.`;
    } catch (err) {
      this._error = `No se pudo actualizar: ${err?.message ?? err}`;
    } finally {
      this._partRowBusy = null;
    }
  }

  _askDeletePart(token) { this._partConfirmDelete = token; this._error = ''; this._notice = ''; }
  _cancelDeletePart() { this._partConfirmDelete = null; }

  async _doDeletePart(t) {
    this._partRowBusy = t.token; this._error = '';
    try {
      await deleteSurveyParticipant(this._partSurvey.id, t.token);
      await this._reloadParticipants();
      this._partConfirmDelete = null;
      this._notice = `Participante ${t.email} borrado.`;
    } catch (err) {
      this._error = `No se pudo borrar: ${err?.message ?? err}`;
    } finally {
      this._partRowBusy = null;
    }
  }

  /** Fila editable de un participante: campos de segmentación + guardar/borrar. */
  /** Bloque de un participante: cabecera (email+estado), campos, y pie (enlace+acciones). */
  _renderPartRow(t) {
    const busy = this._partRowBusy === t.token;
    const fields = [['department', 'Departamento'], ['startDate', 'Alta'], ['birthDate', 'Nacimiento'], ['location', 'Ubicación']];
    return html`<div class="part-block">
      <div class="pb-head">
        <span class="pb-email">${t.email}</span>
        <span class="chip ${t.used ? 'open' : 'draft'}">${t.used ? 'Respondió' : 'Pendiente'}</span>
      </div>
      <div class="pb-fields">
        ${fields.map(([f, label]) => html`<label class="pb-field">${label}
          <input type="text" ?disabled=${busy} .value=${String(this._partValue(t, f))}
            @input=${(e) => this._editPart(t.token, f, e.target.value)} /></label>`)}
      </div>
      <div class="pb-foot">
        <input class="pb-link" type="text" readonly title="Enlace personal" .value=${this._linkFor(t.token)} @focus=${(e) => e.target.select()} />
        ${this._partConfirmDelete === t.token
          ? html`<span class="reset-confirm">¿Borrar?
              <button class="ghost danger" ?disabled=${busy} @click=${() => this._doDeletePart(t)}>${busy ? '…' : 'Sí'}</button>
              <button class="ghost" ?disabled=${busy} @click=${() => this._cancelDeletePart()}>No</button></span>`
          : html`<button class="ghost" ?disabled=${busy} @click=${() => this._savePart(t)}>${busy ? 'Guardando…' : 'Guardar'}</button>
              <button class="q-del" title="Borrar participante" ?disabled=${busy} @click=${() => this._askDeletePart(t.token)}>✕</button>`}
      </div>
    </div>`;
  }

  _renderParticipants() {
    const total = this._partTokens.length;
    const responded = this._partTokens.filter((t) => t.used).length;
    return html`
      <div class="toolbar"><button class="ghost" @click=${() => { this._phase = 'list'; }}>← Volver</button></div>
      <h2>${this._partSurvey.title} · Participantes</h2>
      <p class="lead">${total} participante${total === 1 ? '' : 's'} · ${responded} ${responded === 1 ? 'ha' : 'han'} respondido. Genera los enlaces personales desde el padrón o subiendo un CSV.</p>
      ${this._renderPadronBlock()}
      <h3>O bien, sube o pega un CSV</h3>
      <div class="field">
        <label for="pp">Sube un <strong>CSV</strong> o pega el padrón. Una persona por fila. Columnas:
          <code>email</code> (obligatoria), y opcionales <code>departamento</code>, <code>fecha_alta</code>, <code>nacimiento</code> y <code>ubicación</code> (fechas en YYYY-MM-DD).
          Con cabecera se mapean por nombre en cualquier orden (las columnas extra se ignoran). Re-subir con los mismos emails <strong>actualiza</strong> sus campos sin duplicar el enlace.</label>
        <input type="file" accept=".csv,text/csv,text/plain" @change=${(e) => this._onCsvFile(e)} />
        <textarea id="pp" rows="6" placeholder="email,departamento,fecha_alta&#10;ana@tribbuapp.com,People,2024-01-15" .value=${this._partText}
          @input=${(e) => { this._partText = e.target.value; }}></textarea>
      </div>
      <div class="save-row">
        <button class="primary" ?disabled=${this._partBusy || !this._partText.trim()} @click=${() => this._generate()}>
          ${this._partBusy ? 'Generando…' : 'Generar enlaces'}
        </button>
        ${total ? html`<button class="ghost" @click=${() => this._copyAll()}>${this._copiedAll ? '✓ Copiado' : 'Copiar todos (email, enlace)'}</button>` : null}
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._notice ? html`<p class="notice">${this._notice}</p>` : null}
      ${total ? html`
        <p class="lead">Edita los campos de segmentación de cada participante (se guardan en su enlace, sin regenerarlo) o bórralo.</p>
        <div class="parts-list">${this._partTokens.map((t) => this._renderPartRow(t))}</div>` : null}
      ${total ? this._renderSendBox() : null}`;
  }

  /** Envío por correo: prueba (no cuenta) y masivo (con confirmación inline). */
  _renderSendBox() {
    const total = this._partTokens.length;
    const open = this._partSurvey?.status === 'open';
    return html`
      <h3>Enviar por correo</h3>
      <p class="lead">Se envía desde <code>encuestas@send.tribbu.io</code>. El mensaje debe incluir <code>{link}</code> (pestaña de edición). La <strong>prueba</strong> se puede enviar con la encuesta en borrador; el envío a todos exige abrirla.</p>
      ${this._sendNotice ? html`<p class="notice">${this._sendNotice}</p>` : null}
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      <div class="save-row">
        <input type="email" placeholder="email para la prueba" .value=${this._testEmail}
          @input=${(e) => { this._testEmail = e.target.value; }} />
        <button class="ghost" ?disabled=${this._sendBusy} @click=${() => this._sendTest()}>Enviar prueba</button>
      </div>
      <div class="save-row">
        ${this._confirmBulk
          ? html`<button class="primary" ?disabled=${this._sendBusy} @click=${() => this._sendBulk()}>${this._sendBusy ? 'Enviando…' : `Confirmar envío a ${total}`}</button>
              <button class="ghost" ?disabled=${this._sendBusy} @click=${() => this._cancelBulk()}>Cancelar</button>`
          : html`<button class="primary" ?disabled=${!open || !total || this._sendBusy} @click=${() => this._askBulk()}>Enviar a todos (${total})</button>
              ${open ? null : html`<span class="muted">Abre la encuesta para poder enviarla a todos.</span>`}`}
      </div>
      ${this._renderTestAnswers()}`;
  }

  render() {
    return html`
      ${this._saving ? html`<busy-overlay message="Guardando la encuesta…"></busy-overlay>` : null}
      ${this._sendBusy ? html`<busy-overlay message="Enviando el correo…"></busy-overlay>` : null}
      <h2>Encuestas de clima</h2>
      <p class="lead">Crea y gestiona las encuestas anónimas. Solo tú (People) ves esto; las respuestas son anónimas.</p>
      ${this._phase === 'edit' ? this._renderEdit()
        : this._phase === 'participants' ? this._renderParticipants()
        : this._phase === 'results' ? this._renderResults()
        : this._phase === 'padron' ? html`
            <div class="toolbar"><button class="ghost" @click=${() => { this._phase = 'list'; }}>← Volver</button></div>
            <survey-padron></survey-padron>`
        : this._renderList()}`;
  }
}

if (!customElements.get('survey-admin')) {
  customElements.define('survey-admin', SurveyAdmin);
}
