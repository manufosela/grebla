/**
 * <career-plan>: el plan de una persona (Mi carrera, RMR-TSK-0688). Foco, lo que
 * es suyo y lo que suelta. Lo edita su cadena de managers en el sitio; la persona
 * lo lee. Las reglas del subárbol son las que mandan: si no deja, se dice.
 */
import { LitElement, html, css } from 'lit';
import '../common/busy-overlay.js';
import { getCurrentUser } from '../../lib/auth.js';
import { getCareerPlan, saveCareerPlan } from '../../lib/careerPlan.js';
import { normalizePlan } from '../../tools/career/domain/careerPlan.js';

const lines = (text) => String(text ?? '').split('\n');
const SECTIONS = [['responsibilities', 'Lo que es suyo'], ['lettingGo', 'Lo que suelta']];
const itemTpl = (item) => html`<li>${item}</li>`;
const listTpl = (title, items) => html`<h3>${title}</h3><ul>${items.map(itemTpl)}</ul>`;
const focusTpl = (focus) => (focus ? html`<p>${focus}</p>` : html`<p class="empty">Sin foco escrito todavía.</p>`);

export class CareerPlan extends LitElement {
  static properties = {
    person: { attribute: false },
    _plan: { state: true },
    _draft: { state: true },
    _editing: { state: true },
    _busy: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    h3 { margin: 1rem 0 0.35rem; font-size: 0.95rem; color: var(--rm-text, #111827); }
    p, li { font-size: 0.9rem; color: var(--rm-text, #111827); max-width: 70ch; }
    .empty, .hint { color: var(--rm-muted, #4b5563); font-size: 0.86rem; }
    label { display: grid; gap: 0.3rem; margin-top: 0.8rem; font-size: 0.85rem; font-weight: 600; color: var(--rm-text, #111827); }
    textarea { font: inherit; font-weight: 400; border: 1px solid var(--rm-border, #cbd5e1); border-radius: 8px; padding: 0.45rem 0.55rem;
      background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #111827); }
    .row { display: flex; gap: 0.5rem; margin-top: 0.9rem; }
    button { font: inherit; font-size: 0.85rem; font-weight: 600; border-radius: 8px; padding: 0.4rem 0.85rem; cursor: pointer;
      border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-surface, #fff); color: var(--rm-accent-strong, #1d6f65); }
    button.primary { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    button:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.86rem; }
  `;

  constructor() {
    super();
    this._plan = null;
    this._editing = false;
    this._busy = false;
    this._error = '';
  }

  updated(changed) {
    if (!changed.has('person') || !this.person?.id) return;
    const id = this.person.id;
    // Un borrador a medias es de la persona anterior: no puede acabar en esta.
    Object.assign(this, { _plan: null, _editing: false, _draft: null, _error: '' });
    getCareerPlan(id)
      .then((plan) => { if (this.person?.id === id) this._plan = plan; })
      .catch((err) => { if (this.person?.id === id) this._error = err.message; });
  }

  /** Su cadena (o quien le revisa) edita; la propia persona, no. */
  get _canEdit() {
    const uid = getCurrentUser()?.uid;
    if (!uid || uid === this.person?.uid) return false;
    const reviewers = Object.values(this.person?.careerReviewers ?? {});
    // El dueño de la ficha también: un externo sin sitio en el organigrama solo
    // tiene a quien lo lleva (RMR-TSK-0764).
    return (this.person?.directoryManagerUids ?? []).includes(uid) || reviewers.includes(uid)
      || this.person?.ownerLeaderUid === uid;
  }

  render() {
    if (!this._plan) return this._error ? html`<p class="error" role="alert">${this._error}</p>` : null;
    return this._editing ? this._renderForm() : this._renderView();
  }

  _renderView() {
    const { focus, responsibilities, lettingGo } = this._plan;
    const empty = !focus && responsibilities.length === 0 && lettingGo.length === 0;
    const plan = { responsibilities, lettingGo };
    const hint = empty && !this._canEdit ? html`<p class="hint">Tu responsable aún no ha escrito tu plan.</p>` : null;
    const editBtn = html`<div class="row"><button type="button" @click=${this._edit}>Editar el plan</button></div>`;
    return html`
      <h3>Foco principal</h3>
      ${focusTpl(focus)}
      ${SECTIONS.filter(([key]) => plan[key].length).map(([key, title]) => listTpl(title, plan[key]))}
      ${hint}
      ${this._canEdit ? editBtn : null}`;
  }

  _renderForm() {
    const d = this._draft;
    const busy = this._busy ? html`<busy-overlay message="Guardando el plan…"></busy-overlay>` : null;
    return html`
      <label>Foco principal
        <textarea rows="3" .value=${d.focus} @input=${(e) => { this._draft = { ...d, focus: e.target.value }; }}></textarea>
      </label>
      ${SECTIONS.map(([key, title]) => this._listField(key, title))}
      <div class="row">
        <button type="button" @click=${() => { this._editing = false; this._error = ''; }}>Cancelar</button>
        <button type="button" class="primary" ?disabled=${this._busy} @click=${this._save}>Guardar el plan</button>
      </div>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      ${busy}`;
  }

  _listField(key, title) {
    const onInput = (e) => { this._draft = { ...this._draft, [key]: e.target.value }; };
    return html`<label>${title} <span class="hint">(una por línea)</span>
      <textarea rows="5" .value=${this._draft[key]} @input=${onInput}></textarea></label>`;
  }

  _edit() {
    const p = this._plan;
    this._draft = { focus: p.focus, responsibilities: p.responsibilities.join('\n'), lettingGo: p.lettingGo.join('\n') };
    this._editing = true;
  }

  async _save() {
    const d = this._draft;
    const plan = { focus: d.focus, responsibilities: lines(d.responsibilities), lettingGo: lines(d.lettingGo) };
    const user = getCurrentUser();
    const id = this.person.id;
    this._busy = true;
    this._error = '';
    try {
      await saveCareerPlan(id, plan, { uid: user?.uid ?? '', name: user?.displayName ?? 'Usuario' });
      // Si mientras se guardaba se cambió de persona, este plan ya no es el que se mira.
      if (this.person?.id !== id) return;
      this._plan = normalizePlan(plan);
      this._editing = false;
    } catch (err) {
      this._error = err.message;
    } finally {
      this._busy = false;
    }
  }
}

customElements.define('career-plan', CareerPlan);
