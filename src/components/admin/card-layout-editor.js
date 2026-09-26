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
 * únicamente sus tarjetas; lo que cambia es en qué posición relativa las ve. Por
 * eso la lista incluye tarjetas que quien administra quizá no vea nunca —van
 * marcadas—: si solo se listara lo propio, no se podrían colocar las de otros.
 *
 * El inicio se muestra AGRUPADO como se ve de verdad (RMR-TSK-0576), y se ordena
 * dentro de cada grupo. Enseñarlo como una lista plana haría creer que subir una
 * tarjeta del todo la lleva arriba del inicio, cuando solo la sube en su grupo.
 */
import { LitElement, html, css } from 'lit';
import { orderedKeys, moveKey } from '../../tools/admin/domain/cardLayout.js';
import { CARD_STYLES, STYLE_IDS, styleOf } from '../../tools/admin/domain/cardStyle.js';

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
    /* La muestra: un cuadradito con el color real de cada estilo, para elegir
       viendo en vez de adivinando por el nombre. */
    .swatch { width: 1.15rem; height: 1.15rem; border-radius: 6px; border: 1px solid var(--rm-border, #dde7ec); flex: none; }
    .sw-neutro { background: var(--rm-surface, #fff); }
    .sw-acento { background: color-mix(in srgb, var(--gr-teal, #2a9d8f) 45%, var(--rm-surface, #fff)); }
    .sw-aviso { background: color-mix(in srgb, var(--gr-coral, #f2887a) 55%, var(--rm-surface, #fff)); }
    .sw-calma { background: color-mix(in srgb, var(--rm-muted, #5b6b7d) 45%, var(--rm-surface, #fff)); }
    select { font: inherit; font-size: 0.82rem; padding: 0.3rem 0.4rem; border-radius: 8px;
      border: 1px solid var(--rm-border, #dde7ec); background: var(--rm-field, #fff); color: var(--rm-text, #111827); }
    .star { background: none; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; width: 2rem; height: 2rem;
      cursor: pointer; color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; line-height: 1; }
    .star[aria-pressed="true"] { color: var(--rm-on-accent, #fff); background: var(--gr-teal, #2a9d8f); border-color: var(--gr-teal, #2a9d8f); }
    .star:focus-visible, select:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 2px; }
    /* La numeracion se reinicia en cada grupo: subir y bajar solo mueven dentro
       del grupo, asi que un contador corrido prometeria un orden global que no
       existe. */
    .group-head { padding: 0.5rem 0.9rem 0.3rem; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.06em;
      text-transform: uppercase; color: var(--rm-muted, #5b6b7d); background: var(--rm-surface-hover, #f6f9fa);
      counter-reset: pos; }
    .group-head + li { border-top: 1px solid var(--rm-border, #eef0f2); }
    /* Marca de «esta no la ve todo el mundo»: explica por que aparece en la
       lista una tarjeta que quien administra quiza no vea nunca. */
    .only { font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 999px;
      background: color-mix(in srgb, var(--gr-navy, #1e3a5f) 10%, var(--rm-surface, #fff));
      color: var(--rm-muted, #5b6b7d); white-space: nowrap; }
    .note { margin: 0.8rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); line-height: 1.5; }
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

  /**
   * Un <select> cuyas <option> se pintan en la misma plantilla NO refleja su
   * valor al repintar (gotcha conocido de Lit): hay que fijarlo a mano despues
   * de cada render, o el desplegable enseña un color y la tarjeta tiene otro.
   */
  updated() {
    for (const sel of this.renderRoot.querySelectorAll('select[data-key]')) {
      sel.value = this._styleOf(sel.dataset.surface, sel.dataset.key).style;
    }
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

  /**
   * Las claves repartidas por grupo, en el orden en que se ven. Una superficie
   * sin grupos —el panel— devuelve un unico bloque sin titulo.
   *
   * Los bloques salen del GRUPO de cada tarjeta, no de tramos contiguos del
   * orden guardado: ese orden es una lista plana y puede venir de antes de que
   * hubiera grupos, asi que por tramos un mismo grupo saldria partido en varios
   * bloques con el mismo titulo.
   *
   * @returns {{ label: string|null, keys: string[] }[]}
   */
  _blocks(surface) {
    const cards = this.cards?.[surface] ?? [];
    const porClave = new Map(cards.map((c) => [c.key, c]));
    const bloques = new Map();
    for (const key of this._keys(surface)) {
      const card = porClave.get(key);
      const label = card?.groupLabel ?? null;
      if (!bloques.has(label)) bloques.set(label, { label, index: card?.groupIndex ?? 0, keys: [] });
      bloques.get(label).keys.push(key);
    }
    return [...bloques.values()].toSorted((a, b) => a.index - b.index);
  }

  _label(surface, key) {
    return (this.cards?.[surface] ?? []).find((c) => c.key === key)?.label ?? key;
  }

  _move(surface, key, delta) {
    // Se mueve dentro de SU bloque y se rehace el orden completo concatenando
    // los bloques: mover sobre la lista plana cruzaria de grupo, y el inicio no
    // mueve tarjetas de grupo.
    const bloques = this._blocks(surface).map((b) => (
      b.keys.includes(key) ? { ...b, keys: moveKey(b.keys, key, delta) } : b
    ));
    this.layout = { ...this.layout, [surface]: bloques.flatMap((b) => b.keys) };
    this._saved = false;
  }

  /** Estilo actual de una tarjeta (el guardado, o el normal). */
  _styleOf(surface, key) {
    return styleOf(this.layout?.styles?.[surface], key);
  }

  /** Cambia una parte del aspecto de una tarjeta sin tocar el resto. */
  _setStyle(surface, key, patch) {
    const porSuperficie = this.layout?.styles ?? { home: {}, admin: {} };
    const actual = this._styleOf(surface, key);
    this.layout = {
      ...this.layout,
      styles: {
        ...porSuperficie,
        [surface]: { ...porSuperficie[surface], [key]: { ...actual, ...patch } },
      },
    };
    this._saved = false;
  }

  async _save() {
    if (!this._ready) return;
    this.saving = true;
    this._error = '';
    this._saved = false;
    // Se guarda el orden COMPLETO y visible, no el retocado a medias: asi lo
    // guardado es exactamente lo que se estaba viendo.
    const layout = {
      home: this._keys('home'),
      admin: this._keys('admin'),
      styles: this.layout?.styles ?? { home: {}, admin: {} },
    };
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
    // Nada tocable hasta tener el estado cargado. Antes se podia reordenar o
    // destacar durante la carga, y la llegada de lo guardado se cargaba esos
    // cambios sin decir nada: el peor fallo posible, el que no se ve.
    if (!this._ready) return html`<p class="empty">Cargando el orden…</p>`;
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
      </div>
      <p class="note">
        Aquí están TODAS las tarjetas, no solo las que tú ves: por eso aparecen algunas
        marcadas. Colocarlas no cambia quién las ve — eso lo decide la política de cada
        herramienta — sino en qué posición las ve quien tenga acceso.
      </p>`;
  }

  _renderSurface(surface, title) {
    const bloques = this._blocks(surface);
    const total = bloques.reduce((n, b) => n + b.keys.length, 0);
    return html`
      <section>
        <h2>${title}</h2>
        ${total === 0
          ? html`<p class="empty">No hay tarjetas que ordenar.</p>`
          : html`<ol>${bloques.map((b) => this._renderBlock(surface, b))}</ol>`}
      </section>`;
  }

  /** Un grupo con su titulo; el panel no tiene grupos y va sin titulo. */
  _renderBlock(surface, bloque) {
    const filas = bloque.keys.map((key, i) => this._renderItem(surface, key, i, bloque.keys.length));
    if (!bloque.label) return filas;
    return html`<li class="group-head" aria-hidden="true">${bloque.label}</li>${filas}`;
  }

  _renderItem(surface, key, index, total) {
    const label = this._label(surface, key);
    const estilo = this._styleOf(surface, key);
    const card = (this.cards?.[surface] ?? []).find((c) => c.key === key);
    return html`
      <li>
        <span class="pos" aria-hidden="true"></span>
        <span class="swatch sw-${estilo.style}" aria-hidden="true"></span>
        <span class="label">${label}</span>
        ${card?.only ? html`<span class="only" title="No la ve todo el mundo">${card.only}</span>` : null}
        ${this._renderStylePicker(surface, key, label, estilo)}
        <button class="star" type="button" aria-pressed=${estilo.featured ? 'true' : 'false'}
          aria-label="Destacar ${label}"
          @click=${() => this._setStyle(surface, key, { featured: !estilo.featured })}>★</button>
        <button class="move" type="button" ?disabled=${index === 0}
          aria-label="Subir ${label}" @click=${() => this._move(surface, key, -1)}>↑</button>
        <button class="move" type="button" ?disabled=${index === total - 1}
          aria-label="Bajar ${label}" @click=${() => this._move(surface, key, 1)}>↓</button>
      </li>`;
  }

  _renderStylePicker(surface, key, label, estilo) {
    return html`
      <select aria-label="Color de ${label}" data-surface=${surface} data-key=${key}
        @change=${(e) => this._setStyle(surface, key, { style: e.target.value })}>
        ${STYLE_IDS.map((id) => html`
          <option value=${id} ?selected=${estilo.style === id}>${CARD_STYLES[id].label}</option>`)}
      </select>`;
  }
}

customElements.define('card-layout-editor', CardLayoutEditor);
