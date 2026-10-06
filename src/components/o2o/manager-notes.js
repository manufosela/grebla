/**
 * <manager-notes> — notas PRIVADAS del manager sobre una persona (RMR-TSK-0636):
 * sus performance reviews y cualquier texto que dé contexto, con la fecha en que
 * se hicieron. Vive como sub-pestaña «Privado» de sus O2O; la persona no lo ve
 * nunca (lo garantizan las reglas de /managerNotes, no esta pantalla).
 */
import { LitElement, html, css } from 'lit';
import { skeletonLines } from '../app-skeleton.js';
import { NOTE_TYPES } from '../../tools/o2o/domain/managerNotes.js';
import { listManagerNotes } from '../../lib/managerNotes.js';

const typeLabel = (id) => NOTE_TYPES.find((t) => t.id === id)?.label ?? id;

export class ManagerNotes extends LitElement {
  static properties = {
    personId: { attribute: 'person-id' },
    _notes: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.88rem; margin: 0 0 0.8rem; }
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
    this._error = '';
  }

  /** Al cambiar de persona se vacía ANTES de pintar: ni un fotograma con las notas de otra. */
  willUpdate(changed) {
    if (!changed.has('personId')) return;
    this._notes = [];
    this._error = '';
    this._loading = Boolean(this.personId);
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

  render() {
    return html`
      <p class="lead">Solo lo ven sus managers. La persona no tiene acceso a estas notas.</p>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : null}
      ${this._renderList()}`;
  }

  _renderList() {
    if (this._loading) return skeletonLines(3);
    if (!this._notes.length) return html`<p class="empty">Aún no hay notas privadas.</p>`;
    return html`<ul class="list">${this._notes.map((n) => this._renderNote(n))}</ul>`;
  }

  _renderNote(n) {
    return html`<li><details>
      <summary>${n.title} <span class="meta">· ${typeLabel(n.type)} · ${n.date}</span></summary>
      <p class="content">${n.content}</p>
    </details></li>`;
  }
}

if (!customElements.get('manager-notes')) customElements.define('manager-notes', ManagerNotes);
