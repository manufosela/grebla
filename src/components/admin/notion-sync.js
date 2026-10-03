/**
 * <notion-sync> — pestaña «Notion» del panel (RMR-TSK-0623, ADR
 * -P1XxVvQPrufU13Bd4RF). En una instancia conectada, el censo (nombre,
 * departamento, manager, alta, externo) viene del Directorio de Notion: aquí el
 * superadmin SIMULA, revisa el informe y solo entonces APLICA. «Aplicar» no
 * existe hasta que hay una simulación en pantalla: nadie escribe sin haber visto
 * lo que se va a mover. En una instancia sin Notion (la demo) lo dice y remite al
 * admin de personas.
 */
import { LitElement, html, css, nothing } from 'lit';
import { noteStyles } from '../common/note-styles.js';
import '../common/busy-overlay.js';
import { isNotionSynced, getLastNotionSync, runNotionSync } from '../../lib/notionSync.js';

export class NotionSync extends LitElement {
  static properties = {
    _enabled: { state: true },
    _report: { state: true },
    _simulated: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  static styles = [noteStyles, css`
    :host { display: block; }
    h2 { font-size: 1.1rem; margin: 0 0 0.6rem; }
    .actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 0.8rem 0; }
    button { font: inherit; padding: 0.45rem 0.9rem; border-radius: 8px; cursor: pointer;
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: transparent; color: var(--rm-on-accent, #fff); font-weight: 700; }
    .error { color: var(--rm-danger, #b91c1c); }
  `];

  constructor() {
    super();
    this._enabled = null;
    this._report = null;
    this._simulated = false;
    this._busy = '';
    this._error = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  async _load() {
    try {
      this._enabled = await isNotionSynced();
      if (this._enabled) this._report = await getLastNotionSync();
    } catch (err) {
      this._error = `No se pudo leer el estado de Notion: ${err.message}`;
    }
  }

  async _run(apply) {
    this._error = '';
    // «Aplicar» solo tras la ÚLTIMA simulación correcta: si esta falla, no vale la anterior.
    this._simulated = false;
    this._busy = apply ? 'Aplicando el censo de Notion…' : 'Simulando con Notion…';
    try {
      this._report = await runNotionSync(apply);
      this._simulated = !apply;
    } catch (err) {
      this._error = err.message;
    } finally {
      this._busy = '';
    }
  }

  render() {
    if (this._error && this._enabled === null) return html`<p class="error">${this._error}</p>`;
    if (this._enabled === null) return html`<p class="ro-note">Comprobando si esta instancia usa Notion…</p>`;
    if (!this._enabled) {
      return html`<h2>Notion</h2><p class="ro-note">Esta instancia no está conectada a Notion: las personas se gestionan desde la pestaña Usuarios.</p>`;
    }
    const r = this._report;
    return html`
      ${this._renderBusy()}
      <h2>Censo desde Notion</h2>
      <p class="ro-note">Nombre, departamento, manager, alta y externo vienen del Directorio de Notion. Simula primero y revisa el informe; nunca se da de baja ni se borra a nadie.</p>
      <div class="actions">
        <button @click=${() => this._run(false)}>Simular</button>
        ${this._renderApply(r)}
      </div>
      ${this._renderError()}
      ${r ? this._renderReport(r) : this._renderNeverSynced()}`;
  }

  _renderBusy() {
    return this._busy ? html`<busy-overlay message=${this._busy}></busy-overlay>` : nothing;
  }

  _renderError() {
    return this._error ? html`<p class="error">${this._error}</p>` : nothing;
  }

  _renderNeverSynced() {
    return html`<p class="ro-note">Aún no se ha sincronizado nunca.</p>`;
  }

  /** «Aplicar» solo existe tras una simulación correcta y sin errores. */
  _renderApply(r) {
    if (!this._simulated || r?.errors?.length !== 0) return nothing;
    const label = `Aplicar ${r.counts.updates} cambios y ${r.counts.creates} altas`;
    return html`<button class="primary" @click=${() => this._run(true)}>${label}</button>`;
  }

  _renderReport(r) {
    const when = `${r.applied ? 'Aplicado' : 'Simulado'} el ${new Date(r.at).toLocaleString('es-ES')}.`;
    const { updates, creates, skipped, notInNotion } = r.counts;
    const summary = `${updates} cambios · ${creates} altas · ${skipped} saltadas · ${notInNotion} solo en GREBLA`;
    return html`
      <p class="ro-note">${when}</p>
      ${this._renderBlocking(r)}
      <p>${summary}</p>`;
  }

  _renderBlocking(r) {
    if (!r.errors?.length) return nothing;
    const text = `No se puede aplicar: ${r.errors.join(' · ')}`;
    return html`<p class="error">${text}</p>`;
  }

}

customElements.define('notion-sync', NotionSync);
