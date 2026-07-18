/**
 * <motivators-rounds-admin> — panel del superadmin para gestionar las rondas de un
 * juego: crear (con ventana de días), activar y cerrar. El cierre real también se
 * deriva de las fechas; «cerrar» aquí desactiva la ronda antes de tiempo.
 */
import { LitElement, html, css } from 'lit';
import { listRounds, createRound, setRoundActive, updateRound, deleteRound } from '../../tools/motivators/application/usecases.js';
import { roundStatus, dayWindowToIso } from '../../tools/motivators/domain/rounds.js';
import { accentStyle } from './accent.js';
import '../app-modal.js';

const DAY_FMT = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const STATUS_LABEL = { open: 'Abierta', upcoming: 'Próxima', closed: 'Cerrada' };

/** Fecha (Date) → YYYY-MM-DD (UTC). */
function ymd(date) {
  return date.toISOString().slice(0, 10);
}

export class MotivatorsRoundsAdmin extends LitElement {
  static properties = {
    persistence: { attribute: false },
    game: { type: String },
    accent: { type: String },
    createdBy: { type: String },
    _rounds: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _flash: { state: true },
    _busy: { state: true },
    _name: { state: true },
    _start: { state: true },
    _end: { state: true },
    _editingId: { state: true },
    _confirmDelete: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .form { display: grid; gap: 0.6rem; border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; padding: 1rem; margin: 0 0 1.25rem; }
    .row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: end; }
    .field { display: grid; gap: 0.25rem; }
    label { font-size: 0.78rem; color: var(--rm-muted, #6b7280); font-weight: 600; }
    input { font: inherit; padding: 0.4rem 0.55rem; border-radius: 8px; border: 1px solid var(--rm-border, #d1d5db);
      background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827); }
    input[type="text"] { min-width: 220px; }
    .create { border: none; background: var(--accent); color: var(--accent-on); border-radius: 8px;
      padding: 0.5rem 1.1rem; font: inherit; font-weight: 800; cursor: pointer; }
    .create:disabled { opacity: 0.5; cursor: progress; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; margin: 0.2rem 0 0; }
    .flash { color: var(--rm-success, #16a34a); font-size: 0.85rem; margin: 0.2rem 0 0; }
    .editing { margin: 0; font-size: 0.82rem; font-weight: 700; color: var(--accent-ink); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    .item { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: 10px; padding: 0.6rem 0.85rem; }
    .item .name { font-weight: 700; color: var(--rm-text, #111827); }
    .item .dates { color: var(--rm-muted, #6b7280); font-size: 0.85rem; }
    .badge { font-size: 0.72rem; font-weight: 800; border-radius: 999px; padding: 0.1rem 0.55rem; }
    .badge.open { background: var(--rm-success, #16a34a); color: #fff; }
    .badge.upcoming { background: var(--accent-soft); color: var(--accent-ink); }
    .badge.closed { background: var(--rm-chip, #eef2f7); color: var(--rm-muted, #6b7280); }
    .spacer { flex: 1 1 auto; }
    .toggle { border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.3rem 0.8rem; font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; }
    .toggle:hover { border-color: var(--accent); color: var(--accent-ink); }
    .toggle.danger { color: var(--rm-danger, #dc2626); }
    .toggle.danger:hover { border-color: var(--rm-danger, #dc2626); color: var(--rm-danger, #dc2626); }
    .empty { color: var(--rm-muted, #6b7280); font-size: 0.9rem; }
    .confirm-text { color: var(--rm-text, #111827); line-height: 1.5; margin: 0 0 1rem; }
    .confirm-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
    .danger-btn { background: var(--rm-danger, #dc2626); }
  `;

  constructor() {
    super();
    this.persistence = null;
    this.game = 'moving_motivators';
    this.accent = 'teal';
    this.createdBy = '';
    this._rounds = null;
    this._loading = false;
    this._error = '';
    this._flash = '';
    this._busy = false;
    const today = new Date();
    const in3 = new Date(today.getTime() + 3 * 24 * 3600 * 1000);
    this._name = '';
    this._start = ymd(today);
    this._end = ymd(in3);
    this._editingId = null;
    this._confirmDelete = null;
    this._loaded = false;
  }

  updated(changed) {
    if (changed.has('persistence') && this.persistence && !this._loaded) {
      this._loaded = true;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      const rounds = await listRounds(this.persistence, this.game);
      this._rounds = rounds.toSorted((a, b) => String(b.startAt).localeCompare(String(a.startAt)));
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudieron cargar las rondas.';
    } finally {
      this._loading = false;
    }
  }

  async _submit() {
    if (this._busy) return;
    this._busy = true;
    this._error = '';
    this._flash = '';
    try {
      const { startAt, endAt } = dayWindowToIso(this._start, this._end);
      if (this._editingId) {
        await updateRound(this.persistence, this._editingId, { name: this._name, startAt, endAt });
        this._flash = 'Ronda actualizada.';
        this._resetForm();
      } else {
        await createRound(this.persistence, { game: this.game, name: this._name, startAt, endAt, createdBy: this.createdBy });
        this._flash = 'Ronda creada.';
        this._name = '';
      }
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar la ronda.';
    } finally {
      this._busy = false;
    }
  }

  _startEdit(round) {
    this._editingId = round.id;
    this._name = round.name;
    this._start = String(round.startAt).slice(0, 10);
    this._end = String(round.endAt).slice(0, 10);
    this._error = '';
    this._flash = '';
  }

  _resetForm() {
    this._editingId = null;
    this._name = '';
    const today = new Date();
    this._start = ymd(today);
    this._end = ymd(new Date(today.getTime() + 3 * 24 * 3600 * 1000));
  }

  async _toggle(round) {
    this._error = '';
    try {
      await setRoundActive(this.persistence, round.id, round.active === false);
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cambiar la ronda.';
    }
  }

  async _confirmedDelete() {
    const round = this._confirmDelete;
    if (!round || this._busy) return;
    this._busy = true;
    this._error = '';
    this._flash = '';
    try {
      await deleteRound(this.persistence, round.id);
      this._confirmDelete = null;
      if (this._editingId === round.id) this._resetForm();
      this._flash = 'Ronda borrada.';
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar la ronda.';
    } finally {
      this._busy = false;
    }
  }

  render() {
    const rounds = this._rounds ?? [];
    return html`<div style=${accentStyle(this.accent)}>
      ${this._renderForm()}
      ${this._loading && !this._rounds ? html`<p class="empty">Cargando rondas…</p>` : this._renderList(rounds)}
      ${this._renderConfirm()}
    </div>`;
  }

  _renderForm() {
    const editing = !!this._editingId;
    return html`<div class="form">
      ${editing ? html`<p class="editing">Editando la ronda seleccionada</p>` : null}
      <div class="row">
        <div class="field">
          <label for="rn">Nombre de la ronda</label>
          <input id="rn" type="text" .value=${this._name} @input=${(e) => { this._name = e.target.value; }} placeholder="p. ej. Julio 2026" />
        </div>
        <div class="field">
          <label for="rs">Inicio</label>
          <input id="rs" type="date" .value=${this._start} @input=${(e) => { this._start = e.target.value; }} />
        </div>
        <div class="field">
          <label for="re">Fin</label>
          <input id="re" type="date" .value=${this._end} @input=${(e) => { this._end = e.target.value; }} />
        </div>
        <button class="create" ?disabled=${this._busy || !this._name.trim()} @click=${this._submit}>${editing ? 'Guardar cambios' : 'Crear ronda'}</button>
        ${editing ? html`<button class="toggle" @click=${this._resetForm}>Cancelar</button>` : null}
      </div>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${this._flash ? html`<p class="flash">${this._flash}</p>` : null}
    </div>`;
  }

  _renderList(rounds) {
    if (rounds.length === 0) return html`<p class="empty">Aún no hay rondas para este juego. Crea la primera arriba.</p>`;
    return html`<ul>${rounds.map((r) => this._renderRound(r))}</ul>`;
  }

  _renderRound(round) {
    const status = roundStatus(round);
    const range = `${DAY_FMT.format(new Date(round.startAt))} – ${DAY_FMT.format(new Date(round.endAt))}`;
    return html`<li class="item">
      <span class="name">${round.name}</span>
      <span class="dates">${range}</span>
      <span class="badge ${status}">${STATUS_LABEL[status]}</span>
      <span class="spacer"></span>
      <button class="toggle" @click=${() => this._startEdit(round)}>Editar</button>
      <button class="toggle" @click=${() => this._toggle(round)}>${round.active === false ? 'Activar' : 'Cerrar'}</button>
      <button class="toggle danger" @click=${() => { this._confirmDelete = round; }}>Borrar</button>
    </li>`;
  }

  _renderConfirm() {
    const round = this._confirmDelete;
    return html`<app-modal .open=${!!round} heading="Borrar ronda" @close=${() => { this._confirmDelete = null; }}>
      ${round ? html`<p class="confirm-text">Vas a borrar la ronda <strong>«${round.name}»</strong> y <strong>todas las participaciones</strong> de quienes la completaron. Esta acción no se puede deshacer.</p>
      <div class="confirm-actions">
        <button class="toggle" @click=${() => { this._confirmDelete = null; }}>Cancelar</button>
        <button class="create danger-btn" ?disabled=${this._busy} @click=${this._confirmedDelete}>Borrar definitivamente</button>
      </div>` : null}
    </app-modal>`;
  }
}

if (!customElements.get('motivators-rounds-admin')) {
  customElements.define('motivators-rounds-admin', MotivatorsRoundsAdmin);
}
