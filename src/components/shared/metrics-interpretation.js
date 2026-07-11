/**
 * <metrics-interpretation> — panel de interpretación IA (veredicto, resumen, causas
 * probables y recomendaciones) para las métricas de flujo/entrega. Lo usan
 * <lean-metrics> y <dora-metrics>.
 *
 * La interpretación VIGENTE se guarda por herramienta y la ven todos (con su fecha);
 * el botón «✨ Interpretar con IA» que la (re)genera solo lo ve el superadmin.
 *
 * Props: interpret (fn `({tool,summary}) => Promise<Saved>`, solo superadmin),
 * loadSaved (fn `({tool}) => Promise<Saved|null>`, carga la vigente), canInterpret
 * (bool: muestra el botón), summary (datos a interpretar), tool ('lean'|'dora').
 */
import { LitElement, html, css } from 'lit';

const VERDICT_LABEL = { bien: 'Bien', regular: 'Regular', mal: 'Mal' };
const DATE_FMT = new Intl.DateTimeFormat('es', { dateStyle: 'long' });

export class MetricsInterpretation extends LitElement {
  static properties = {
    interpret: { attribute: false },
    loadSaved: { attribute: false },
    canInterpret: { attribute: false },
    summary: { attribute: false },
    tool: { type: String },
    _result: { state: true },
    _savedAt: { state: true },
    _savedBy: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; margin: 0.5rem 0 1.25rem; }
    .bar { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .btn { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); border-radius: 8px; padding: 0.45rem 0.85rem; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .hint { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .panel { margin-top: 0.85rem; border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 0.85rem 1rem; background: var(--rm-chip, #eef2f7); }
    .panel.v-bien { border-left: 4px solid var(--rm-success, #16a34a); }
    .panel.v-regular { border-left: 4px solid var(--rm-warning, #f2887a); }
    .panel.v-mal { border-left: 4px solid var(--rm-danger, #dc2626); }
    .verdict { font-size: 0.95rem; color: var(--rm-text, #111827); }
    .verdict strong { text-transform: uppercase; letter-spacing: 0.03em; }
    .sum { font-size: 0.9rem; color: var(--rm-text, #111827); margin: 0.4rem 0 0.6rem; }
    h5 { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--rm-muted, #6b7280); margin: 0.6rem 0 0.25rem; }
    ul { margin: 0; padding-left: 1.1rem; font-size: 0.88rem; color: var(--rm-text, #111827); }
    li { margin: 0.15rem 0; }
    .dis { font-size: 0.72rem; color: var(--rm-muted, #9ca3af); margin: 0.7rem 0 0; }
    .meta { font-size: 0.72rem; color: var(--rm-muted, #9ca3af); font-style: italic; margin: 0.3rem 0 0; }
  `;

  constructor() {
    super();
    this.interpret = null;
    this.loadSaved = null;
    this.canInterpret = false;
    this.summary = null;
    this.tool = 'lean';
    this._result = null;
    this._savedAt = null;
    this._savedBy = null;
    this._loading = false;
    this._error = '';
    this._loadedSaved = false;
  }

  willUpdate(changed) {
    // Carga la interpretación guardada UNA vez, en cuanto haya loadSaved + tool.
    if ((changed.has('loadSaved') || changed.has('tool')) && this.loadSaved && this.tool && !this._loadedSaved) {
      this._loadedSaved = true;
      this._loadSaved();
    }
  }

  async _loadSaved() {
    try {
      const saved = await this.loadSaved({ tool: this.tool });
      if (saved) {
        this._result = saved;
        this._savedAt = saved.at ?? null;
        this._savedBy = saved.by ?? null;
      }
    } catch (err) {
      // La falta de interpretación guardada no debe romper la vista de métricas.
      console.warn('No se pudo cargar la interpretación guardada:', err);
    }
  }

  async _run() {
    if (!this.interpret || this._loading) return;
    this._loading = true;
    this._error = '';
    try {
      this._result = await this.interpret({ tool: this.tool, summary: this.summary });
      this._savedAt = this._result?.at ?? null;
      this._savedBy = this._result?.by ?? null;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo interpretar.';
    } finally {
      this._loading = false;
    }
  }

  /** Etiqueta del botón (evita ternario anidado en la plantilla — Sonar). */
  _btnLabel() {
    if (this._loading) return 'Interpretando…';
    return this._result ? '✨ Volver a interpretar' : '✨ Interpretar con IA';
  }

  /** Línea «Interpretado el {fecha} por {nombre}» del panel guardado. */
  _savedMeta() {
    if (!this._savedAt) return null;
    const quien = this._savedBy?.name ? ` por ${this._savedBy.name}` : '';
    return `Interpretado el ${DATE_FMT.format(new Date(this._savedAt))}${quien}.`;
  }

  render() {
    return html`
      <div class="bar">
        ${this.canInterpret
          ? html`<button class="btn" ?disabled=${!this.interpret || this._loading} @click=${() => this._run()}>${this._btnLabel()}</button>`
          : null}
        ${this.canInterpret && !this.interpret
          ? html`<span class="hint">La IA no está configurada en esta instancia.</span>`
          : null}
        ${!this.canInterpret && !this._result && !this._loading
          ? html`<span class="hint">Aún no hay una interpretación de IA guardada.</span>`
          : null}
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._result ? this._renderResult() : null}
    `;
  }

  _renderResult() {
    const r = this._result;
    return html`<div class="panel v-${r.verdict}">
      <div class="verdict">Valoración: <strong>${VERDICT_LABEL[r.verdict] ?? r.verdict}</strong></div>
      ${r.summary ? html`<p class="sum">${r.summary}</p>` : null}
      ${this._renderList('Causas probables', r.causes)}
      ${this._renderList('Recomendaciones', r.recommendations)}
      <p class="dis">Interpretación orientativa generada por IA. Métrica de equipo/sistema, nunca de personas.</p>
      ${this._savedMeta() ? html`<p class="meta">${this._savedMeta()}</p>` : null}
    </div>`;
  }

  /** Bloque de lista (causas/recomendaciones); extraído para no anidar template literals. */
  _renderList(title, items) {
    if (!items.length) return null;
    return html`<div><h5>${title}</h5><ul>${items.map((i) => this._li(i))}</ul></div>`;
  }

  _li(text) {
    return html`<li>${text}</li>`;
  }
}

if (!customElements.get('metrics-interpretation')) {
  customElements.define('metrics-interpretation', MetricsInterpretation);
}
