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
import { skeletonBlock } from '../app-skeleton.js';
import { getFormat } from '../../tools/retro/domain/formats.js';
import { groupNotes, summaryGroups, groupPatch, ungroupPatch } from '../../tools/retro/domain/grouping.js';
import { isColumnRevealed, canReadGroup, canReveal, revealPatch } from '../../tools/retro/domain/visibility.js';
import '../app-modal.js';
import './retro-actions.js';

/** Etiqueta de una columna en el selector del composer («Viento · nos empuja»). */
const colLabel = (col) => (col.hint ? `${col.title} · ${col.hint}` : col.title);
import { getRetro, listNotes, addNote, voteNote, unvoteNote, editNote, deleteNote, setNoteGroups, setRetroReveal } from '../../lib/retros.js';

/** Emoji de cada zona del Barco. */
const BARCO_ICON = { viento: '🌬️', ancla: '⚓', rocas: '🪨', isla: '🏝️' };

export class RetroBoard extends LitElement {
  static properties = {
    retroId: { attribute: false },
    uid: { attribute: false },
    members: { attribute: false },
    isSuperAdmin: { attribute: false },
    _retro: { state: true },
    _notes: { state: true },
    _drafts: { state: true },
    _editingId: { state: true },
    _editText: { state: true },
    _loading: { state: true },
    _error: { state: true },
    _tab: { state: true },
    _selected: { state: true },
    _openNoteId: { state: true },
    _composerCol: { state: true },
    _composerText: { state: true },
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
    @media (max-width: 760px) { .board { grid-template-columns: 1fr; } }
    /* Escena de velero: viento arriba, ancla abajo, rocas y meta a los lados,
       y el barco (SVG) en el centro (RMR-TSK-0248). */
    /* ── Escena del barco a lo GRANDE (RMR-TSK-0282) ──────────────────────
       El dibujo ocupa todo el ancho como lienzo de fondo y las cuatro zonas se
       colocan ENCIMA, en el sitio que les toca por la metáfora: el viento
       arriba, las rocas a babor, la isla a estribor y el ancla abajo. Los
       paneles son translúcidos para que el barco se siga viendo. */
    /* El barco es una CAPA DE FONDO que ocupa toda la escena; las zonas van en
       rejilla ENCIMA, con el centro libre para que se vea el dibujo. Se probó
       posicionarlas en absoluto y se descartó: con contenido de altura variable
       «Ancla» acababa tapando a «Rocas» e «Isla». */
    .barco-scene {
      position: relative; min-height: 34rem; padding: 0.5rem 0;
      display: grid; gap: 1rem; align-items: start;
      grid-template-columns: 1fr 1.1fr 1fr;
      grid-template-areas: "viento viento viento" "rocas . isla" "ancla ancla ancla";
    }
    .boat-cell {
      position: absolute; inset: 0; z-index: 0; display: grid; place-items: center;
      pointer-events: none; /* el dibujo no intercepta clics de las tarjetas */
    }
    .boat-svg { width: 100%; height: 100%; max-width: none; opacity: 0.95; }
    .barco-scene .zone {
      position: relative; z-index: 1; margin: 0;
      background: color-mix(in srgb, var(--rm-surface, #fff) 82%, transparent);
      backdrop-filter: blur(2px);
    }
    .zone.z-viento { grid-area: viento; } .zone.z-rocas { grid-area: rocas; }
    .zone.z-isla { grid-area: isla; } .zone.z-ancla { grid-area: ancla; align-self: end; }
    /* En pantallas estrechas el solape no cabe: se apila y el barco vuelve a
       ser una ilustración más, no un lienzo. */
    @media (max-width: 820px) {
      .barco-scene { position: static; min-height: 0; grid-template-columns: 1fr; grid-template-areas: none; }
      .barco-scene .zone { width: auto; background: var(--rm-surface, #fff); backdrop-filter: none; }
      .boat-cell { position: static; order: 2; }
      .boat-svg { max-width: 300px; }
      .zone.z-viento { order: 1; } .zone.z-rocas { order: 3; }
      .zone.z-isla { order: 4; } .zone.z-ancla { order: 5; }
    }

    .col, .zone { background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #dde7ec); border-radius: 14px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.55rem; }
    .col-h { display: flex; align-items: center; gap: 0.45rem; font-weight: 700; font-size: 0.92rem; }
    .col-h .dot { width: 0.6rem; height: 0.6rem; border-radius: 50%; }
    .a-teal { color: var(--rm-accent-700, var(--teal)); } .a-teal .dot { background: var(--teal); } .zone.a-teal { border-top: 4px solid var(--teal); }
    .a-coral { color: var(--coral); } .a-coral .dot { background: var(--coral); } .zone.a-coral { border-top: 4px solid var(--coral); }
    .a-navy { color: var(--navy); } .a-navy .dot { background: var(--navy); } .zone.a-navy { border-top: 4px solid var(--navy); }
    .a-amber { color: var(--amber); } .a-amber .dot { background: var(--amber); } .zone.a-amber { border-top: 4px solid var(--amber); }
    .zhint { font-size: 0.72rem; color: var(--rm-muted, #5b6b7d); margin: -0.3rem 0 0.2rem; }

    /* ── Tablero rediseñado (RMR-TSK-0281) ─────────────────────────────── */
    .btabs { display: flex; gap: 1.1rem; margin: 0 0 1rem; border-bottom: 1px solid var(--rm-border, #dde7ec); flex-wrap: wrap; }
    .btab { border: 0; background: none; color: var(--rm-muted, #5b6b7d); font: inherit; font-size: 0.92rem; font-weight: 700; padding: 0.45rem 0.1rem; margin-bottom: -1px; border-bottom: 2px solid transparent; cursor: pointer; }
    .btab.on { color: var(--rm-accent, #2a9d8f); border-bottom-color: var(--rm-accent, #2a9d8f); }
    /* Bloque de inserción: se distingue del tablero con su propia superficie y
       un filete de acento, para que se lea como «aquí se aporta» (RMR-TSK-0282). */
    .composer {
      display: grid; grid-template-columns: minmax(9rem, 14rem) 1fr auto; gap: 0.6rem; align-items: start;
      margin-bottom: 1.4rem; padding: 0.9rem 1rem;
      background: var(--rm-surface, #fff); border: 1px solid var(--rm-border, #dde7ec);
      border-left: 4px solid var(--rm-accent, #2a9d8f); border-radius: 12px;
    }
    @media (max-width: 640px) { .composer { grid-template-columns: 1fr; } }
    .composer select, .composer textarea { font: inherit; font-size: 0.88rem; padding: 0.5rem 0.6rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: var(--rm-field, #eef2f6); color: var(--rm-text, #1e3a5f); box-sizing: border-box; width: 100%; resize: vertical; }
    .composer .primary { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); border: 0; border-radius: 8px; padding: 0.55rem 1.1rem; font: inherit; font-weight: 700; cursor: pointer; align-self: start; }
    .composer .primary:disabled { opacity: 0.5; cursor: not-allowed; }
    /* ── Tarjetas ocultas hasta revelar (RMR-TSK-0283) ────────────────────
       Difuminado + sin selección: se ve que HAY tarjeta y cuánta, pero no se
       puede leer ni copiar de un vistazo. Es ocultación de facilitación, no un
       secreto: el texto está en el cliente. */
    .blurred { filter: blur(5px); user-select: none; opacity: 0.85; }
    .card-body[disabled] { cursor: default; }
    .col-h .eye { margin-left: auto; }
    .eye { border: 0; background: none; font-size: 0.95rem; line-height: 1; padding: 0.1rem 0.2rem; cursor: pointer; border-radius: 6px; }
    .eye:hover { background: var(--rm-surface-hover, #eef3f5); }
    .reveal-bar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin: 0 0 1rem; }
    .reveal-note { font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 1rem; }
    .reveal-bar .reveal-note { margin: 0; flex: 1; min-width: 12rem; }
    .reveal-all { border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-surface, #fff); color: var(--rm-text, #1e3a5f); border-radius: 999px; font: inherit; font-size: 0.8rem; font-weight: 700; padding: 0.35rem 0.9rem; cursor: pointer; }
    .reveal-all:hover { border-color: var(--teal); color: var(--rm-accent-700, var(--teal)); }
    .cards { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .card { position: relative; display: flex; align-items: flex-start; gap: 0.3rem; background: var(--rm-field, #eef2f6); border: 1px solid var(--rm-border, #dde7ec); border-radius: 10px; max-width: 12rem; }
    .card.sel { border-color: var(--rm-accent, #2a9d8f); box-shadow: 0 0 0 2px color-mix(in srgb, var(--rm-accent, #2a9d8f) 30%, transparent); }
    .card .pick { margin: 0.5rem 0 0 0.45rem; flex: 0 0 auto; accent-color: var(--rm-accent, #2a9d8f); }
    .card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; text-align: left; background: none; border: 0; padding: 0.5rem 0.6rem; font: inherit; color: inherit; cursor: pointer; }
    .card-text { font-size: 0.8rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .card-foot { display: flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; color: var(--rm-muted, #5b6b7d); }
    .xn { font-weight: 800; color: var(--rm-accent, #2a9d8f); }
    .groupbar { position: sticky; bottom: 0.75rem; display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; padding: 0.6rem 0.9rem; background: var(--rm-surface, #fff); border: 1px solid var(--rm-accent, #2a9d8f); border-radius: 999px; box-shadow: var(--rm-shadow, 0 6px 18px rgba(0,0,0,.15)); font-size: 0.85rem; }
    .groupbar .primary { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); border: 0; border-radius: 999px; padding: 0.35rem 0.9rem; font: inherit; font-weight: 700; cursor: pointer; }
    .groupbar .ghost { border: 0; background: none; color: var(--rm-muted, #5b6b7d); font: inherit; cursor: pointer; }
    .pop-text { font-size: 1.05rem; line-height: 1.5; margin: 0 0 0.75rem; }
    .pop-sub { font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); font-weight: 700; margin: 0 0 0.3rem; }
    .pop-group ul { margin: 0 0 0.75rem; padding-left: 1.1rem; font-size: 0.88rem; color: var(--rm-muted, #5b6b7d); }
    .resumen { display: grid; gap: 1.25rem; }
    .res-col h4 { margin: 0 0 0.4rem; font-size: 0.95rem; }
    .res-col ol { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.35rem; }
    .res-col li { font-size: 0.88rem; display: flex; align-items: baseline; gap: 0.5rem; }
    .res-help { font-size: 0.82rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 0.25rem; }
    .res-col li .pick { accent-color: var(--rm-accent, #2a9d8f); flex: 0 0 auto; }
    .res-col .ghost.mini { border: 0; background: none; color: var(--rm-muted, #5b6b7d); font: inherit; font-size: 0.75rem; text-decoration: underline; cursor: pointer; padding: 0; }
    .res-votes { font-weight: 800; color: var(--rm-accent, #2a9d8f); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .note { background: var(--rm-field, #eef2f6); border: 1px solid var(--rm-border, #e7f0f0); border-radius: 10px; padding: 0.55rem 0.65rem; font-size: 0.85rem; }
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
    .edit input { flex: 1; min-width: 0; font: inherit; font-size: 0.82rem; padding: 0.35rem 0.5rem; border: 1px solid var(--teal); border-radius: 8px; background: var(--rm-field, #eef2f6); color: var(--rm-text, #1e3a5f); }
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
    /** @type {Array<{uid:string,name:string}>} miembros, para asignar acciones */
    this.members = [];
    /** Un superadmin también facilita (revelar zonas), aunque no sea el dueño. */
    this.isSuperAdmin = false;
    /** Pestaña visible del tablero. @type {'tablero'|'resumen'|'acciones'} */
    this._tab = 'tablero';
    /** Ids de nota seleccionados para agrupar. @type {string[]} */
    this._selected = [];
    /** Id del grupo abierto en el popup, o null. @type {string|null} */
    this._openNoteId = null;
    /** Composer ÚNICO: columna elegida y texto (antes había un input por columna). */
    this._composerCol = '';
    this._composerText = '';
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
      // El composer arranca en la primera columna del formato.
      if (!this._composerCol) this._composerCol = getFormat(retro?.format)?.columns?.[0]?.id ?? '';
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

  // ── Composer único, selección y agrupación (RMR-TSK-0281) ──────────────────

  /** Un ÚNICO formulario, común a las cuatro zonas: se elige el tipo y se escribe. */
  _renderComposer(cols) {
    if (!this._open) return null;
    const text = this._composerText.trim();
    return html`<div class="composer">
      <select aria-label="Tipo de tarjeta" .value=${this._composerCol}
        @change=${(e) => { this._composerCol = e.target.value; }}>
        ${cols.map((c) => html`<option value=${c.id} ?selected=${c.id === this._composerCol}>${colLabel(c)}</option>`)}
      </select>
      <textarea rows="2" placeholder="Escribe tu tarjeta…" .value=${this._composerText}
        @input=${(e) => { this._composerText = e.target.value; }}></textarea>
      <button class="primary" ?disabled=${!text} @click=${() => this._addFromComposer()}>Añadir</button>
    </div>`;
  }

  async _addFromComposer() {
    const text = this._composerText.trim();
    if (!text || !this._composerCol) return;
    this._composerText = '';
    this._drafts = { ...this._drafts, [this._composerCol]: text };
    await this._addNote(this._composerCol);
  }

  /** @param {string} groupId */
  _toggleSelect(groupId) {
    this._selected = this._selected.includes(groupId)
      ? this._selected.filter((id) => id !== groupId)
      : [...this._selected, groupId];
  }

  /** Barra flotante que aparece al marcar 2 o más tarjetas. */
  _renderGroupBar() {
    if (this._selected.length < 2) return null;
    return html`<div class="groupbar">
      <span>${this._selected.length} tarjetas seleccionadas</span>
      <button class="primary" @click=${() => this._group()}>Agrupar</button>
      <button class="ghost" @click=${() => { this._selected = []; }}>Cancelar</button>
    </div>`;
  }

  /** Agrupa las seleccionadas: todas las notas de esos grupos pasan a uno solo. */
  async _group() {
    // Al seleccionar se marcan GRUPOS; hay que agrupar todas sus notas, no solo
    // la principal, o las secundarias se quedarían fuera.
    const ids = groupNotes(this._notes)
      .filter((g) => this._selected.includes(g.id))
      .flatMap((g) => g.notes.map((n) => n.id));
    try {
      await setNoteGroups(this.retroId, groupPatch(ids));
      this._selected = [];
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo agrupar.';
    }
  }

  /** @param {string} groupId */
  async _ungroup(groupId) {
    try {
      await setNoteGroups(this.retroId, ungroupPatch(this._notes, groupId));
      this._openNoteId = null;
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo deshacer el grupo.';
    }
  }

  /** Tarjeta PEQUEÑA del tablero: se abre en popup al hacer clic. Sin checkbox
   *  a propósito — agrupar se hace en la pestaña Resumen, para no recargar el
   *  tablero (y menos aún el barco) con controles de facilitación. */
  _renderCard(group) {
    const many = group.notes.length > 1;
    // Oculta: se difumina y NO se abre. Votar o comentar algo que no se ha leído
    // es justo lo que se quiere evitar hasta que la zona se revele.
    const hidden = !this._canRead(group);
    return html`<div class="card">
      <button class="card-body" ?disabled=${hidden}
        aria-label=${hidden ? 'Tarjeta oculta hasta que se revele la zona' : ''}
        @click=${() => { this._openNoteId = group.id; }}>
        <span class="card-text ${hidden ? 'blurred' : ''}" aria-hidden=${hidden}>${group.text}</span>
        <span class="card-foot">
          ${many ? html`<span class="xn" title="${group.notes.length} tarjetas agrupadas">×${group.notes.length}</span>` : null}
          <span class="votes">👍 ${group.votes}</span>
        </span>
      </button>
    </div>`;
  }

  /** Contenido de la pestaña activa (extraído: evita ternarios anidados). */
  _renderTabBody(format, cols, boardStyle) {
    if (this._tab === 'resumen') {
      return html`${this._renderResumen(cols)}${this._renderGroupBar()}`;
    }
    if (this._tab === 'acciones') {
      // Las acciones viven aquí (RMR-TSK-0282); antes colgaban sueltas bajo el
      // tablero, alargando la página y compitiendo con el barco.
      return html`<retro-actions
        .retroId=${this.retroId}
        .uid=${this.uid}
        .leaderUid=${this._retro?.ownerLeaderUid ?? null}
        .scope=${this._retro?.scope ?? null}
        .members=${this.members ?? []}
      ></retro-actions>`;
    }
    return html`
      ${this._renderComposer(cols)}
      ${this._renderRevealBar(cols)}
      ${this._renderLayout(format, cols, boardStyle)}
    `;
  }

  /** Cuerpo del tablero según el formato (extraído: evita ternarios anidados). */
  _renderLayout(format, cols, boardStyle) {
    if (format?.kind === 'barco') return this._renderBarco(cols);
    return html`<div class="board" style=${boardStyle}>${cols.map((c) => this._renderColumn(c))}</div>`;
  }

  /** Bloque «agrupada con» del popup (extraído: evita ternarios anidados). */
  _renderPopGroup(group) {
    if (group.notes.length <= 1) return null;
    const others = group.notes.filter((n) => n.id !== group.id);
    const undo = this._open
      ? html`<button class="ghost" @click=${() => this._ungroup(group.id)}>Deshacer grupo</button>`
      : null;
    return html`<div class="pop-group">
      <p class="pop-sub">Agrupada con:</p>
      <ul>${others.map((n) => html`<li>${n.text}</li>`)}</ul>
      ${undo}
    </div>`;
  }

  /** Badge ×N + «deshacer» de una fila del resumen (extraído por lo mismo). */
  _renderGroupBadge(group) {
    if (group.notes.length <= 1) return null;
    const undo = this._open
      ? html`<button class="ghost mini" @click=${() => this._ungroup(group.id)}>deshacer</button>`
      : null;
    return html`<span class="xn">×${group.notes.length}</span>${undo}`;
  }

  /** Popup con la tarjeta a tamaño grande y sus acciones. */
  _renderCardPopup() {
    if (!this._openNoteId) return null;
    const group = groupNotes(this._notes).find((g) => g.id === this._openNoteId);
    // Si la zona se vuelve a ocultar con el popup abierto, se cierra: nada de
    // dejar el texto a la vista por una carrera de estados.
    if (!group || !this._canRead(group)) return null;
    const primary = group.notes.find((n) => n.id === group.id) ?? group.notes[0];
    const mine = primary?.authorUid === this.uid;
    const voted = (primary?.voters ?? []).includes(this.uid);
    const close = () => { this._openNoteId = null; };
    return html`<app-modal .open=${true} heading="Tarjeta" @close=${close}>
      <p class="pop-text">${group.text}</p>
      ${this._renderPopGroup(group)}
      <div class="modal-actions">
        <button class="vote ${voted ? 'voted' : ''}" ?disabled=${!this._open}
          @click=${async () => { await this._toggleVote(primary); this.requestUpdate(); }}>👍 ${group.votes}</button>
        ${mine && this._open
          ? html`<button class="ghost" @click=${() => { this._editingId = primary.id; this._editText = primary.text; this._openNoteId = null; }}>Editar</button>
                 <button class="ghost del" @click=${async () => { await this._delete(primary); this._openNoteId = null; }}>Borrar</button>`
          : null}
        <button @click=${close}>Cerrar</button>
      </div>
    </app-modal>`;
  }

  /** Pestaña «Resumen»: grupos ordenados por votos. */
  _renderResumen(cols) {
    const all = summaryGroups(this._notes);
    if (all.length === 0) return html`<p class="empty">Aún no hay tarjetas.</p>`;
    return html`<div class="resumen">
      ${this._open ? html`<p class="res-help">Marca dos o más tarjetas que digan lo mismo y agrúpalas.</p>` : null}
      ${cols.map((col) => {
        const groups = all.filter((g) => g.columnId === col.id);
        if (groups.length === 0) return null;
        return html`<section class="res-col">
          <h4 class="a-${col.accent}">${col.title}</h4>
          <ol>
            ${groups.map((g) => html`<li>
              ${this._open
                ? html`<input class="pick" type="checkbox" .checked=${this._selected.includes(g.id)}
                    aria-label="Seleccionar «${g.text}» para agrupar"
                    @change=${() => this._toggleSelect(g.id)} />`
                : null}
              <span class="res-votes">👍 ${g.votes}</span>
              <span class="res-text ${this._canRead(g) ? '' : 'blurred'}">${g.text}</span>
              ${this._renderGroupBadge(g)}
            </li>`)}
          </ol>
        </section>`;
      })}
    </div>`;
  }



  // ── Tarjetas ocultas y revelado por zona (RMR-TSK-0283) ────────────────────

  /** ¿Facilita esta persona? Solo entonces se pintan los controles de revelado. */
  get _canReveal() { return canReveal(this._retro, this.uid, this.isSuperAdmin); }

  /** @param {{columnId?: string}} group */
  _canRead(group) { return canReadGroup(group, this.uid, this._retro); }

  /** Revela u oculta zonas. Es un acto de facilitación: se guarda en la retro
   *  para que el cambio se vea a la vez en todas las pantallas. */
  async _setRevealed(columnIds, revealed) {
    try {
      await setRetroReveal(this.retroId, revealPatch(columnIds, revealed));
      await this._load();
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo cambiar la visibilidad.';
    }
  }

  /** Ojo de una zona: la revela u oculta solo a ella. */
  _renderEye(col) {
    if (!this._canReveal || !this._open) return null;
    const shown = isColumnRevealed(this._retro, col.id);
    const label = `${shown ? 'Ocultar' : 'Mostrar'} las tarjetas de ${col.title}`;
    return html`<button class="eye" title=${label} aria-label=${label}
      @click=${() => this._setRevealed([col.id], !shown)}>${shown ? '👁️' : '🙈'}</button>`;
  }

  /** Barra sobre el tablero: al que facilita le da el interruptor general; al
   *  resto, la explicación de por qué no ve las tarjetas de los demás. */
  _renderRevealBar(cols) {
    if (!this._open) return null;
    const ids = cols.map((c) => c.id);
    if (!this._canReveal) {
      if (ids.every((id) => isColumnRevealed(this._retro, id))) return null;
      return html`<p class="reveal-note">🙈 Las tarjetas del resto están ocultas hasta que quien
        facilita revele cada zona. Las tuyas las ves siempre.</p>`;
    }
    const allShown = ids.every((id) => isColumnRevealed(this._retro, id));
    return html`<div class="reveal-bar">
      <span class="reveal-note">Las tarjetas nacen ocultas. Revélalas por zona con su ojo, o todas de golpe.</span>
      <button class="reveal-all" @click=${() => this._setRevealed(ids, !allShown)}>
        ${allShown ? '🙈 Ocultar todas' : '👁️ Mostrar todas'}
      </button>
    </div>`;
  }

  /** Grupos de una columna (una tarjeta por grupo, no por nota). */
  _groupsFor(columnId) {
    return groupNotes(this._notesFor(columnId));
  }

  _renderColumn(col) {
    const groups = this._groupsFor(col.id);
    return html`<div class="col">
      <div class="col-h a-${col.accent}"><span class="dot"></span>${col.title}${this._renderEye(col)}</div>
      ${groups.length ? html`<div class="cards">${groups.map((g) => this._renderCard(g))}</div>` : html`<p class="empty">Sin notas aún.</p>`}
    </div>`;
  }

  _renderZone(col) {
    const groups = this._groupsFor(col.id);
    return html`<div class="zone a-${col.accent} z-${col.id}">
      <div class="col-h a-${col.accent}">${BARCO_ICON[col.id] ?? ''} ${col.title}${this._renderEye(col)}</div>
      ${col.hint ? html`<p class="zhint">${col.hint}</p>` : null}
      ${groups.length ? html`<div class="cards">${groups.map((g) => this._renderCard(g))}</div>` : html`<p class="empty">Sin notas aún.</p>`}
    </div>`;
  }

  /** Escena de velero con las 4 zonas colocadas alrededor según la metáfora. */
  _renderBarco(cols) {
    return html`
      <div class="barco-scene">
        ${cols.map((c) => this._renderZone(c))}
        <div class="boat-cell">${this._boatScene()}</div>
      </div>`;
  }

  /** Ilustración SVG del velero: viento, vela, casco, ancla, rocas, isla y sol. */
  _boatScene() {
    return html`
      <svg class="boat-svg" viewBox="0 0 320 220" role="img" aria-label="Velero navegando hacia una isla">
        <circle cx="272" cy="46" r="20" fill="var(--amber)" opacity="0.85"></circle>
        <path d="M22 46 q30 -10 60 0" stroke="var(--teal)" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"></path>
        <path d="M16 64 q34 -10 70 0" stroke="var(--teal)" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"></path>
        <path d="M0 150 q40 -12 80 0 t80 0 t80 0 t80 0 V220 H0 Z" fill="color-mix(in srgb, var(--teal) 22%, transparent)"></path>
        <path d="M0 166 q40 -12 80 0 t80 0 t80 0 t80 0 V220 H0 Z" fill="color-mix(in srgb, var(--navy) 14%, transparent)"></path>
        <path d="M252 150 q24 -20 50 0 Z" fill="var(--amber)" opacity="0.8"></path>
        <path d="M277 132 v-16 M277 120 q-9 -7 -15 -3 M277 120 q9 -7 15 -3" stroke="var(--teal)" stroke-width="2.5" fill="none" stroke-linecap="round"></path>
        <path d="M28 156 l15 -24 l15 24 Z" fill="color-mix(in srgb, var(--navy) 55%, var(--coral))"></path>
        <path d="M52 158 l11 -15 l11 15 Z" fill="color-mix(in srgb, var(--navy) 38%, var(--coral))"></path>
        <path d="M120 150 h80 l-14 22 h-52 z" fill="var(--navy)"></path>
        <line x1="160" y1="150" x2="160" y2="58" stroke="var(--navy)" stroke-width="3"></line>
        <path d="M164 64 L164 145 L216 145 Z" fill="var(--teal)"></path>
        <path d="M156 72 L156 145 L117 145 Z" fill="color-mix(in srgb, var(--teal) 65%, #ffffff)"></path>
        <path d="M160 58 l17 5 l-17 5 z" fill="var(--coral)"></path>
        <line x1="150" y1="170" x2="150" y2="198" stroke="var(--navy)" stroke-width="2" opacity="0.55"></line>
        <g stroke="var(--navy)" stroke-width="2.5" fill="none" opacity="0.7" stroke-linecap="round">
          <circle cx="150" cy="199" r="4"></circle>
          <line x1="150" y1="203" x2="150" y2="216"></line>
          <path d="M141 210 q9 11 18 0"></path>
          <line x1="143" y1="207" x2="157" y2="207"></line>
        </g>
      </svg>`;
  }

  render() {
    if (this._loading && !this._retro) return skeletonBlock('240px');
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
      <div class="btabs" role="tablist" aria-label="Vistas de la retro">
        <button role="tab" aria-selected=${this._tab === 'tablero'} class="btab ${this._tab === 'tablero' ? 'on' : ''}"
          @click=${() => { this._tab = 'tablero'; }}>Tablero</button>
        <button role="tab" aria-selected=${this._tab === 'resumen'} class="btab ${this._tab === 'resumen' ? 'on' : ''}"
          @click=${() => { this._tab = 'resumen'; }}>Resumen</button>
        <button role="tab" aria-selected=${this._tab === 'acciones'} class="btab ${this._tab === 'acciones' ? 'on' : ''}"
          @click=${() => { this._tab = 'acciones'; }}>Acciones</button>
      </div>
      ${this._renderTabBody(format, cols, boardStyle)}
      ${this._renderCardPopup()}
    `;
  }
}

if (!customElements.get('retro-board')) {
  customElements.define('retro-board', RetroBoard);
}
