/**
 * <career-person-panel>: la carrera de una persona en un solo sitio (Mi carrera,
 * RMR-TSK-0682). Lo montan Mi espacio y la ficha de Equipo: mismos datos; los
 * botones cambian según quién mira. `section`: 'expectativas' (marcar y revisar) o
 * 'seguimiento' (el subnivel que sale de las marcas ACEPTADAS y sus cierres).
 */
import { LitElement, html, css } from 'lit';
import './career-expectations.js';
import './career-claim-dialog.js';
import './career-review-dialog.js';
import '../common/busy-overlay.js';
import { getCurrentUser } from '../../lib/auth.js';
import { listClaims, submitClaim, reviewClaim } from '../../lib/careerClaims.js';
import { getLevelAssessment } from '../../lib/careerAssessment.js';
import { nextLevelFor } from '../../tools/career/domain/subLevel.js';
import { levelProgressFor } from '../../tools/career/domain/levelProgress.js';
import { marksFromClaims } from '../../tools/career/domain/claims.js';
import { closureHistory, lastClosure } from '../../tools/career/data/levelAssessment.js';

const author = (user = getCurrentUser()) => ({ uid: user?.uid ?? '', name: user?.displayName ?? 'Usuario' });

export class CareerPersonPanel extends LitElement {
  static properties = {
    person: { attribute: false },
    framework: { attribute: false },
    section: { type: String },
    _claims: { state: true },
    _assessment: { state: true },
    _dialog: { state: true },
    _request: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .head { font-size: 1.05rem; margin: 0 0 0.3rem; color: var(--rm-text, #111827); }
    .note { font-size: 0.86rem; color: var(--rm-muted, #4b5563); margin: 0.2rem 0; max-width: 62ch; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.86rem; }
  `;

  constructor() {
    super();
    this.section = 'expectativas';
    this._claims = [];
    this._assessment = null;
    this._dialog = null;
    this._busy = false;
    this._error = '';
  }

  updated(changed) {
    if (!(changed.has('person') || changed.has('framework')) || !this.person?.id) return;
    // Lo de la persona anterior no se queda a la vista mientras se lee la nueva.
    if (changed.has('person')) Object.assign(this, { _claims: [], _assessment: null });
    this._load();
  }

  get _next() {
    return nextLevelFor(this.framework?.levels ?? [], this.person?.levelId);
  }

  /** Solo cuenta la última lectura: una anterior que llegue tarde ya no es de lo que se mira. */
  async _load() {
    const token = (this._loadToken = (this._loadToken ?? 0) + 1);
    const personId = this.person.id;
    const next = this._next;
    try {
      const [claims, assessment] = await Promise.all([
        listClaims(personId), next ? getLevelAssessment(personId, next.id) : null,
      ]);
      if (token !== this._loadToken) return false;
      Object.assign(this, { _error: '', _claims: claims, _assessment: assessment });
      return true;
    } catch (err) {
      if (token === this._loadToken) Object.assign(this, { _error: err.message, _claims: [], _assessment: null });
      return false;
    }
  }

  render() {
    const viewerUid = getCurrentUser()?.uid ?? null;
    return html`
      ${this.section === 'seguimiento'
        ? this._renderProgress()
        : html`<career-expectations .person=${this.person} .framework=${this.framework} .claims=${this._claims}
            .viewerUid=${viewerUid}
            @claim-request=${(e) => this._open('claim', e.detail)}
            @review-request=${(e) => this._open('review', e.detail)}></career-expectations>`}
      ${this._error && !this._dialog ? html`<p class="error" role="alert">${this._error}</p>` : null}
      ${this._busy && !this._dialog ? html`<busy-overlay message="Guardando…"></busy-overlay>` : null}
      <career-claim-dialog .open=${this._dialog === 'claim'} .request=${this._request} ?busy=${this._busy}
        .error=${this._error} @claim-submit=${this._onClaimSubmit} @close=${this._closeDialog}></career-claim-dialog>
      <career-review-dialog .open=${this._dialog === 'review'} .request=${this._request} ?busy=${this._busy}
        .error=${this._error} @review-submit=${this._onReviewSubmit} @close=${this._closeDialog}></career-review-dialog>`;
  }

  _renderProgress() {
    const next = this._next;
    if (!next) return html`<p class="note">No hay nivel siguiente en su itinerario.</p>`;
    const progress = levelProgressFor({
      person: this.person, framework: this.framework,
      marks: marksFromClaims(this._claims, next.id, this.person?.careerReviewers ?? {}),
      history: closureHistory(this._assessment),
    });
    if (!progress) return html`<p class="note">${next.code} todavía no tiene expectativas escritas.</p>`;
    const last = lastClosure(this._assessment);
    const notes = [
      last ? `Última valoración cerrada: ${last.pct} %.` : 'Todavía no se ha cerrado ninguna valoración.',
      progress.pendingSub === 3 ? 'Llega al 80 %; el .3 pide mantenerlo en otra valoración cerrada.' : '',
      progress.readyToPromote ? `Cumple todo ${progress.nextLevelCode}: toca plantear la subida.` : '',
    ].filter(Boolean);
    const notesTpl = notes.map((n) => html`<p class="note">${n}</p>`);
    return html`
      <p class="head"><strong>${progress.label}</strong> · ${progress.pct} % de ${progress.nextLevelCode}
        (${progress.earned} de ${progress.total} puntos aceptados)</p>
      ${notesTpl}`;
  }

  _open(dialog, request) {
    this._error = '';
    this._request = request;
    this._dialog = dialog;
  }

  _closeDialog() {
    this._dialog = null;
    this._error = '';
  }

  async _save(write) {
    this._busy = true;
    this._error = '';
    try {
      await write();
      if (await this._load()) this._dialog = null;
    } catch (err) {
      this._error = err.message;
    } finally {
      this._busy = false;
    }
  }

  async _onClaimSubmit(e) {
    const { levelId, dimensionId, evidence } = e.detail;
    await this._save(() => submitClaim(this.person.id, { levelId, dimensionId, evidence, by: author() }));
  }

  async _onReviewSubmit(e) {
    const { claim, slot, decision, reason } = e.detail;
    await this._save(() => reviewClaim(this.person.id, claim.id, slot, { decision, reason, by: author() }));
  }
}

customElements.define('career-person-panel', CareerPersonPanel);
