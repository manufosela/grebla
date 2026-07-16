/**
 * <retro-board> — tablero colaborativo de una retro (RMR-TSK-0244). Pinta las
 * columnas (formato clásico) o las zonas del Barco con las notas ANÓNIMAS del
 * equipo. Cualquiera añade notas y vota (voters idempotente; el recuento =
 * voters.length); cada uno edita/borra solo las suyas. Si la retro está cerrada,
 * es de solo lectura.
 *
 * Props: retroId, uid (usuario logado).
 */
import { LitElement, html, css } from 'lit';
import { getFormat } from '../../tools/retro/domain/formats.js';
import { getRetro, listNotes, addNote, voteNote, unvoteNote, editNote, deleteNote } from '../../lib/retros.js';

/** Emoji de cada zona del Barco. */
const BARCO_ICON = { viento: '🌬️', ancla: '⚓', rocas: '🪨', isla: '🏝️' };

export class RetroBoard extends LitElement {
  static properties = {
    retroId: { attribute: false },
    uid: { attribute: false },
    _retro: { state: true },
    _notes: { state: true },
    _drafts: { state: true },
    _editingId: { state: true },
    _editText: { state: true },
    _loading: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; --teal: var(--rm-accent, #2a9d8f); --coral: var(--gr-coral, #f2887a); --navy: var(--gr-navy, #1e3a5f); --amber: #d1902f; }
    .head { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .head h2 { margin: 0; font-size: 1.15rem; }
    .chip { font-size: 0.7rem; font-weight: 700; padding: 0.12rem 0.55rem; border-radius: 999px; }
    .chip.fmt { background: color-mix(in srgb, var(--navy) 14%, transparent); color: var(--navy); }
    .chip.open { background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .chip.closed { background: var(--rm-surface-hover, #eef3f5); color: var(--rm-muted, #5b6b7d); }
    .ro-note { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 1rem; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.85rem; }

    .board { display: grid; gap: 1rem; grid-template-columns: repeat(var(--cols, 3), 1fr); }
    .barco { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
    @media (max-width: 760px) { .board, .barco { grid-template-columns: 1fr; } }

    .col, .zone { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #dde7ec); border-radius: 14px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.55rem; }
    .col-h { display: flex; align-items: center; gap: 0.45rem; font-weight: 700; font-size: 0.92rem; }
    .col-h .dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; }
    .a-teal { color: var(--rm-accent-700, var(--teal)); } .a-teal .dot { background: var(--teal); } .zone.a-teal { border-top: 4px solid var(--teal); }
    .a-coral { color: var(--coral); } .a-coral .dot { background: var(--coral); } .zone.a-coral { border-top: 4px solid var(--coral); }
    .a-navy { color: var(--navy); } .a-navy .dot { background: var(--navy); } .zone.a-navy { border-top: 4px solid var(--navy); }
    .a-amber { color: var(--amber); } .a-amber .dot { background: var(--amber); } .zone.a-amber { border-top: 4px solid var(--amber); }
    .zhint { font-size: 0.72rem; color: var(--rm-muted, #5b6b7d); margin: -0.3rem 0 0.2rem; }

    .note { background: var(--rm-surface-2, #f5fafa); border: 1px solid var(--rm-border, #e7f0f0); border-radius: 10px; padding: 0.55rem 0.65rem; font-size: 0.85rem; }
    .note .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 0.45rem; gap: 0.4rem; }
    .anon { font-size: 0.68rem; color: var(--rm-muted, #5b6b7d); }
    .n-actions { display: inline-flex; gap: 0.35rem; align-items: center; }
    .vote { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); border-radius: 999px; font: inherit; font-size: 0.72rem; font-weight: 700; padding: 0.12rem 0.5rem; cursor: pointer; color: var(--rm-text, #1e3a5f); font-variant-numeric: tabular-nums; }
    .vote.voted { border-color: var(--teal); background: color-mix(in srgb, var(--teal) 14%, transparent); color: var(--rm-accent-700, var(--teal)); }
    .mini { border: 0; background: none; cursor: pointer; font-size: 0.72rem; color: var(--rm-muted, #5b6b7d); font-weight: 600; padding: 0 0.15rem; }
    .mini:hover { color: var(--navy); } .mini.del:hover { color: var(--rm-danger, #dc2626); }
    .add { display: flex; gap: 0.35rem; }
    .add input { flex: 1; min-width: 0; font: inherit; font-size: 0.82rem; padding: 0.4rem 0.55rem; border: 1px dashed var(--rm-border, #dde7ec); border-radius: 9px; background: transparent; color: var(--rm-text, #1e3a5f); }
    .add input:focus-visible { outline: 2px solid var(--teal); outline-offset: 1px; border-style: solid; }
    .add button, .edit button { border: 0; background: var(--teal); color: #0c1420; border-radius: 8px; font: inherit; font-weight: 700; font-size: 0.78rem; padding: 0.35rem 0.6rem; cursor: pointer; }
    .add button:disabled { opacity: 0.5; cursor: not-allowed; }
    .edit { display: flex; gap: 0.35rem; }
    .edit input { flex: 1; min-width: 0; font: inherit; font-size: 0.82rem; padding: 0.35rem 0.5rem; border: 1px solid var(--teal); border-radius: 8px; background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); }
    .edit .ghost { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #dde7ec); color: var(--rm-text, #1e3a5f); }
    .empty { font-size: 0.78rem; color: var(--rm-muted, #9ca3af); }
  `;

  constructor() {
    super();
    this.retroId = null;
    this.uid = null;
    this._retro = null;
    this._notes = [];
    this._drafts = {};
    this._editingId = null;
    this._editText = '';
    this._loading = false;
    this._error = '';
    this._loadedFor = null;
  }

  updated(changed) {
    if (changed.has('retroId') && this.retroId && this.retroId !== this._loadedFor) {
      this._loadedFor = this.retroId;
      this._load();
    }
  }

  async _load() {
    this._loading = true;
    this._error = '';
    try {
      const [retro, notes] = await Promise.all([getRetro(this.retroId), listNotes(this.retroId)]);
      this._retro = retro;
      this._notes = notes;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cargar el tablero.';
    } finally {
      this._loading = false;
    }
  }

  get _open() { return this._retro?.status === 'open'; }

  _notesFor(columnId) {
    return this._notes
      .filter((n) => n.columnId === columnId)
      .toSorted((a, b) => (b.voters?.length ?? 0) - (a.voters?.length ?? 0));
  }

  async _addNote(columnId) {
    const text = (this._drafts[columnId] ?? '').trim();
    if (!text || !this.uid) return;
    this._error = '';
    try {
      await addNote(this.retroId, columnId, text, this.uid);
      this._drafts = { ...this._drafts, [columnId]: '' };
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo añadir la nota.';
    }
  }

  async _toggleVote(note) {
    if (!this.uid) return;
    const voted = (note.voters ?? []).includes(this.uid);
    try {
      await (voted ? unvoteNote(this.retroId, note.id, this.uid) : voteNote(this.retroId, note.id, this.uid));
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo votar.';
    }
  }

  async _saveEdit(note) {
    const text = this._editText.trim();
    if (!text) return;
    try {
      await editNote(this.retroId, note.id, text);
      this._editingId = null;
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo editar la nota.';
    }
  }

  async _delete(note) {
    try {
      await deleteNote(this.retroId, note.id);
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo borrar la nota.';
    }
  }

  _renderNote(note) {
    const voters = note.voters ?? [];
    const voted = voters.includes(this.uid);
    const mine = note.authorUid === this.uid;
    if (this._editingId === note.id) {
      return html`<div class="note"><div class="edit">
        <input .value=${this._editText} @input=${(e) => { this._editText = e.target.value; }}
          @keydown=${(e) => { if (e.key === 'Enter') this._saveEdit(note); }} />
        <button @click=${() => this._saveEdit(note)}>Guardar</button>
        <button class="ghost" @click=${() => { this._editingId = null; }}>Cancelar</button>
      </div></div>`;
    }
    return html`<div class="note">
      ${note.text}
      <div class="foot">
        <span class="anon">Anónimo</span>
        <span class="n-actions">
          ${mine && this._open ? html`<button class="mini" @click=${() => { this._editingId = note.id; this._editText = note.text; }}>Editar</button>` : null}
          ${mine && this._open ? html`<button class="mini del" @click=${() => this._delete(note)}>Borrar</button>` : null}
          <button class="vote ${voted ? 'voted' : ''}" ?disabled=${!this._open} @click=${() => this._toggleVote(note)}>👍 ${voters.length}</button>
        </span>
      </div>
    </div>`;
  }

  _renderAdd(columnId) {
    if (!this._open) return null;
    return html`<div class="add">
      <input placeholder="Añadir nota…" .value=${this._drafts[columnId] ?? ''}
        @input=${(e) => { this._drafts = { ...this._drafts, [columnId]: e.target.value }; }}
        @keydown=${(e) => { if (e.key === 'Enter') this._addNote(columnId); }} />
      <button ?disabled=${!(this._drafts[columnId] ?? '').trim()} @click=${() => this._addNote(columnId)}>+</button>
    </div>`;
  }

  _renderColumn(col) {
    const notes = this._notesFor(col.id);
    return html`<div class="col">
      <div class="col-h a-${col.accent}"><span class="dot"></span>${col.title}</div>
      ${notes.length ? notes.map((n) => this._renderNote(n)) : html`<p class="empty">Sin notas aún.</p>`}
      ${this._renderAdd(col.id)}
    </div>`;
  }

  _renderZone(col) {
    const notes = this._notesFor(col.id);
    return html`<div class="zone a-${col.accent}">
      <div class="col-h a-${col.accent}">${BARCO_ICON[col.id] ?? ''} ${col.title}</div>
      ${col.hint ? html`<p class="zhint">${col.hint}</p>` : null}
      ${notes.length ? notes.map((n) => this._renderNote(n)) : html`<p class="empty">Sin notas aún.</p>`}
      ${this._renderAdd(col.id)}
    </div>`;
  }

  render() {
    if (this._loading && !this._retro) return html`<p class="empty">Cargando el tablero…</p>`;
    if (!this._retro) return html`<p class="error">${this._error || 'Retro no encontrada.'}</p>`;
    const format = getFormat(this._retro.format);
    const cols = format?.columns ?? [];
    const boardStyle = '--cols:' + cols.length;
    return html`
      <div class="head">
        <h2>${this._retro.name}</h2>
        <span class="chip fmt">${format?.name ?? this._retro.format}</span>
        <span class="chip ${this._open ? 'open' : 'closed'}">${this._open ? 'Abierta' : 'Cerrada'}</span>
      </div>
      <p class="ro-note">${this._open ? 'Aporta tus notas (anónimas) y vota las que veas clave.' : 'Retro cerrada: solo lectura.'}</p>
      ${this._error ? html`<p class="error">${this._error}</p>` : null}
      ${format?.kind === 'barco'
        ? html`<div class="barco">${cols.map((c) => this._renderZone(c))}</div>`
        : html`<div class="board" style=${boardStyle}>${cols.map((c) => this._renderColumn(c))}</div>`}
    `;
  }
}

if (!customElements.get('retro-board')) {
  customElements.define('retro-board', RetroBoard);
}
