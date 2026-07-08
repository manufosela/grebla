/**
 * <o2o-app> — raíz de la herramienta O2O, organizada por PERIODOS (campañas, p.
 * ej. «Periodo Julio 2026»). Landing = lista de periodos + «Crear periodo». Al
 * entrar en un periodo se ven sus vistas (Guía y Formulario EDITABLES, Registrar,
 * Resumen, Acciones, Evolución) scoped a ese periodo. La guía/formulario viven en
 * el periodo; crear un periodo lo genera EN BLANCO (se rellena a mano, con .md o,
 * en el futuro, con IA).
 *
 * Recibe `persistence` (inyectada por src/client/o2o.js), `people` y `canEdit`.
 */
import { LitElement, html, css } from 'lit';
import './o2o-register.js';
import './o2o-actions.js';
import './o2o-period-summary.js';
import './o2o-evolution.js';
import './o2o-questions-editor.js';
import {
  listPeriods, getPeriod, createPeriod, removePeriod, defaultPeriodName,
} from '../../tools/o2o/application/usecases/periods.js';

/** @type {ReadonlyArray<{ id: string, label: string, ready?: boolean }>} */
const VIEWS = [
  { id: 'guia', label: 'Guía', ready: true },
  { id: 'formulario', label: 'Formulario previo', ready: true },
  { id: 'registrar', label: 'Registrar O2O', ready: true },
  { id: 'resumen', label: 'Resumen', ready: true },
  { id: 'acciones', label: 'Acciones', ready: true },
  { id: 'evolucion', label: 'Evolución', ready: true },
];

