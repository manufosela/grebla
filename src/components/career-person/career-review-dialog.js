/**
 * <career-review-dialog>: quien revisa ve la evidencia y acepta o rechaza en su
 * hueco (RMR-TSK-0681). Las dos cosas exigen motivo (RMR-TSK-0703): la persona
 * tiene que saber por qué cuenta o qué le falta. Emite `review-submit`; guardar es cosa de la página (`busy`, `error`).
 */
import { LitElement, html, css } from 'lit';
import '../app-modal.js';
import '../common/busy-overlay.js';

const isWebUrl = (url) => typeof url === 'string' && /^https?:\/\/\S+$/i.test(url);
const linkTpl = (l) => html`<a href=${l.url} target="_blank" rel="noopener noreferrer">${String(l.kind).toUpperCase()}</a> `;

export class CareerReviewDialog extends LitElement {
  static properties = {
    open: { type: Boolean },
    /** { claim, slot, text } de la expectativa que se revisa. */
    request: { attribute: false },
    busy: { type: Boolean },
    error: { type: String },
    _reason: { state: true },
    _invalid: { state: true },
  };

  static styles = css`
    .expect, .who { margin: 0 0 0.7rem; font-size: 0.88rem; color: var(--rm-muted, #4b5563); }
    .evidence { margin: 0 0 0.9rem; font-size: 0.9rem; color: var(--rm-text, #111827); }
    .evidence a { color: var(--rm-accent-strong, #1d6f65); }
    label { display: grid; gap: 0.3rem; font-size: 0.85rem; font-weight: 600; color: var(--rm-text, #111827); }
    textarea { font: inherit; font-weight: 400; border: 1px solid var(--rm-border, #cbd5e1); border-radius: 8px;
      padding: 0.45rem 0.55rem; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #111827); }
    .row { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; flex-wrap: wrap; }
    button { font: inherit; font-size: 0.85rem; font-weight: 600; border-radius: 8px; padding: 0.4rem 0.85rem; cursor: pointer;
      border: 1px solid var(--rm-border, #cbd5e1); background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }
    button.accept { border-color: #1d6f65; background: #1d6f65; color: #fff; }
    button.reject { border-color: #a42020; background: #a42020; color: #fff; }
    button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; margin: 0.6rem 0 0; }
  `;

  constructor() {
    super();
    this._reason = '';
    this._invalid = '';
  }

  willUpdate(changed) {
    if (changed.has('request')) {
      this._reason = '';
      this._invalid = '';
    }
  }

  render() {
    const claim = this.request?.claim;
    const links = (claim?.evidence?.links ?? []).filter((l) => isWebUrl(l.url));
    // Marcar (RMR-TSK-0705): el revisor decide sin marca previa; no hay evidencia que mostrar.
    const marking = this.request?.mode === 'mark';
    const headings = { mark: 'Marcar la expectativa', arbiter: 'Desempatar' };
    const heading = headings[marking ? 'mark' : this.request?.slot] ?? 'Revisar la marca';
    const marked = html`
      <p class="who">Marcada por ${claim?.claimedBy?.name ?? 'la persona'}.</p>
      <p class="evidence">${claim?.evidence?.text ?? ''}</p>
      ${links.length ? html`<p class="evidence">${links.map(linkTpl)}</p>` : null}`;
    return html`
      <app-modal .open=${this.open} heading=${heading} @close=${this._close}>
        <p class="expect">${this.request?.text ?? ''}</p>
        ${marking ? null : marked}
        <label>Motivo (obligatorio: la persona lo verá)
          <textarea rows="3" .value=${this._reason} @input=${(e) => { this._reason = e.target.value; this._invalid = ''; }}></textarea>
        </label>
        <div class="row">
          <button type="button" @click=${this._close}>Cancelar</button>
          <button type="button" class="reject" ?disabled=${this.busy} @click=${() => this._decide('reject')}>${marking ? 'No llega' : 'Rechazar'}</button>
          <button type="button" class="accept" ?disabled=${this.busy} @click=${() => this._decide('accept')}>${marking ? 'Cumple' : 'Aceptar'}</button>
        </div>
        ${this._invalid || this.error ? html`<p class="error" role="alert">${this._invalid || this.error}</p>` : null}
        ${this.busy ? html`<busy-overlay message="Guardando la revisión…"></busy-overlay>` : null}
      </app-modal>`;
  }

  _decide(decision) {
    const reason = this._reason.trim();
    if (!reason) {
      this._invalid = decision === 'reject' ? 'Para rechazar hace falta un motivo.' : 'Para aceptar hace falta un motivo.';
      return;
    }
    this._invalid = '';
    this.dispatchEvent(new CustomEvent('review-submit', {
      detail: { ...this.request, decision, reason }, bubbles: true, composed: true,
    }));
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
}

customElements.define('career-review-dialog', CareerReviewDialog);
