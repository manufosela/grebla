/**
 * <manager-notes> — notas PRIVADAS del manager sobre una persona (RMR-TSK-0636):
 * sus performance reviews y cualquier texto que dé contexto, con la fecha en que
 * se hicieron. Vive como sub-pestaña «Privado» de sus O2O; la persona no lo ve
 * nunca (lo garantizan las reglas de /managerNotes, no esta pantalla).
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import '../common/busy-overlay.js';
import { NOTE_TYPES, noteErrors } from '../../tools/o2o/domain/managerNotes.js';
import { listManagerNotes, addManagerNote, updateManagerNote, deleteManagerNote } from '../../lib/managerNotes.js';

const EMPTY_DRAFT = Object.freeze({ type: 'perf-review', date: '', title: '', content: '' });
const typeLabel = (id) => NOTE_TYPES.find((t) => t.id === id)?.label ?? id;

export class ManagerNotes extends LitElement {
  static properties = {
    personId: { attribute: 'person-id' },
    _notes: { state: true },
    _loading: { state: true },
    _draft: { state: true },
    _editingId: { state: true },
    _busy: { state: true },
    _error: { state: true },
    _confirmDelete: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; margin: 0 0 0.8rem; }
    .form { display: grid; gap: 0.6rem; border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.8rem; margin-bottom: 1rem; }
    .row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: end; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); }
    select, input, textarea {
      font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--rm-border, #d1d5db);
      border-radius: 8px; background: var(--rm-field, #eef2f6); color: var(--rm-text, #111827);
    }
    textarea { min-height: 10rem; resize: vertical; }
    .grow { flex: 1; min-width: 14rem; }
    .btn {
      border: 1px solid var(--rm-border, #d1d5db); background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
      border-radius: 8px; padding: 0.45rem 0.9rem; font: inherit; font-weight: 600; cursor: pointer;
    }
    .btn.primary { background: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); }
    .btn.danger { color: var(--rm-danger, #dc2626); border-color: var(--rm-danger, #dc2626); }
    .actions { display: flex; gap: 0.4rem; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
    details { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 10px; padding: 0.55rem 0.85rem; }
    summary { cursor: pointer; font-weight: 600; }
    .meta { font-weight: 400; color: var(--rm-muted, #5b6b7d); font-size: 0.85rem; }
    .content { white-space: pre-wrap; margin: 0.6rem 0; font-size: 0.92rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }
    .empty { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
  `;

  constructor() {
    super();
    this.personId = '';
    this._notes = [];
    this._loading = true;
    this._draft = { ...EMPTY_DRAFT };
    this._editingId = null;
    this._busy = '';
    this._error = '';
    this._confirmDelete = null;
  }

  /** Al cambiar de persona se vacía ANTES de pintar: ni un fotograma con las notas de otra, ni su edición a medias. */
  willUpdate(changed) {
    if (!changed.has('personId')) return;
    this._notes = [];
    this._error = '';
    this._loading = Boolean(this.personId);
    this._editingId = null;
    this._draft = { ...EMPTY_DRAFT };
    this._confirmDelete = null;
  }

  updated(changed) {
    if (changed.has('personId') && this.personId) this._load();
  }

  async _load() {
    // Al cambiar de persona no puede quedar a la vista lo de la anterior, ni
    // pintarse una respuesta que llegue tarde de otra persona.
    const personId = this.personId;
    this._notes = [];
    this._loading = true;
    this._error = '';
    try {
      const notes = await listManagerNotes(personId);
      if (personId === this.personId) this._notes = notes;
    } catch (err) {
      if (personId === this.personId) this._error = `No se pudieron cargar las notas privadas: ${err.message}`;
    } finally {
      if (personId === this.personId) this._loading = false;
    }
  }

  _set(field, value) { this._draft = { ...this._draft, [field]: value }; }

  _edit(note) {
    this._editingId = note.id;
    this._draft = { type: note.type, date: note.date, title: note.title ?? '', content: note.content ?? '' };
    this._error = '';
  }

  _cancel() { this._editingId = null; this._draft = { ...EMPTY_DRAFT }; this._error = ''; }

  async _save() {
    const [problem] = noteErrors(this._draft);
    if (problem) { this._error = problem; return; }
    await this._write('Guardando la nota…', async () => {
      if (this._editingId) await updateManagerNote(this.personId, this._editingId, this._draft);
      else await addManagerNote(this.personId, this._draft);
      this._cancel();
    });
  }

  async _delete(note) {
    await this._write('Borrando la nota…', async () => {
      await deleteManagerNote(this.personId, note.id);
      this._confirmDelete = null;
    });
  }

  /** Toda escritura bloquea la pantalla, recarga la lista y, si falla, lo dice. */
  async _write(message, work) {
    this._busy = message;
    this._error = '';
    try {
      await work();
      await this._load();
    } catch (err) {
      this._error = err.message;
    } finally {
      this._busy = '';
    }
  }

  render() {
    return html`
      ${this._busy ? html`<busy-overlay message=${this._busy}></busy-overlay>` : null}
      <p class="lead">Solo lo ven sus managers. La persona no tiene acceso a estas notas.</p>
      ${this._renderForm()}
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      ${this._renderList()}`;
  }

  _renderForm() {
    const d = this._draft;
    return html`<div class="form">
      <div class="row">
        <label>Tipo
          <select @change=${(e) => this._set('type', e.target.value)}>
            ${NOTE_TYPES.map((t) => html`<option value=${t.id} ?selected=${t.id === d.type}>${t.label}</option>`)}
          </select>
        </label>
        <label>Fecha en que se hizo
          <input type="date" .value=${d.date} @input=${(e) => this._set('date', e.target.value)} />
        </label>
        <label class="grow">Título
          <input type="text" .value=${d.title} placeholder=${typeLabel(d.type)} @input=${(e) => this._set('title', e.target.value)} />
        </label>
      </div>
      <label>Contenido
        <textarea .value=${d.content} @input=${(e) => this._set('content', e.target.value)}></textarea>
      </label>
      <div class="actions">
        <button class="btn primary" @click=${() => this._save()}>${this._editingId ? 'Guardar cambios' : 'Añadir nota'}</button>
        ${this._editingId ? html`<button class="btn" @click=${() => this._cancel()}>Cancelar</button>` : null}
      </div>
    </div>`;
  }

  _renderList() {
    if (this._loading) return skeletonLines(3);
    if (!this._notes.length) return html`<p class="empty">Aún no hay notas privadas.</p>`;
    return html`<ul class="list">${this._notes.map((n) => this._renderNote(n))}</ul>`;
  }

  _renderNote(n) {
    const confirming = this._confirmDelete === n.id;
    const deleteButtons = confirming
      ? html`<button class="btn danger" @click=${() => this._delete(n)}>Confirmar borrado</button>
          <button class="btn" @click=${() => { this._confirmDelete = null; }}>Cancelar</button>`
      : html`<button class="btn danger" @click=${() => { this._confirmDelete = n.id; }}>Borrar</button>`;
    return html`<li><details>
      <summary>${n.title} <span class="meta">· ${typeLabel(n.type)} · ${n.date}</span></summary>
      <p class="content">${n.content}</p>
      <div class="actions"><button class="btn" @click=${() => this._edit(n)}>Editar</button>${deleteButtons}</div>
    </details></li>`;
  }
}

if (!customElements.get('manager-notes')) customElements.define('manager-notes', ManagerNotes);
