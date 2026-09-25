/**
 * <card-layout-editor> — el orden de las tarjetas (RMR-TSK-0571).
 *
 * Dos listas, una por superficie: el inicio y el panel. Se sube y se baja cada
 * tarjeta, se guarda, y ese orden lo ve toda la organización.
 *
 * Se ordena sobre la lista REAL de tarjetas que hay en el código, no sobre lo
 * guardado: así una herramienta nueva aparece aquí sola, y una retirada
 * desaparece sin dejar una fila fantasma que no se pueda quitar.
 *
 * Lo que aquí se decide es el ORDEN, no quién ve qué. Cada persona sigue viendo
 * únicamente sus tarjetas; lo que cambia es en qué posición relativa las ve.
 */
import { LitElement, html, css } from 'lit';
import { orderedKeys, moveKey } from '../../tools/admin/domain/cardLayout.js';

export class CardLayoutEditor extends LitElement {
  static properties = {
    /** @type {{ home: {key: string, label: string}[], admin: {key: string, label: string}[] }} */
    cards: { attribute: false },
    layout: { attribute: false },
    /** Quien persiste (inyectado): el componente decide el orden, no sabe de Firestore. */
    save: { attribute: false },
    saving: { state: true },
    _saved: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .surfaces { display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 1.5rem; align-items: start; }
    section { border: 1px solid var(--rm-border, #e5e7eb); border-radius: 12px; background: var(--rm-surface, #fff); overflow: hidden; }
    h2 { margin: 0; padding: 0.7rem 0.9rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--rm-muted, #5b6b7d); border-bottom: 1px solid var(--rm-border, #eef0f2); }
    ol { list-style: none; margin: 0; padding: 0; counter-reset: pos; }
    li { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.9rem; }
    li + li { border-top: 1px solid var(--rm-border, #eef0f2); }
    .pos { counter-increment: pos; font-variant-numeric: tabular-nums; font-size: 0.78rem; color: var(--rm-muted, #5b6b7d); min-width: 1.4rem; }
    .pos::before { content: counter(pos) '.'; }
    .label { flex: 1; font-size: 0.9rem; color: var(--rm-text, #111827); }
    .move { background: none; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; width: 2rem; height: 2rem;
      cursor: pointer; color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; line-height: 1; }
    .move:hover:not(:disabled) { color: var(--rm-accent, #2a9d8f); border-color: var(--rm-accent, #2a9d8f); }
    .move:disabled { opacity: 0.35; cursor: default; }
    .move:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    .bar { display: flex; align-items: center; gap: 1rem; margin: 1.5rem 0 0; }
    .primary { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); border: 0; border-radius: 9px;
      padding: 0.6rem 1.2rem; font: inherit; font-weight: 700; cursor: pointer; }
    .primary:disabled { opacity: 0.6; cursor: default; }
    .ok { color: var(--rm-accent-700, #1f766c); font-size: 0.85rem; font-weight: 600; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
    .empty { padding: 0.9rem; color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
  `;

  constructor() {
    super();
    this.cards = { home: [], admin: [] };
    this.layout = { home: [], admin: [] };
    this.save = null;
    this.saving = false;
    this._saved = false;
    this._error = '';
  }

  /** ¿Hay ya con qué guardar? La persistencia llega despues del login. */
  get _ready() {
    return typeof this.save === 'function';
  }

  /** El orden que se muestra: el guardado, aplicado a las tarjetas que existen. */
  _keys(surface) {
    const present = (this.cards?.[surface] ?? []).map((c) => c.key);
    return orderedKeys(present, this.layout?.[surface]);
  }

  _label(surface, key) {
    return (this.cards?.[surface] ?? []).find((c) => c.key === key)?.label ?? key;
  }

  _move(surface, key, delta) {
    this.layout = { ...this.layout, [surface]: moveKey(this._keys(surface), key, delta) };
    this._saved = false;
  }

  async _save() {
    if (!this._ready) return;
    this.saving = true;
    this._error = '';
    this._saved = false;
    // Se guarda el orden COMPLETO y visible, no el retocado a medias: asi lo
    // guardado es exactamente lo que se estaba viendo.
    const layout = { home: this._keys('home'), admin: this._keys('admin') };
    try {
      // Se ESPERA al guardado: cantar exito antes de saberlo deja a alguien
      // creyendo que ha ordenado las tarjetas cuando no ha ordenado nada.
      await this.save(layout);
      this.layout = layout;
      this._saved = true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar el orden.';
    } finally {
      this.saving = false;
    }
  }

  render() {
    return html`
      <div class="surfaces">
        ${this._renderSurface('home', 'Inicio · herramientas')}
        ${this._renderSurface('admin', 'Panel de administración')}
      </div>
      <div class="bar">
        <button class="primary" type="button" ?disabled=${this.saving || !this._ready} @click=${() => this._save()}>
          ${this.saving ? 'Guardando…' : 'Guardar orden'}
        </button>
        ${this._saved ? html`<span class="ok">Guardado. Lo ve toda la organización.</span>` : null}
        ${this._error ? html`<span class="error">${this._error}</span>` : null}
      </div>`;
  }

  _renderSurface(surface, title) {
    const keys = this._keys(surface);
    return html`
      <section>
        <h2>${title}</h2>
        ${keys.length === 0
          ? html`<p class="empty">No hay tarjetas que ordenar.</p>`
          : html`<ol>${keys.map((key, i) => this._renderItem(surface, key, i, keys.length))}</ol>`}
      </section>`;
  }

  _renderItem(surface, key, index, total) {
    const label = this._label(surface, key);
    return html`
      <li>
        <span class="pos" aria-hidden="true"></span>
        <span class="label">${label}</span>
        <button class="move" type="button" ?disabled=${index === 0}
          aria-label="Subir ${label}" @click=${() => this._move(surface, key, -1)}>↑</button>
        <button class="move" type="button" ?disabled=${index === total - 1}
          aria-label="Bajar ${label}" @click=${() => this._move(surface, key, 1)}>↓</button>
      </li>`;
  }
}

customElements.define('card-layout-editor', CardLayoutEditor);
