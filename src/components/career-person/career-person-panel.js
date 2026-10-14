/**
 * <career-person-panel>: la carrera de una persona en un solo sitio (Mi carrera,
 * RMR-TSK-0682). Lo montan Mi espacio y la ficha de Equipo: mismos datos; los
 * botones cambian según quién mira. `section`: 'expectativas' (marcar y revisar) o
 * 'seguimiento' (el subnivel que sale de las marcas ACEPTADAS y sus cierres).
 */
import { LitElement, html, css } from 'lit';
import './career-levels.js';
import './career-claim-dialog.js';
import './career-review-dialog.js';
import './career-plan.js';
import '../common/busy-overlay.js';
import { getCurrentUser } from '../../lib/auth.js';
import { listClaims, submitClaim, reviewClaim, markAsReviewer } from '../../lib/careerClaims.js';
import { getLevelAssessment, saveLevelAssessment, getCareerAssessment } from '../../lib/careerAssessment.js';
import { nextLevelFor } from '../../tools/career/domain/subLevel.js';
import { levelProgressFor, levelCompletion, subLevelFromProgress } from '../../tools/career/domain/levelProgress.js';
import { marksFromClaims } from '../../tools/career/domain/claims.js';
import { closureHistory, lastClosure, closeAssessment } from '../../tools/career/data/levelAssessment.js';

const author = (user = getCurrentUser()) => ({ uid: user?.uid ?? '', name: user?.displayName ?? 'Usuario' });

export class CareerPersonPanel extends LitElement {
  static properties = {
    person: { attribute: false },
    framework: { attribute: false },
    section: { type: String },
    _claims: { state: true },
    _assessment: { state: true },
    /** Valoración del nivel actual (RMR-TSK-0706). */
    _current: { state: true },
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
    button { margin-top: 0.8rem; font: inherit; font-size: 0.85rem; font-weight: 600; border-radius: 8px; padding: 0.4rem 0.85rem;
      cursor: pointer; border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
  `;

  constructor() {
    super();
    this.section = 'expectativas';
    this._claims = [];
    this._assessment = null;
    this._current = null;
    this._dialog = null;
    this._busy = false;
    this._error = '';
  }

  updated(changed) {
    if (!(changed.has('person') || changed.has('framework')) || !this.person?.id) return;
    // Lo de la persona anterior no se queda a la vista mientras se lee la nueva.
    if (changed.has('person')) Object.assign(this, { _claims: [], _assessment: null, _current: null });
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
      const [claims, assessment, current] = await Promise.all([
        listClaims(personId), next ? getLevelAssessment(personId, next.id) : null, getCareerAssessment(personId),
      ]);
      if (token !== this._loadToken) return false;
      Object.assign(this, { _error: '', _claims: claims, _assessment: assessment, _current: current });
      return true;
    } catch (err) {
      if (token === this._loadToken) Object.assign(this, { _error: err.message, _claims: [], _assessment: null, _current: null });
      return false;
    }
  }

  render() {
    const viewerUid = getCurrentUser()?.uid ?? null;
    if (this.section === 'plan') return html`<career-plan .person=${this.person}></career-plan>`;
    return html`
      ${this.section === 'seguimiento'
        ? this._renderProgress()
        : html`<career-levels .person=${this.person} .framework=${this.framework} .claims=${this._claims}
            .assessment=${this._current} .viewerUid=${viewerUid}
            @claim-request=${(e) => this._open('claim', e.detail)}
            @review-request=${(e) => this._open('review', e.detail)}
            @mark-request=${(e) => this._open('review', { ...e.detail, mode: 'mark' })}></career-levels>`}
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
    // La etiqueta es la misma de toda la app: el cálculo con el ajuste del manager encima.
    const sub = subLevelFromProgress(this.person, progress, progress.levelCode);
    const why = sub?.note ? `: ${sub.note}` : '';
    const manual = `Ajustado por el manager${why}. El cálculo daría ${progress.label}.`;
    const notes = [
      sub?.source === 'manual' ? manual : '',
      last ? `Última valoración cerrada: ${last.pct} %.` : 'Todavía no se ha cerrado ninguna valoración.',
      progress.pendingSub === 3 ? 'Llega al 80 %; el .3 pide mantenerlo en otra valoración cerrada.' : '',
      progress.readyToPromote ? `Cumple todo ${progress.nextLevelCode}: toca plantear la subida.` : '',
    ].filter(Boolean);
    const notesTpl = notes.map((n) => html`<p class="note">${n}</p>`);
    // Cierran quienes revisan: el cierre es la prueba del .3 sostenido.
    const { firstUid, secondUid } = this.person?.careerReviewers ?? {};
    const uid = getCurrentUser()?.uid;
    const canClose = !!uid && (uid === firstUid || uid === secondUid);
    const closeBtn = canClose
      ? html`<button type="button" ?disabled=${this._busy} @click=${this._closeAssessment}>Cerrar valoración</button>`
      : null;
    return html`
      <p class="head"><strong>${sub?.label ?? progress.label}</strong> · ${progress.pct} % de ${progress.nextLevelCode}
        (${progress.earned} de ${progress.total} puntos aceptados)</p>
      ${notesTpl}
      ${closeBtn}`;
  }

  /** Deja constancia del cumplimiento de hoy (lo aceptado); los cierres solo crecen. */
  async _closeAssessment() {
    const next = this._next;
    const marks = marksFromClaims(this._claims, next.id, this.person?.careerReviewers ?? {});
    const closed = closeAssessment(this._assessment, levelCompletion(this.framework, next.id, marks), {
      by: author(), at: new Date().toISOString(),
    });
    await this._save(() => saveLevelAssessment(this.person.id, next.id, closed, author()));
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
    const { claim, slot, decision, reason, mode, levelId, dimensionId } = e.detail;
    if (mode === 'mark') {
      await this._save(() => markAsReviewer(this.person.id, { levelId, dimensionId, slot, decision, reason, by: author() }));
      return;
    }
    await this._save(() => reviewClaim(this.person.id, claim.id, slot, { decision, reason, by: author() }));
  }
}

customElements.define('career-person-panel', CareerPersonPanel);
