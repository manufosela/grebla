/**
 * <motivators-board> — tablero de ordenación de las 10 cartas. Dos formas de jugar,
 * ambas soportadas:
 *  - Arrastrar (Pointer Events: ratón y táctil) una carta a una posición.
 *  - Seleccionar con click/teclado (Enter) y luego activar la posición destino
 *    (accesible: cada carta y cada hueco son operables por teclado).
 * El icono de info abre un modal con la descripción, sin contar como mover. Finalizar
 * solo se habilita con las 10 posiciones ocupadas; emite `finalize` con el orden 1-10.
 */
import { LitElement, html, css } from 'lit';
import './motivators-card.js';
import '../app-modal.js';
import {
  emptySlots, placedCount, canFinalize, placeCard, removeCard, trayCards, slotsToOrden,
} from '../../tools/motivators/domain/placement.js';
import { DECK_SIZE } from '../../tools/motivators/domain/types.js';

const DRAG_THRESHOLD = 6;

export class MotivatorsBoard extends LitElement {
  static properties = {
    deck: { attribute: false },
    initialSlots: { attribute: false },
    _slots: { state: true },
    _selectedId: { state: true },
    _dragId: { state: true },
    _hoverIndex: { state: true },
    _modalCard: { state: true },
    _dragPos: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .lead { font-size: 0.85rem; color: var(--rm-muted, #5b6b7d); margin: 0 0 1rem; }
    .progress { font-weight: 800; color: var(--accent); }
    .grid { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
    @media (min-width: 720px) { .grid { grid-template-columns: 1fr 1fr; } }
    h4 { margin: 0 0 0.6rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--rm-muted, #6b7280); }
    .tray, .slots { display: grid; gap: 0.5rem; }
    .tray-empty { color: var(--rm-muted, #9ca3af); font-size: 0.85rem; padding: 0.5rem; }
    .slot {
      display: flex; align-items: center; gap: 0.5rem; min-height: 58px;
      border: 2px dashed var(--rm-border, #d1d5db); border-radius: 12px; padding: 0.3rem;
      background: var(--rm-surface, #fff); cursor: pointer;
    }
    .slot.filled { border-style: solid; }
    .slot.hover { border-color: var(--accent); background: var(--accent-soft); }
    .slot:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
    .slot-num {
      flex: 0 0 auto; width: 28px; height: 28px; border-radius: 50%; margin-left: 0.15rem;
      background: var(--accent-soft); color: var(--accent-ink); font-weight: 800; font-size: 0.9rem;
      display: grid; place-items: center;
    }
    .slot-hint { color: var(--rm-muted, #9ca3af); font-size: 0.82rem; }
    .slot motivators-card { flex: 1 1 auto; }
    .actions { display: flex; align-items: center; gap: 1rem; margin-top: 1.25rem; flex-wrap: wrap; }
    .finish {
      border: none; background: var(--accent); color: var(--accent-on); border-radius: 10px;
      padding: 0.6rem 1.3rem; font: inherit; font-size: 0.95rem; font-weight: 800; cursor: pointer;
    }
    .finish:disabled { opacity: 0.45; cursor: not-allowed; }
    .finish:focus-visible { outline: 3px solid var(--rm-navy, #1e3a5f); outline-offset: 2px; }
    .count { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
    .ghost {
      position: fixed; z-index: 1200; pointer-events: none; transform: translate(-50%, -50%);
      background: var(--accent); color: var(--accent-on); border-radius: 10px; padding: 0.4rem 0.8rem;
      font-size: 0.85rem; font-weight: 800; box-shadow: 0 8px 20px rgba(0,0,0,0.3);
    }
    .desc { margin: 0; color: var(--rm-text, #1a1a1a); line-height: 1.5; }
  `;

  constructor() {
    super();
    this.deck = null;
    this.initialSlots = null;
    this._slots = emptySlots(DECK_SIZE);
    this._selectedId = null;
    this._dragId = null;
    this._hoverIndex = -1;
    this._modalCard = null;
    this._dragPos = null;
    this._candidate = null;
    this._suppressClick = false;
  }

  willUpdate(changed) {
    if (changed.has('initialSlots') && Array.isArray(this.initialSlots)) {
      this._slots = [...this.initialSlots];
    }
  }

  get _accent() { return this.deck?.accent === 'coral' ? 'coral' : 'teal'; }

  _accentVars() {
    const teal = { '--accent': '#2a9d8f', '--accent-ink': '#14544c', '--accent-soft': '#d7efec', '--accent-on': '#ffffff' };
    const coral = { '--accent': '#e26d5e', '--accent-ink': '#7a3227', '--accent-soft': '#fbe3df', '--accent-on': '#ffffff' };
    const p = this._accent === 'coral' ? coral : teal;
    return Object.entries(p).map(([k, v]) => `${k}:${v}`).join(';');
  }

  _cardById(id) {
    return (this.deck?.cards ?? []).find((c) => c.id === id) ?? null;
  }

  // ── Selección por click/teclado ────────────────────────────────────
  _onCardPick(e) {
    const { id } = e.detail;
    if (this._suppressClick || !id) return;
    this._selectedId = this._selectedId === id ? null : id;
  }

  _onCardInfo(e) {
    this._modalCard = this._cardById(e.detail.id);
  }

  _activateSlot(index) {
    if (this._suppressClick) return;
    const occupant = this._slots[index];
    if (this._selectedId) {
      this._slots = placeCard(this._slots, this._selectedId, index);
      this._selectedId = null;
    } else if (occupant) {
      this._selectedId = occupant; // coger la carta colocada para moverla
    }
  }

  _onSlotKey(e, index) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._activateSlot(index); }
  }

  // ── Arrastre (Pointer Events) ──────────────────────────────────────
  _cardElFrom(event) {
    return event.composedPath().find((el) => el instanceof HTMLElement && el.tagName === 'MOTIVATORS-CARD') ?? null;
  }

  _onPointerDown(event) {
    const cardEl = this._cardElFrom(event);
    if (!cardEl?.card) return;
    this._candidate = { id: cardEl.card.id, x: event.clientX, y: event.clientY };
    this._captureEl = event.currentTarget;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* captura no disponible */ }
  }

  _onPointerMove(event) {
    if (!this._candidate) return;
    const dx = event.clientX - this._candidate.x;
    const dy = event.clientY - this._candidate.y;
    if (!this._dragId && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    this._dragId = this._candidate.id;
    this._dragPos = { x: event.clientX, y: event.clientY };
    this._hoverIndex = this._slotIndexAt(event.clientX, event.clientY);
  }

  _onPointerUp(event) {
    if (this._dragId) {
      const index = this._slotIndexAt(event.clientX, event.clientY);
      if (index >= 0) {
        this._slots = placeCard(this._slots, this._dragId, index);
      } else if (this._overTray(event.clientX, event.clientY)) {
        this._slots = removeCard(this._slots, this._dragId);
      }
      this._suppressClick = true;
      queueMicrotask(() => { this._suppressClick = false; });
    }
    this._endDrag(event);
  }

  _endDrag(event) {
    this._candidate = null;
    this._dragId = null;
    this._dragPos = null;
    this._hoverIndex = -1;
    if (this._captureEl && event.pointerId != null) {
      try { this._captureEl.releasePointerCapture(event.pointerId); } catch { /* noop */ }
    }
    this._captureEl = null;
  }

  _slotIndexAt(x, y) {
    const slots = this.renderRoot?.querySelectorAll('.slot') ?? [];
    for (const el of slots) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return Number(el.dataset.index);
    }
    return -1;
  }

  _overTray(x, y) {
    const tray = this.renderRoot?.querySelector('.tray');
    if (!tray) return false;
    const r = tray.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  _finalize() {
    if (!canFinalize(this._slots)) return;
    this.dispatchEvent(new CustomEvent('finalize', { detail: { orden: slotsToOrden(this._slots) }, bubbles: true, composed: true }));
  }

  render() {
    if (!this.deck) return null;
    const tray = trayCards(this.deck.cards, this._slots);
    const done = placedCount(this._slots);
    const ready = canFinalize(this._slots);
    return html`
      <div style=${this._accentVars()}
           @card-pick=${this._onCardPick} @card-info=${this._onCardInfo}
           @pointerdown=${this._onPointerDown} @pointermove=${this._onPointerMove}
           @pointerup=${this._onPointerUp} @pointercancel=${this._endDrag}>
        <p class="lead">
          Arrastra o selecciona cada carta y colócala en su posición: <strong>1 = lo más importante</strong>,
          10 = lo menos. Pulsa <strong>i</strong> para ver qué significa cada una. Progreso:
          <span class="progress">${done}/${DECK_SIZE}</span>.
        </p>
        <div class="grid">
          <div>
            <h4>Cartas</h4>
            <div class="tray">${this._renderTray(tray)}</div>
          </div>
          <div>
            <h4>Tu orden</h4>
            <div class="slots">${this._slots.map((id, i) => this._renderSlot(id, i))}</div>
          </div>
        </div>
        <div class="actions">
          <button class="finish" ?disabled=${!ready} @click=${this._finalize}>Finalizar</button>
          <span class="count">${ready ? '¡Listo! Ya puedes finalizar.' : `Coloca las ${DECK_SIZE} cartas para finalizar.`}</span>
        </div>
      </div>
      ${this._renderGhost()}
      <app-modal .open=${!!this._modalCard} heading=${this._modalCard?.name ?? ''} @close=${() => { this._modalCard = null; }}>
        <p class="desc">${this._modalCard?.description}</p>
      </app-modal>
    `;
  }

  _renderTray(tray) {
    if (tray.length === 0) return html`<p class="tray-empty">Todas colocadas. Revisa el orden y finaliza.</p>`;
    return tray.map((c) => this._renderCardEl(c));
  }

  _renderCardEl(card) {
    return html`<motivators-card .card=${card} accent=${this._accent}
      ?selected=${this._selectedId === card.id} ?dragging=${this._dragId === card.id}></motivators-card>`;
  }

  _renderGhost() {
    if (!this._dragId || !this._dragPos) return null;
    const style = `${this._accentVars()};left:${this._dragPos.x}px;top:${this._dragPos.y}px`;
    return html`<div class="ghost" style=${style}>${this._cardById(this._dragId)?.name}</div>`;
  }

  _renderSlot(id, i) {
    const card = id ? this._cardById(id) : null;
    const cls = ['slot', card ? 'filled' : '', this._hoverIndex === i ? 'hover' : ''].filter(Boolean).join(' ');
    const label = card ? `Posición ${i + 1}: ${card.name}` : `Posición ${i + 1} vacía`;
    const hint = this._selectedId ? 'Pulsa para colocar aquí' : 'Vacía';
    const body = card ? this._renderCardEl(card) : html`<span class="slot-hint">${hint}</span>`;
    return html`<div class=${cls} data-index=${i} role="button" tabindex="0" aria-label=${label}
        @click=${() => this._activateSlot(i)} @keydown=${(e) => this._onSlotKey(e, i)}>
      <span class="slot-num" aria-hidden="true">${i + 1}</span>
      ${body}
    </div>`;
  }
}

if (!customElements.get('motivators-board')) {
  customElements.define('motivators-board', MotivatorsBoard);
}
