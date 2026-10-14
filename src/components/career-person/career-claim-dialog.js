/**
 * <career-claim-dialog>: el ingeniero marca una expectativa como cumplida con su
 * evidencia (RMR-TSK-0680). En modo `entry` (RMR-TSK-0711) añade una entrada al
 * historial de la expectativa: tipo (de los que `request.kinds` permite), texto y
 * enlaces; el evento lleva además `kind`. Valida aquí con las mismas reglas que el dominio y
 * emite `claim-submit` con la evidencia; guardar es cosa de la página, que
 * pasa `busy` y, si falla, `error`. `close` cuando se cancela.
 */
import { LitElement, html, css } from 'lit';
import '../app-modal.js';
import '../common/busy-overlay.js';
import { validateEvidence, LINK_KINDS, MAX_EVIDENCE_LINKS, MAX_EVIDENCE_TEXT } from '../../tools/career/domain/claims.js';

const KIND_LABEL = { pr: 'PR', adr: 'ADR', rfc: 'RFC', doc: 'Documento', otro: 'Otro' };
/** Tipos de entrada del historial (RMR-TSK-0711). */
const ENTRY_LABEL = { meets: 'Llega', misses: 'No llega', proof: 'Prueba' };

export class CareerClaimDialog extends LitElement {
  static properties = {
    open: { type: Boolean },
    /** Expectativa que se marca: { text } (y la marca anterior si se reenvía). */
    request: { attribute: false },
    busy: { type: Boolean },
    error: { type: String },
    _text: { state: true },
    _links: { state: true },
    _kind: { state: true },
    _invalid: { state: true },
  };

  static styles = css`
    .expect { margin: 0 0 0.9rem; font-size: 0.88rem; color: var(--rm-muted, #4b5563); }
    label { display: grid; gap: 0.3rem; font-size: 0.85rem; font-weight: 600; color: var(--rm-text, #111827); }
    textarea, input, select { font: inherit; font-weight: 400; border: 1px solid var(--rm-border, #cbd5e1); border-radius: 8px;
      padding: 0.45rem 0.55rem; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #111827); }
    .link { display: grid; grid-template-columns: 8rem 1fr auto; gap: 0.4rem; margin-top: 0.5rem; }
    .row { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; flex-wrap: wrap; }
    button { font: inherit; font-size: 0.85rem; font-weight: 600; border-radius: 8px; padding: 0.4rem 0.85rem; cursor: pointer;
      border: 1px solid var(--rm-border, #cbd5e1); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    button.primary { border-color: var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; margin: 0.6rem 0 0; }
    .hint { font-size: 0.78rem; color: var(--rm-muted, #4b5563); font-weight: 400; }
    .kinds { border: 0; margin: 0 0 0.8rem; padding: 0; display: flex; gap: 1rem; flex-wrap: wrap; }
    .kinds legend { font-size: 0.85rem; font-weight: 600; color: var(--rm-text, #111827); margin-bottom: 0.3rem; }
    .kind { display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 400; }
  `;

  constructor() {
    super();
    this._reset();
  }

  willUpdate(changed) {
    if (changed.has('request') && this.request) {
      const prev = this.request.claim?.evidence;
      this._text = prev?.text ?? '';
      this._links = (prev?.links ?? []).map((l) => ({ ...l }));
      // Con un solo tipo posible (el ingeniero aporta pruebas), va elegido.
      const kinds = this.request.kinds ?? [];
      this._kind = kinds.length === 1 ? kinds[0] : '';
      this._invalid = '';
    }
  }

  _reset() {
    this._text = '';
    this._links = [];
    this._kind = '';
    this._invalid = '';
  }

  get _isEntry() {
    return this.request?.mode === 'entry';
  }

  render() {
    const entry = this._isEntry;
    return html`
      <app-modal .open=${this.open} heading=${entry ? 'Añadir al historial' : 'Marcar como cumplida'} @close=${this._close}>
        <p class="expect">${this.request?.text ?? ''}</p>
        ${entry ? this._kindPicker() : null}
        <label>Evidencia
          <span class="hint">${entry ? 'Qué lo demuestra o qué falta.' : 'Qué has hecho que lo demuestra.'}
            Obligatoria, hasta ${MAX_EVIDENCE_TEXT} caracteres.</span>
          <textarea rows="4" maxlength=${MAX_EVIDENCE_TEXT} .value=${this._text}
            @input=${(e) => { this._text = e.target.value; }}></textarea>
        </label>
        ${this._links.map((l, i) => this._linkRow(l, i))}
        <div class="row">
          ${this._links.length < MAX_EVIDENCE_LINKS
            ? html`<button type="button" @click=${this._addLink}>Añadir enlace</button>`
            : null}
          <button type="button" @click=${this._close}>Cancelar</button>
          <button type="button" class="primary" ?disabled=${this.busy} @click=${this._submit}>${entry ? 'Guardar' : 'Enviar a revisión'}</button>
        </div>
        ${this._invalid || this.error ? html`<p class="error" role="alert">${this._invalid || this.error}</p>` : null}
        ${this.busy ? html`<busy-overlay message=${entry ? 'Guardando…' : 'Enviando la marca…'}></busy-overlay>` : null}
      </app-modal>`;
  }

  /** Tipo de entrada; solo se elige si quien escribe tiene más de uno. */
  _kindPicker() {
    const kinds = this.request?.kinds ?? [];
    if (kinds.length < 2) return null;
    return html`<fieldset class="kinds"><legend>Tipo</legend>
      ${kinds.map((k) => html`<label class="kind"><input type="radio" name="kind" .checked=${this._kind === k}
        @change=${() => { this._kind = k; this._invalid = ''; }} /> ${ENTRY_LABEL[k]}</label>`)}
    </fieldset>`;
  }

  _linkRow(link, i) {
    return html`<div class="link">
      <select aria-label="Tipo de enlace" @change=${(e) => this._setLink(i, { kind: e.target.value })}>
        ${LINK_KINDS.map((k) => html`<option value=${k} ?selected=${link.kind === k}>${KIND_LABEL[k]}</option>`)}
      </select>
      <input type="url" aria-label="Enlace" placeholder="https://…" .value=${link.url}
        @input=${(e) => this._setLink(i, { url: e.target.value })} />
      <button type="button" aria-label="Quitar enlace" @click=${() => { this._links = this._links.toSpliced(i, 1); }}>×</button>
    </div>`;
  }

  _addLink() {
    this._links = [...this._links, { kind: 'pr', url: '' }];
  }

  _setLink(i, patch) {
    this._links = this._links.with(i, { ...this._links[i], ...patch });
  }

  _submit() {
    try {
      const entry = this.request?.mode === 'entry';
      if (entry && !(this.request.kinds ?? []).includes(this._kind)) throw new Error('Elige el tipo: llega, no llega o prueba.');
      const evidence = validateEvidence({ text: this._text, links: this._links.filter((l) => l.url.trim()) });
      this._invalid = '';
      const detail = { ...this.request, evidence, ...(entry ? { kind: this._kind } : {}) };
      this.dispatchEvent(new CustomEvent('claim-submit', { detail, bubbles: true, composed: true }));
    } catch (err) {
      this._invalid = err.message;
    }
  }

  _close() {
    this._reset();
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
}

customElements.define('career-claim-dialog', CareerClaimDialog);