export class O2OApp extends LitElement {
  static properties = {
    persistence: { attribute: false },
    people: { attribute: false },
    canEdit: { attribute: false },
    error: { state: true },
    loading: { state: true },
    _periods: { state: true },
    _period: { state: true },
    _view: { state: true },
    _newName: { state: true },
    _busy: { state: true },
    _confirmDelete: { state: true },
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
    h2 { font-size: 1.1rem; margin: 0 0 0.75rem; }
    .lead { font-size: 0.88rem; color: var(--rm-muted, #6b7280); margin: 0 0 1rem; }
    .btn {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.4rem 0.85rem; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: #fff; }
    .btn.danger { color: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); }
    .btn.link { border: 0; background: none; color: var(--rm-accent, #2a9d8f); font-weight: 700; padding: 0; }
    .row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin: 0 0 1rem; }
    input[type='text'] { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db); border-radius: 8px; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); min-width: 16rem; }
    ul.periods { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    ul.periods li { display: flex; align-items: center; gap: 0.6rem; border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.55rem 0.85rem; }
    ul.periods .name { flex: 1; font-weight: 600; }
    .head { display: flex; align-items: center; gap: 0.75rem; margin: 0 0 1rem; }
    .placeholder { color: var(--rm-muted, #9ca3af); font-size: 0.9rem; padding: 1.5rem 0; text-align: center; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.9rem; }
    .empty { color: var(--rm-muted, #9ca3af); }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.people = [];
    this.canEdit = false;
    this.error = '';
    this.loading = true;
    /** @type {import('../../tools/o2o/domain/types.js').O2OPeriod[]} */
    this._periods = [];
    /** @type {import('../../tools/o2o/domain/types.js').O2OPeriod|null} */
    this._period = null;
    this._view = 'guia';
    this._newName = '';
    this._busy = false;
    this._confirmDelete = null;
    this._loaded = false;
  }

  updated() {
    if (this.persistence && !this._loaded) {
      this._loaded = true;
      this._loadPeriods();
    }
  }

  async _loadPeriods() {
    this.loading = true;
    this.error = '';
    try {
      this._periods = await listPeriods(this.persistence);
      this._newName = defaultPeriodName();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudieron cargar los periodos.';
    } finally {
      this.loading = false;
    }
  }

  async _create() {
    const name = this._newName.trim();
    if (!name) return;
    this._busy = true;
    this.error = '';
    try {
      const id = await createPeriod(this.persistence, { name });
      this._periods = await listPeriods(this.persistence);
      await this._enter(id); // entra directo al periodo recién creado
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo crear el periodo.';
    } finally {
      this._busy = false;
    }
  }

  async _enter(id) {
    this.error = '';
    try {
      this._period = await getPeriod(this.persistence, id);
      this._view = 'guia';
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo abrir el periodo.';
    }
  }

  async _back() {
    this._period = null;
    this._confirmDelete = null;
    await this._loadPeriods();
  }

  async _remove(id) {
    this.error = '';
    try {
      await removePeriod(this.persistence, id);
      this._confirmDelete = null;
      this._periods = await listPeriods(this.persistence);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'No se pudo borrar el periodo.';
    }
  }

  /** Refresca la guía/formulario del periodo tras editar (para que Registrar use la última). */
  _onEditorSaved(e) {
    if (!this._period) return;
    const { kind, value } = e.detail;
    this._period = { ...this._period, [kind === 'form' ? 'form' : 'guide']: value };
  }

  render() {
    if (this.error && !this._period) return html`<section class="panel"><p class="error">${this.error}</p></section>`;
    if (this.loading) return html`<section class="panel"><p class="empty">Cargando…</p></section>`;
    return this._period ? this._renderWorkspace() : this._renderPeriodsList();
  }

  // ── Landing: lista de periodos ─────────────────────────────────────────────
  _renderPeriodsList() {
    return html`
      <section class="panel">
        <h2>Periodos de O2O</h2>
        <p class="lead">Cada periodo (p. ej. mensual) tiene su propia guía y formulario de preguntas. Crea uno y edítalo, o registra los O2O dentro de él.</p>
        <div class="row">
          <input type="text" .value=${this._newName} @input=${(e) => { this._newName = e.target.value; }} placeholder="Nombre del periodo" />
          <button class="btn primary" ?disabled=${this._busy || !this._newName.trim()} @click=${() => this._create()}>
            ${this._busy ? 'Creando…' : '+ Crear periodo de O2O'}
          </button>
        </div>
        ${this._periods.length ? html`<ul class="periods">${this._periods.map((p) => this._renderPeriodItem(p))}</ul>`
          : html`<p class="empty">Aún no hay periodos. Crea el primero.</p>`}
      </section>
    `;
  }

  _renderPeriodItem(p) {
    const del = this._confirmDelete === p.id
      ? html`<button class="btn danger" @click=${() => this._remove(p.id)}>Confirmar</button>
             <button class="btn" @click=${() => { this._confirmDelete = null; }}>Cancelar</button>`
      : html`<button class="btn" @click=${() => this._enter(p.id)}>Abrir</button>
             <button class="btn danger" @click=${() => { this._confirmDelete = p.id; }}>Borrar</button>`;
    return html`<li>
      <span class="name">${p.name}</span>
      ${del}
    </li>`;
  }

  // ── Workspace de un periodo ────────────────────────────────────────────────
  _renderWorkspace() {
    return html`
      <div class="head">
        <button class="btn link" @click=${() => this._back()}>← Periodos</button>
        <h2 style="margin:0">${this._period.name}</h2>
      </div>
      <div class="tabs" role="tablist" aria-label="Secciones del periodo de O2O">
        ${VIEWS.map((v) => this._renderTab(v))}
      </div>
      ${this.error ? html`<p class="error">${this.error}</p>` : null}
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
    const period = this._period;
    if (this._view === 'guia') return this._renderEditor('guide', period.guide);
    if (this._view === 'formulario') return this._renderEditor('form', period.form);
    if (this._view === 'registrar') return this._renderRegister();
    if (this._view === 'acciones') return this._renderActions();
    if (this._view === 'resumen') return this._renderSummary();
    if (this._view === 'evolucion') return this._renderEvolution();
    return this._renderPlaceholder();
  }

  _renderEditor(kind, value) {
    return html`<o2o-questions-editor
      .persistence=${this.persistence}
      .periodId=${this._period.id}
      .kind=${kind}
      .value=${value}
      @saved=${(e) => this._onEditorSaved(e)}
    ></o2o-questions-editor>`;
  }

  _renderRegister() {
    return html`<o2o-register
      .persistence=${this.persistence}
      .people=${this.people}
      .guide=${this._period.guide}
      .periodId=${this._period.id}
      .canEdit=${this.canEdit}
    ></o2o-register>`;
  }

  _renderActions() {
    return html`<o2o-actions
      .persistence=${this.persistence}
      .people=${this.people}
      .periodId=${this._period.id}
    ></o2o-actions>`;
  }

  _renderSummary() {
    return html`<o2o-period-summary
      .persistence=${this.persistence}
      .people=${this.people}
      .periodId=${this._period.id}
    ></o2o-period-summary>`;
  }

  _renderEvolution() {
    return html`<o2o-evolution
      .persistence=${this.persistence}
      .people=${this.people}
    ></o2o-evolution>`;
  }

  _renderPlaceholder() {
    const v = VIEWS.find((x) => x.id === this._view);
    return html`<p class="placeholder">🚧 «${v?.label}» — próximamente (estadísticas y evolución por periodo).</p>`;
  }
}

if (!customElements.get('o2o-app')) {
  customElements.define('o2o-app', O2OApp);
}
