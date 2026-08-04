/**
 * <library-app> — Biblioteca de la bodega (RMR-PCS-0033 · F2).
 *
 * Estantería de libros técnicos recomendados: físicos que se prestan indicando
 * quién los tiene y hasta cuándo se compromete a devolverlos (y leerlos), y
 * digitales con enlace directo. Peticiones para comprar (físicos) o subir
 * (digitales). El catálogo lo curan managers/superadmin (prop `canCurate`); el
 * préstamo lo firma cualquier persona logada con su PROPIA identidad — las
 * reglas anclan uid y nombre (ficha vinculada o token), aquí nunca hay texto
 * libre para el nombre.
 */
import { LitElement, html, css, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { getMyPerson } from '../../lib/engineer.js';
import {
  listBooks,
  saveBook,
  borrowBook,
  returnBook,
  listRequests,
  submitRequest,
  resolveRequest,
} from '../../lib/library.js';
import {
  validateBookInput,
  validateLoan,
  validateRequestInput,
  bookLoanStatus,
} from '../../tools/library/domain/library.js';

/** Fecha local ISO (YYYY-MM-DD) desplazada `days` días. @param {number} days */
const localIsoFromToday = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const EMPTY_BOOK_FORM = { id: null, title: '', author: '', format: 'physical', url: '', topics: '', recommended: false };
const EMPTY_REQUEST_FORM = { type: 'buy', title: '', author: '', reason: '' };

export class LibraryApp extends LitElement {
  static properties = {
    uid: { attribute: false },
    displayName: { attribute: false },
    canCurate: { attribute: false },
    _tab: { state: true },
    _books: { state: true },
    _requests: { state: true },
    _error: { state: true },
    _busy: { state: true },
    _borrowingId: { state: true },
    _dueDate: { state: true },
    _bookForm: { state: true },
    _requestForm: { state: true },
  };

  static styles = css`
    :host { display: block; max-width: 50rem; margin: 0 auto; }
    .seg { display: inline-flex; background: var(--rm-surface-hover, #eef3f5); border: 1px solid var(--rm-border, #dde7ec); border-radius: 999px; padding: 0.25rem; gap: 0.2rem; margin-bottom: 1.3rem; }
    .seg button { border: 0; background: transparent; font: inherit; font-size: 0.85rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); padding: 0.45rem 1.05rem; border-radius: 999px; cursor: pointer; }
    .seg button[aria-selected='true'] { background: var(--gr-teal, #2a9d8f); color: #0c1420; }
    .seg button:focus-visible { outline: 2px solid var(--gr-navy, #1e3a5f); outline-offset: 2px; }
    .error { background: color-mix(in srgb, #e76f51 12%, var(--rm-surface, #fff)); border: 1px solid #e76f51; border-radius: 8px; padding: 0.6rem 0.85rem; color: var(--rm-text, #111827); font-size: 0.88rem; }
    .empty { color: var(--rm-muted, #6b7280); }

    .shelf { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.8rem; }
    .book { border: 1px solid var(--rm-border, #e5e7eb); border-left: 4px solid var(--gr-navy, #1e3a5f); border-radius: var(--rm-radius, 12px); background: var(--rm-surface, #fff); padding: 0.85rem 1.1rem; }
    .book.inactive { opacity: 0.55; }
    .book header { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
    .book h3 { margin: 0; font-size: 0.98rem; color: var(--rm-navy, #1e3a5f); }
    .book .author { color: var(--rm-muted, #6b7280); font-size: 0.85rem; }
    .badge { font-size: 0.72rem; font-weight: 700; border-radius: 999px; padding: 0.12rem 0.55rem; }
    .badge.format { background: var(--rm-track, #e9f0f2); color: var(--rm-navy, #1e3a5f); }
    /* Colores FIJOS (legibles en claro y oscuro): chip sólido, no mezcla. */
    .badge.reco { background: #e9c46a; color: #4a3800; }
    .topics { margin: 0.3rem 0 0; display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .topics span { font-size: 0.74rem; background: var(--rm-surface-hover, #eef3f5); border-radius: 999px; padding: 0.1rem 0.5rem; color: var(--rm-muted, #5b6b7d); }
    .loan { margin: 0.55rem 0 0; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: 0.85rem; }
    .loan .who { color: var(--rm-text, #111827); }
    .loan.due-soon .who, .loan.overdue .who { border-radius: 6px; padding: 0.12rem 0.5rem; font-weight: 700; }
    .loan.due-soon .who { background: #e9c46a; color: #4a3800; }
    .loan.overdue .who { background: #e76f51; color: #3c0d00; }
    .btn { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); border-radius: 999px; font: inherit; font-size: 0.82rem; font-weight: 600; padding: 0.32rem 0.9rem; cursor: pointer; color: var(--rm-text, #111827); }
    .btn.primary { border: 0; background: var(--gr-teal, #2a9d8f); color: #0c1420; font-weight: 700; }
    .btn:disabled { opacity: 0.5; cursor: default; }
    a.open { color: var(--gr-teal, #2a9d8f); font-weight: 700; text-decoration: none; font-size: 0.85rem; }
    a.open:hover { text-decoration: underline; }

    .borrow { margin-top: 0.6rem; background: color-mix(in srgb, var(--gr-teal, #2a9d8f) 8%, var(--rm-surface, #fff)); border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; padding: 0.7rem 0.9rem; display: flex; flex-direction: column; gap: 0.55rem; }
    .borrow p { margin: 0; font-size: 0.84rem; color: var(--rm-text, #111827); }
    .borrow .row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .borrow input[type='date'] { font: inherit; font-size: 0.86rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; padding: 0.4rem 0.6rem; background: var(--rm-surface, #fff); color: var(--rm-text, #111827); }

    form.panel { border: 1px dashed var(--rm-border, #cbd5e1); border-radius: var(--rm-radius, 12px); padding: 0.9rem 1.1rem; margin-bottom: 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.7rem; align-items: end; }
    form.panel label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; font-weight: 600; color: var(--rm-navy, #1e3a5f); }
    form.panel input[type='text'], form.panel input[type='url'], form.panel select, form.panel textarea { font: inherit; font-size: 0.86rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; padding: 0.45rem 0.6rem; background: var(--rm-field, color-mix(in srgb, var(--rm-text, #111827) 4%, var(--rm-surface, #fff))); color: var(--rm-text, #111827); }
    form.panel .check { flex-direction: row; align-items: center; gap: 0.4rem; }
    form.panel .actions { display: flex; gap: 0.5rem; }

    .reqs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
    .req { border: 1px solid var(--rm-border, #e5e7eb); border-radius: var(--rm-radius, 12px); background: var(--rm-surface, #fff); padding: 0.7rem 1rem; display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
    .req .title { font-weight: 600; color: var(--rm-text, #111827); }
    .req .meta { color: var(--rm-muted, #6b7280); font-size: 0.82rem; }
    .req.resuelta { opacity: 0.55; }
    .req .spacer { flex: 1; }
    [hidden] { display: none; }
  `;

  constructor() {
    super();
    this.uid = null;
    this.displayName = null;
    this.canCurate = false;
    this._tab = 'shelf';
    /** @type {import('../../lib/library.js').LibraryBook[]|null} */
    this._books = null;
    /** @type {import('../../lib/library.js').LibraryRequest[]|null} */
    this._requests = null;
    this._error = null;
    this._busy = false;
    /** Libro con el panel «Llévatelo» abierto, o null. */
    this._borrowingId = null;
    this._dueDate = localIsoFromToday(21);
    this._bookForm = null;
    this._requestForm = { ...EMPTY_REQUEST_FORM };
    /** @type {(import('../../lib/engineer.js') extends never ? never : { id: string, name: string })|null|undefined} */
    this._person = undefined;
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    if (changed.has('uid') && this.uid) this._load();
  }

  async _load() {
    try {
      const [books, requests, person] = await Promise.all([
        listBooks(),
        listRequests(),
        getMyPerson(this.uid),
      ]);
      this._books = books;
      this._requests = requests;
      this._person = person;
      this._error = null;
    } catch (err) {
      console.error('[biblioteca] no se pudo cargar:', err);
      this._books = this._books ?? [];
      this._requests = this._requests ?? [];
      this._error = 'No se pudo cargar la biblioteca. Recarga para reintentar.';
    }
  }

  /** Identidad con la que se firma (la que exigen las reglas): la ficha
   * vinculada, o el nombre de la cuenta si no hay ficha. */
  get _self() {
    if (this._person) return { personId: this._person.id, personName: this._person.name };
    return { personId: null, personName: this.displayName ?? null };
  }

  async _borrow(book) {
    const { personId, personName } = this._self;
    let loan;
    try {
      loan = validateLoan({ personId, personName, dueDate: this._dueDate }, new Date());
    } catch (err) {
      this._error = err.message;
      return;
    }
    this._busy = true;
    this._error = null;
    try {
      await borrowBook(book.id, loan, this.uid);
      this._borrowingId = null;
      await this._load();
    } catch (err) {
      console.error('[biblioteca] no se pudo prestar:', err);
      this._error = 'No se pudo registrar el préstamo. Inténtalo de nuevo.';
    } finally {
      this._busy = false;
    }
  }

  async _return(book) {
    this._busy = true;
    this._error = null;
    try {
      await returnBook(book.id);
      await this._load();
    } catch (err) {
      console.error('[biblioteca] no se pudo devolver:', err);
      this._error = 'No se pudo registrar la devolución. Inténtalo de nuevo.';
    } finally {
      this._busy = false;
    }
  }

  async _saveBook(event) {
    event.preventDefault();
    const form = this._bookForm;
    let book;
    try {
      book = validateBookInput({
        ...form,
        topics: form.topics.split(',').map((t) => t.trim()).filter(Boolean),
      });
    } catch (err) {
      this._error = err.message;
      return;
    }
    this._busy = true;
    this._error = null;
    try {
      await saveBook(form.id, book);
      this._bookForm = null;
      await this._load();
    } catch (err) {
      console.error('[biblioteca] no se pudo guardar el libro:', err);
      this._error = 'No se pudo guardar el libro. ¿Tienes permisos de gestión?';
    } finally {
      this._busy = false;
    }
  }

  async _toggleActive(book) {
    this._busy = true;
    try {
      await saveBook(book.id, { active: !book.active });
      await this._load();
    } catch (err) {
      console.error('[biblioteca] no se pudo cambiar el estado:', err);
      this._error = 'No se pudo cambiar el estado del libro.';
    } finally {
      this._busy = false;
    }
  }

  async _submitRequest(event) {
    event.preventDefault();
    let request;
    try {
      request = validateRequestInput(this._requestForm);
    } catch (err) {
      this._error = err.message;
      return;
    }
    const { personId, personName } = this._self;
    if (!personName) {
      this._error = 'Tu cuenta no tiene nombre visible: pide a un superadmin que te vincule una ficha.';
      return;
    }
    this._busy = true;
    this._error = null;
    try {
      await submitRequest(request, { uid: this.uid, personId, name: personName });
      this._requestForm = { ...EMPTY_REQUEST_FORM };
      await this._load();
    } catch (err) {
      console.error('[biblioteca] no se pudo enviar la petición:', err);
      this._error = 'No se pudo enviar la petición. Inténtalo de nuevo.';
    } finally {
      this._busy = false;
    }
  }

  async _resolve(request) {
    this._busy = true;
    try {
      await resolveRequest(request.id);
      await this._load();
    } catch (err) {
      console.error('[biblioteca] no se pudo resolver:', err);
      this._error = 'No se pudo marcar como resuelta.';
    } finally {
      this._busy = false;
    }
  }

  _renderLoan(book) {
    const status = bookLoanStatus(book, new Date());
    if (book.format === 'digital') {
      return html`<p class="loan">
        <a class="open" href=${book.url} target="_blank" rel="noopener noreferrer">Abrir el libro ↗</a>
      </p>`;
    }
    if (status === 'free') {
      return html`<div class="loan">
        ${this._borrowingId === book.id
          ? nothing
          : html`<button class="btn primary" @click=${() => { this._borrowingId = book.id; }}>Llévatelo</button>`}
      </div>
      ${this._borrowingId === book.id ? this._renderBorrowPanel(book) : nothing}`;
    }
    const mine = book.borrowedByUid === this.uid;
    return html`<p class="loan ${status}">
      <span class="who">${mine ? 'Lo tienes tú' : `Lo tiene ${book.borrowedByName}`} · hasta el ${book.dueDate}${status === 'overdue' ? ' (vencido)' : ''}</span>
      ${mine || this.canCurate
        ? html`<button class="btn" ?disabled=${this._busy} @click=${() => this._return(book)}>Devolver</button>`
        : nothing}
    </p>`;
  }

  _renderBorrowPanel(book) {
    return html`<div class="borrow">
      <p>
        Me llevo <strong>«${book.title}»</strong> y me comprometo a leerlo y
        devolverlo como muy tarde el día que elijo. Mi nombre quedará visible en
        la estantería.
      </p>
      <div class="row">
        <input
          type="date"
          .value=${this._dueDate}
          min=${localIsoFromToday(1)}
          @change=${(e) => { this._dueDate = e.target.value; }}
          aria-label="Fecha máxima de devolución"
        />
        <button class="btn primary" ?disabled=${this._busy} @click=${() => this._borrow(book)}>
          ${this._busy ? 'Registrando…' : 'Me lo llevo'}
        </button>
        <button class="btn" @click=${() => { this._borrowingId = null; }}>Cancelar</button>
      </div>
    </div>`;
  }

  _renderBookForm() {
    const form = this._bookForm;
    return html`<form class="panel" @submit=${this._saveBook}>
      <label>Título
        <input type="text" required .value=${form.title} @input=${(e) => { this._bookForm = { ...form, title: e.target.value }; }} />
      </label>
      <label>Autoría
        <input type="text" .value=${form.author} @input=${(e) => { this._bookForm = { ...form, author: e.target.value }; }} />
      </label>
      <label>Formato
        <select data-field="format" @change=${(e) => { this._bookForm = { ...form, format: e.target.value }; }}>
          <option value="physical">Físico (se presta)</option>
          <option value="digital">Digital (enlace)</option>
        </select>
      </label>
      ${form.format === 'digital'
        ? html`<label>Enlace
            <input type="url" required placeholder="https://…" .value=${form.url} @input=${(e) => { this._bookForm = { ...form, url: e.target.value }; }} />
          </label>`
        : nothing}
      <label>Temas (coma)
        <input type="text" placeholder="arquitectura, testing" .value=${form.topics} @input=${(e) => { this._bookForm = { ...form, topics: e.target.value }; }} />
      </label>
      <label class="check">
        <input type="checkbox" .checked=${form.recommended} @change=${(e) => { this._bookForm = { ...form, recommended: e.target.checked }; }} />
        ⭐ Recomendado
      </label>
      <div class="actions">
        <button class="btn primary" type="submit" ?disabled=${this._busy}>${form.id ? 'Guardar' : 'Añadir'}</button>
        <button class="btn" type="button" @click=${() => { this._bookForm = null; }}>Cancelar</button>
      </div>
    </form>`;
  }

  _renderShelf() {
    if (this._books === null) return html`<p class="empty">Abriendo la bodega…</p>`;
    const books = this._books
      .filter((b) => this.canCurate || b.active)
      .toSorted((a, b) => Number(b.recommended) - Number(a.recommended) || a.title.localeCompare(b.title, 'es'));
    return html`
      ${this.canCurate && !this._bookForm
        ? html`<p><button class="btn" @click=${() => { this._bookForm = { ...EMPTY_BOOK_FORM }; }}>➕ Añadir libro</button></p>`
        : nothing}
      ${this._bookForm ? this._renderBookForm() : nothing}
      ${books.length === 0
        ? html`<p class="empty">La bodega está vacía todavía. Pide el primer libro en «Peticiones».</p>`
        : html`<ul class="shelf">
            ${repeat(
              books,
              (b) => b.id,
              (b) => html`<li class="book ${b.active ? '' : 'inactive'}">
                <header>
                  <h3>${b.title}</h3>
                  ${b.author ? html`<span class="author">${b.author}</span>` : nothing}
                  ${b.recommended ? html`<span class="badge reco">⭐ recomendado</span>` : nothing}
                  <span class="badge format">${b.format === 'digital' ? '💻 digital' : '📕 físico'}</span>
                  ${this.canCurate
                    ? html`<button class="btn" title="Editar" @click=${() => {
                        this._bookForm = { id: b.id, title: b.title, author: b.author ?? '', format: b.format, url: b.url ?? '', topics: b.topics.join(', '), recommended: b.recommended };
                      }}>✏️</button>
                      <button class="btn" title=${b.active ? 'Retirar de la estantería' : 'Reponer'} @click=${() => this._toggleActive(b)}>${b.active ? '📤 Retirar' : '📥 Reponer'}</button>`
                    : nothing}
                </header>
                ${b.topics.length > 0 ? html`<p class="topics">${b.topics.map((t) => html`<span>${t}</span>`)}</p>` : nothing}
                ${this._renderLoan(b)}
              </li>`,
            )}
          </ul>`}
    `;
  }

  _renderRequests() {
    if (this._requests === null) return html`<p class="empty">Cargando peticiones…</p>`;
    const requests = this._requests.toSorted(
      (a, b) => (a.status === b.status ? (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0) : a.status === 'abierta' ? -1 : 1),
    );
    const form = this._requestForm;
    return html`
      <form class="panel" @submit=${this._submitRequest}>
        <label>Tipo
          <select data-field="type" @change=${(e) => { this._requestForm = { ...form, type: e.target.value }; }}>
            <option value="buy">🛒 Comprar (físico)</option>
            <option value="upload">⬆️ Subir/enlazar (digital)</option>
          </select>
        </label>
        <label>Título
          <input type="text" required .value=${form.title} @input=${(e) => { this._requestForm = { ...form, title: e.target.value }; }} />
        </label>
        <label>Autoría
          <input type="text" .value=${form.author} @input=${(e) => { this._requestForm = { ...form, author: e.target.value }; }} />
        </label>
        <label>¿Por qué?
          <input type="text" placeholder="opcional" .value=${form.reason} @input=${(e) => { this._requestForm = { ...form, reason: e.target.value }; }} />
        </label>
        <div class="actions">
          <button class="btn primary" type="submit" ?disabled=${this._busy}>Pedir</button>
        </div>
      </form>
      ${requests.length === 0
        ? html`<p class="empty">Sin peticiones. ¿Qué libro nos falta?</p>`
        : html`<ul class="reqs">
            ${repeat(
              requests,
              (r) => r.id,
              (r) => html`<li class="req ${r.status}">
                <span class="title">${r.title}</span>
                ${r.author ? html`<span class="meta">${r.author}</span>` : nothing}
                <span class="badge format">${r.type === 'upload' ? '⬆️ subir' : '🛒 comprar'}</span>
                <span class="meta">pide ${r.requestedByName}${r.reason ? ` — ${r.reason}` : ''}</span>
                <span class="spacer"></span>
                ${r.status === 'resuelta'
                  ? html`<span class="meta">✔ resuelta</span>`
                  : this.canCurate
                    ? html`<button class="btn" ?disabled=${this._busy} @click=${() => this._resolve(r)}>Marcar resuelta</button>`
                    : nothing}
              </li>`,
            )}
          </ul>`}
    `;
  }

  /** Gotcha de Lit: los select con opciones en la misma plantilla no reflejan
   * su value — sincronizar tras render. */
  updated() {
    const formatSelect = this.renderRoot.querySelector('select[data-field="format"]');
    if (formatSelect && this._bookForm && formatSelect.value !== this._bookForm.format) {
      formatSelect.value = this._bookForm.format;
    }
    const typeSelect = this.renderRoot.querySelector('select[data-field="type"]');
    if (typeSelect && typeSelect.value !== this._requestForm.type) {
      typeSelect.value = this._requestForm.type;
    }
  }

  render() {
    return html`
      <div class="seg" role="tablist" aria-label="Biblioteca">
        <button role="tab" aria-selected=${this._tab === 'shelf'} @click=${() => { this._tab = 'shelf'; }}>Estantería</button>
        <button role="tab" aria-selected=${this._tab === 'requests'} @click=${() => { this._tab = 'requests'; }}>Peticiones</button>
      </div>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : nothing}
      <div ?hidden=${this._tab !== 'shelf'}>${this._renderShelf()}</div>
      <div ?hidden=${this._tab !== 'requests'}>${this._renderRequests()}</div>
    `;
  }
}

if (!customElements.get('library-app')) {
  customElements.define('library-app', LibraryApp);
}
