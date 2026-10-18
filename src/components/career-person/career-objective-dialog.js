/**
 * <career-objective-dialog>: poner un objetivo medible o cerrarlo (RMR-TSK-0750).
 * `request.mode`:
 *  - 'new': título, cómo se mide, fecha límite y, si se quiere, la expectativa
 *    del nivel a la que se engancha (`request.options`, del nivel `levelId`).
 *  - 'close': cómo acabó (`request.objective`) y una nota con lo medido.
 * Emite `objective-submit`; guardar es cosa de la página, que pasa `busy` y,
 * si falla, `error`. `close` cuando se cancela.
 */
import { LitElement, html, css } from 'lit';
import '../app-modal.js';
import '../common/busy-overlay.js';
import { OBJECTIVE_STATUS } from '../../tools/career/domain/objectives.js';

const CLOSINGS = ['achieved', 'missed', 'dropped'];

export class CareerObjectiveDialog extends LitElement {
  static properties = {
    open: { type: Boolean },
    request: { attribute: false },
    busy: { type: Boolean },
    error: { type: String },
    _title: { state: true },
    _measure: { state: true },
    _due: { state: true },
    _dimensionId: { state: true },
    _status: { state: true },
    _note: { state: true },
    _invalid: { state: true },
  };

  static styles = css`
    .lead { margin: 0 0 0.9rem; font-size: 0.86rem; color: var(--rm-muted, #4b5563); max-width: 60ch; }
    label { display: grid; gap: 0.3rem; margin-bottom: 0.8rem; font-size: 0.85rem; font-weight: 600; color: var(--rm-text, #111827); }
    textarea, input, select { font: inherit; font-weight: 400; border: 1px solid var(--rm-border, #cbd5e1); border-radius: 8px;
      padding: 0.45rem 0.55rem; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #111827); }
    .hint { font-size: 0.78rem; color: var(--rm-muted, #4b5563); font-weight: 400; }
    .row { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; flex-wrap: wrap; }
    button { font: inherit; font-size: 0.85rem; font-weight: 600; border-radius: 8px; padding: 0.4rem 0.85rem; cursor: pointer;
      border: 1px solid var(--rm-border, #cbd5e1); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    button.primary { border-color: var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; margin: 0.6rem 0 0; }
  `;

  constructor() {
    super();
    this._reset();
  }

  willUpdate(changed) {
    if (changed.has('request') && this.request) {
      this._reset();
      this._dimensionId = this.request.dimensionId ?? '';
      // Editar (RMR-TSK-0771): el formulario sale con lo que ya tiene.
      const o = this.request.mode === 'edit' ? this.request.objective : null;
      if (o) Object.assign(this, { _title: o.title, _measure: o.measure, _due: o.dueDate ?? '', _dimensionId: o.dimensionId ?? '' });
    }
  }

  _reset() {
    Object.assign(this, { _title: '', _measure: '', _due: '', _dimensionId: '', _status: '', _note: '', _invalid: '' });
  }

  render() {
    const closing = this.request?.mode === 'close';
    const heading = { close: 'Cerrar objetivo', edit: 'Editar objetivo' }[this.request?.mode] ?? 'Nuevo objetivo';
    return html`
      <app-modal .open=${this.open} heading=${heading} @close=${this._close}>
        ${closing ? this._closeForm() : this._newForm()}
        <div class="row">
          <button type="button" @click=${this._close}>Cancelar</button>
          <button type="button" class="primary" ?disabled=${this.busy} @click=${this._submit}>Guardar</button>
        </div>
        ${this._invalid || this.error ? html`<p class="error" role="alert">${this._invalid || this.error}</p>` : null}
        ${this.busy ? html`<busy-overlay message="Guardando…"></busy-overlay>` : null}
      </app-modal>`;
  }

  _newForm() {
    const options = this.request?.options ?? [];
    return html`
      <p class="lead">Un objetivo es un compromiso de esta persona, con cómo se mide y para cuándo. Las expectativas
        son lo que pide su nivel; el objetivo puede engancharse a una para que se vea qué la acerca.</p>
      <label>Objetivo <input maxlength="200" .value=${this._title} @input=${(e) => { this._title = e.target.value; }} /></label>
      <label>Cómo se mide <span class="hint">Indicador y meta. Ej.: «ahorro de esfuerzo ≥ 20 % frente a la línea base».</span>
        <textarea rows="3" maxlength="500" .value=${this._measure} @input=${(e) => { this._measure = e.target.value; }}></textarea>
      </label>
      <label>Fecha límite <input type="date" .value=${this._due} @input=${(e) => { this._due = e.target.value; }} /></label>
      <label>Expectativa a la que ayuda
        <select @change=${(e) => { this._dimensionId = e.target.value; }}>
          <option value="" ?selected=${!this._dimensionId}>Ninguna (objetivo suelto)</option>
          ${options.map((o) => html`<option value=${o.dimensionId} ?selected=${o.dimensionId === this._dimensionId}>${o.name}</option>`)}
        </select>
      </label>`;
  }

  _closeForm() {
    return html`
      <p class="lead">${this.request?.objective?.title ?? ''}</p>
      <label>Cómo acabó
        <select @change=${(e) => { this._status = e.target.value; }}>
          <option value="" ?selected=${!this._status}>Elige…</option>
          ${CLOSINGS.map((s) => html`<option value=${s} ?selected=${s === this._status}>${OBJECTIVE_STATUS[s]}</option>`)}
        </select>
      </label>
      <label>Nota <span class="hint">Lo medido al cerrar, o por qué se descarta.</span>
        <textarea rows="3" maxlength="1000" .value=${this._note} @input=${(e) => { this._note = e.target.value; }}></textarea>
      </label>`;
  }

  _submit() {
    const request = this.request ?? {};
    let detail;
    if (request.mode === 'close') {
      if (!CLOSINGS.includes(this._status)) { this._invalid = 'Elige cómo acabó el objetivo.'; return; }
      if (!this._note.trim()) { this._invalid = 'Escribe lo medido al cerrar, o por qué se descarta.'; return; }
      detail = { mode: 'close', objectiveId: request.objective.id, status: this._status, note: this._note.trim() };
    } else {
      if (!this._title.trim()) { this._invalid = 'Falta el objetivo.'; return; }
      if (!this._measure.trim()) { this._invalid = 'Falta cómo se mide: sin medida es un deseo, no un objetivo.'; return; }
      const linked = !!this._dimensionId;
      const editing = request.mode === 'edit';
      detail = { mode: editing ? 'edit' : 'new', title: this._title.trim(), measure: this._measure.trim(), dueDate: this._due || null,
        levelId: linked ? request.levelId : null, dimensionId: linked ? this._dimensionId : null,
        ...(editing ? { objectiveId: request.objective.id } : {}) };
    }
    this._invalid = '';
    this.dispatchEvent(new CustomEvent('objective-submit', { detail, bubbles: true, composed: true }));
  }

  _close() {
    this._reset();
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
}

customElements.define('career-objective-dialog', CareerObjectiveDialog);
