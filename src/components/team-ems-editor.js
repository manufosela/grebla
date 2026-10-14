/**
 * <team-ems-editor>: el superadmin dice qué manager es EM de cada equipo de Tech
 * (RMR-TSK-0717). Para todo lo de EM —dueño de la ficha, O2O, revisor de carrera—
 * ese EM pasa a ser el jefe de los ICs y leads del equipo; la jerarquía oficial
 * sigue saliendo de Notion.
 */
import { LitElement, html, css } from 'lit';
import './common/busy-overlay.js';
import { loadTeamEms, saveTeamEms } from '../lib/teamEms.js';
import { teamEmChoices, cleanTeamEms } from '../tools/team/domain/teamEms.js';

export class TeamEmsEditor extends LitElement {
  static properties = {
    readOnly: { type: Boolean },
    _teams: { state: true },
    _candidates: { state: true },
    _draft: { state: true },
    _loading: { state: true },
    _busy: { state: true },
    _error: { state: true },
    _saved: { state: true },
  };

  static styles = css`
    :host { display: block; }
    h2 { font-size: 1.05rem; margin: 0 0 0.3rem; color: var(--rm-text, #111827); }
    .note { font-size: 0.88rem; color: var(--rm-muted, #4b5563); max-width: 66ch; margin: 0 0 0.9rem; }
    .rows { display: grid; gap: 0.5rem; max-width: 34rem; min-height: 6rem; }
    label { display: grid; grid-template-columns: 10rem 1fr; gap: 0.6rem; align-items: center; font-size: 0.9rem;
      font-weight: 600; color: var(--rm-text, #111827); }
    select { font: inherit; font-weight: 400; border: 1px solid var(--rm-border, #cbd5e1); border-radius: 8px;
      padding: 0.35rem 0.5rem; background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #111827); }
    .row { margin-top: 1rem; display: flex; gap: 0.6rem; align-items: center; }
    button { font: inherit; font-size: 0.85rem; font-weight: 600; border-radius: 8px; padding: 0.4rem 0.9rem; cursor: pointer;
      border: 1px solid var(--rm-accent, #2a9d8f); background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    button:focus-visible, select:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.86rem; }
    .saved { color: var(--rm-accent-strong, #1d6f65); font-size: 0.86rem; }
  `;

  constructor() {
    super();
    Object.assign(this, { readOnly: false, _teams: [], _candidates: [], _draft: {}, _loading: true, _busy: false, _error: '', _saved: false });
  }

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  async _load() {
    try {
      const { teamEms, people } = await loadTeamEms();
      const { teams, candidates } = teamEmChoices(people);
      Object.assign(this, { _teams: teams, _candidates: candidates, _draft: { ...teamEms }, _error: '' });
    } catch (err) {
      this._error = err.message;
    } finally {
      this._loading = false;
    }
  }

  render() {
    return html`
      <h2>EM por equipo</h2>
      <p class="note">Para todo lo que hace un EM (su ficha en Mi equipo, los O2O y revisar su carrera), los ICs y leads
        del equipo pasan a depender del EM que elijas aquí. El organigrama oficial sigue siendo el de Notion.</p>
      <div class="rows">
        ${this._loading ? html`<p class="note">Cargando equipos…</p>` : this._teams.map((team) => this._teamRow(team))}
      </div>
      ${this.readOnly ? null : html`<div class="row">
        <button type="button" ?disabled=${this._busy || this._loading} @click=${this._save}>Guardar</button>
        ${this._saved ? html`<span class="saved" role="status">Guardado. Se recalcula en unos segundos.</span>` : null}
      </div>`}
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      ${this._busy ? html`<busy-overlay message="Guardando el EM de cada equipo…"></busy-overlay>` : null}`;
  }

  _teamRow(team) {
    const current = this._draft[team] ?? '';
    return html`<label>${team}
      <select ?disabled=${this.readOnly} @change=${(e) => { this._draft = { ...this._draft, [team]: e.target.value }; this._saved = false; }}>
        <option value="" ?selected=${!current}>— El de Notion —</option>
        ${this._candidates.map((c) => html`<option value=${c.id} ?selected=${current === c.id}>${c.name}</option>`)}
      </select>
    </label>`;
  }

  async _save() {
    this._busy = true;
    this._error = '';
    try {
      await saveTeamEms(cleanTeamEms(this._draft, this._candidates.map((c) => c.id)));
      this._saved = true;
    } catch (err) {
      this._error = err.message;
    } finally {
      this._busy = false;
    }
  }
}

customElements.define('team-ems-editor', TeamEmsEditor);
