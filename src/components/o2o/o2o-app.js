/**
 * <o2o-app> — raíz de la herramienta O2O (One-to-Ones). Router de 6 vistas.
 * FASE 1 (sin IA): «Guía» y «Formulario previo» en solo lectura (contenido
 * sembrado); «Registrar», «Resumen», «Acciones» y «Evolución» son placeholders
 * «próximamente». La edición de guía/formulario y la IA llegan en fases siguientes.
 *
 * Recibe `persistence` (inyectada por src/client/o2o.js) y `canEdit` (líder/admin).
 */
import { LitElement, html, css } from 'lit';
import './o2o-register.js';
import './o2o-actions.js';
import './o2o-summary.js';
import { getGuide, getForm } from '../../tools/o2o/application/usecases/index.js';
import { DEFAULT_GUIDE_ID, DEFAULT_FORM_ID } from '../../tools/o2o/domain/types.js';

/** @type {ReadonlyArray<{ id: string, label: string, ready?: boolean }>} */
const VIEWS = [
  { id: 'guia', label: 'Guía', ready: true },
  { id: 'formulario', label: 'Formulario previo', ready: true },
  { id: 'registrar', label: 'Registrar O2O', ready: true },
  { id: 'resumen', label: 'Resumen acumulado', ready: true },
  { id: 'acciones', label: 'Acciones', ready: true },
  { id: 'evolucion', label: 'Evolución' },
];

export class O2OApp extends LitElement {
  static properties = {
    persistence: { attribute: false },
    people: { attribute: false },
    canEdit: { attribute: false },
    error: { state: true },
    loading: { state: true },
    _view: { state: true },
    _guide: { state: true },
    _form: { state: true },
  };

  static styles = css`
    :host { display: block; font-family: var(--rm-font, system-ui, sans-serif); }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .tab {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-muted, #6b7280);
      border-radius: 999px; padding: 0.4rem 1rem; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .tab.active { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .tab:hover:not(.active) { color: var(--rm-text, #111827); }
    .tab .soon { font-size: 0.7rem; opacity: 0.7; margin-left: 0.35rem; }
    section.panel {
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: var(--rm-radius, 12px); padding: 1.25rem 1.5rem;
    }
    h2 { font-size: 1.05rem; margin: 0 0 0.5rem; }
    .lead { font-size: 0.88rem; color: var(--rm-muted, #6b7280); margin: 0 0 1rem; }
    .block { margin: 0 0 1.25rem; }
    .block h3 { font-size: 0.95rem; margin: 0 0 0.35rem; color: var(--rm-navy, #1e3a5f); }
    .block .intro { font-size: 0.85rem; color: var(--rm-muted, #6b7280); margin: 0 0 0.5rem; }
    ol.qs { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.3rem; }
    ol.qs li { font-size: 0.9rem; }
    .placeholder { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; padding: 1.5rem 0; text-align: center; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.9rem; }
    .empty { color: var(--rm-muted, #9ca3af); }
    .ver { font-size: 0.75rem; color: var(--rm-muted, #9ca3af); }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.people = [];
    this.canEdit = false;
    this.error = '';
    this.loading = true;
    this._view = 'guia';
    /** @type {import('../../tools/o2o/domain/types.js').O2OGuide|null} */
    this._guide = null;
    /** @type {import('../../tools/o2o/domain/types.js').PreO2OForm|null} */
    this._form = null;
    this._loaded = false;
  }

  updated() {
    if (this.persistence && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this.loading = true;
    this.error = '';
    try {
      const [guide, form] = await Promise.all([
        getGuide(this.persistence, DEFAULT_GUIDE_ID),
        getForm(this.persistence, DEFAULT_FORM_ID),
      ]);
      this._guide = guide;
      this._form = form;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo cargar el O2O.';
    } finally {
      this.loading = false;
    }
  }

  render() {
    if (this.error) return html`<p class="error">${this.error}</p>`;
    return html`
      <div class="tabs" role="tablist" aria-label="Secciones de O2O">
        ${VIEWS.map((v) => this._renderTab(v))}
      </div>
      <section class="panel">${this._renderView()}</section>
    `;
  }

  _renderTab(v) {
    const soon = v.ready ? null : html`<span class="soon">próximamente</span>`;
    return html`<button
      class="tab ${this._view === v.id ? 'active' : ''}"
      role="tab"
      aria-selected=${this._view === v.id ? 'true' : 'false'}
      @click=${() => { this._view = v.id; }}
    >${v.label}${soon}</button>`;
  }

  _renderView() {
    if (this.loading) return html`<p class="empty">Cargando…</p>`;
    if (this._view === 'guia') return this._renderGuide();
    if (this._view === 'formulario') return this._renderForm();
    if (this._view === 'registrar') return this._renderRegister();
    if (this._view === 'acciones') return this._renderActions();
    if (this._view === 'resumen') return this._renderSummary();
    return this._renderPlaceholder();
  }

  _renderRegister() {
    return html`<o2o-register
      .persistence=${this.persistence}
      .people=${this.people}
      .guide=${this._guide}
      .canEdit=${this.canEdit}
    ></o2o-register>`;
  }

  _renderActions() {
    return html`<o2o-actions
      .persistence=${this.persistence}
      .people=${this.people}
    ></o2o-actions>`;
  }

  _renderSummary() {
    return html`<o2o-summary
      .persistence=${this.persistence}
      .people=${this.people}
    ></o2o-summary>`;
  }

  _renderGuide() {
    const g = this._guide;
    if (!g) return html`<p class="empty">Aún no hay guía. Ejecuta el seed (<code>pnpm seed:o2o</code>) para cargar la guía por defecto.</p>`;
    return html`
      <h2>Guía del O2O <span class="ver">v${g.version}</span></h2>
      <p class="lead">Temas y preguntas para conducir un O2O. En esta fase es de solo lectura; la edición llega en la siguiente.</p>
      ${g.blocks.map((b) => this._renderGuideBlock(b))}
    `;
  }

  /** Lista ordenada de preguntas (compartida por guía y formulario). */
  _renderQuestions(questions) {
    if (!questions.length) return null;
    const items = questions.map((q) => html`<li>${q.text}</li>`);
    return html`<ol class="qs">${items}</ol>`;
  }

  _renderGuideBlock(b) {
    const intro = b.intro ? html`<p class="intro">${b.intro}</p>` : null;
    return html`<div class="block">
      <h3>${b.title}</h3>
      ${intro}
      ${this._renderQuestions(b.questions)}
    </div>`;
  }

  _renderForm() {
    const f = this._form;
    if (!f) return html`<p class="empty">Aún no hay formulario previo. Ejecuta el seed (<code>pnpm seed:o2o</code>).</p>`;
    return html`
      <h2>Formulario previo <span class="ver">v${f.version}</span></h2>
      <p class="lead">${f.intro}</p>
      ${f.sections.map((s) => this._renderFormSection(s))}
    `;
  }

  _renderFormSection(s) {
    return html`<div class="block">
      <h3>${s.title}</h3>
      ${this._renderQuestions(s.questions)}
    </div>`;
  }

  _renderPlaceholder() {
    const v = VIEWS.find((x) => x.id === this._view);
    return html`<p class="placeholder">🚧 «${v?.label}» — próximamente. Esta vista llega en una fase siguiente (registro con IA, acciones, evolución).</p>`;
  }
}

if (!customElements.get('o2o-app')) {
  customElements.define('o2o-app', O2OApp);
}
