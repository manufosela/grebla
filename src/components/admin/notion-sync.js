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
import { tableStyles } from '../common/table-styles.js';
import '../common/busy-overlay.js';
import { isNotionSynced, getLastNotionSync, runNotionSync, peopleNames } from '../../lib/notionSync.js';
import { reportRows } from '../../tools/admin/domain/notionReport.js';

const SECTIONS = [
  ['changes', 'Cambios'], ['creates', 'Altas'], ['skipped', 'Saltadas'], ['notInNotion', 'Solo en GREBLA'],
];

export class NotionSync extends LitElement {
  static properties = {
    _enabled: { state: true },
    _report: { state: true },
    _names: { state: true },
    _simulated: { state: true },
    _section: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  static styles = [noteStyles, tableStyles, css`
    :host { display: block; }
    h2 { font-size: 1.1rem; margin: 0 0 0.6rem; }
    .actions { display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 0.8rem 0; }
    button { font: inherit; padding: 0.45rem 0.9rem; border-radius: 8px; cursor: pointer;
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    button.primary { background: var(--rm-accent, #2a9d8f); border-color: transparent; color: var(--rm-on-accent, #fff); font-weight: 700; }
    .tabs { display: flex; gap: 0.3rem; flex-wrap: wrap; margin: 0 0 0.6rem; }
    .tabs button[aria-selected='true'] { border-color: var(--rm-accent, #2a9d8f); font-weight: 700; }
    table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--rm-border, #e5e7eb); }
    .error { color: var(--rm-danger, #b91c1c); }
  `];

  constructor() {
    super();
    this._enabled = null;
    this._report = null;
    this._names = new Map();
    this._simulated = false;
    this._section = 'changes';
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
      if (this._enabled) [this._report, this._names] = await Promise.all([getLastNotionSync(), peopleNames()]);
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
      this._names = await peopleNames();
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
    const rows = this._rowsOf(r);
    const when = `${r.applied ? 'Aplicado' : 'Simulado'} el ${new Date(r.at).toLocaleString('es-ES')}.`;
    return html`
      <p class="ro-note">${when}</p>
      ${this._renderBlocking(r)}
      <div class="tabs" role="tablist">${SECTIONS.map((section) => this._renderSectionTab(section, rows))}</div>
      ${this._renderSection(rows)}`;
  }

  /** Filas del informe, con cada manager por su nombre (ficha existente o que se va a crear). */
  _rowsOf(r) {
    const created = new Map((r.creates ?? []).map((c) => [c.personId, c.name]));
    return reportRows(r, (id) => this._names.get(id) ?? created.get(id) ?? id);
  }

  _renderSectionTab([id, label], rows) {
    const selected = this._section === id ? 'true' : 'false';
    const text = `${label} (${rows[id].length})`;
    return html`<button role="tab" aria-selected=${selected} @click=${() => { this._section = id; }}>${text}</button>`;
  }

  _renderSection(rows) {
    const list = rows[this._section];
    if (!list.length) return html`<p class="ro-note">Nada aquí.</p>`;
    if (this._section === 'changes') {
      return html`<div class="table-wrap"><table><thead><tr><th>Persona</th><th>Campo</th><th>Antes</th><th>Después</th></tr></thead>
        <tbody>${list.map((c) => this._changeRow(c))}</tbody></table></div>`;
    }
    if (this._section === 'skipped') {
      return html`<div class="table-wrap"><table><tbody>${list.map((s) => this._skippedRow(s))}</tbody></table></div>`;
    }
    return html`<ul>${list.map((name) => this._nameItem(name))}</ul>`;
  }

  _changeRow(c) {
    return html`<tr><td>${c.name}</td><td>${c.field}</td><td>${c.from}</td><td>${c.to}</td></tr>`;
  }

  _skippedRow(s) {
    return html`<tr><td>${s.name}</td><td>${s.reason}</td></tr>`;
  }

  _nameItem(name) {
    return html`<li>${name}</li>`;
  }

  _renderBlocking(r) {
    if (!r.errors?.length) return nothing;
    const text = `No se puede aplicar: ${r.errors.join(' · ')}`;
    return html`<p class="error">${text}</p>`;
  }

}

customElements.define('notion-sync', NotionSync);
