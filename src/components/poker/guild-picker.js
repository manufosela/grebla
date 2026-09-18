/**
 * <guild-picker> — casillas de gremio de una tarea del poker (RMR-PCS-0043 ·
 * F1). Chips marcables con el catálogo de la instancia; sin ninguno marcado la
 * tarea es GENERAL y se avisa (no se bloquea: hay tareas que son de todos).
 *
 * Props: catalog (string[]), value (string[]), label (para el grupo), readonly.
 * Evento: change ({ guilds }) con los gremios en el orden del catálogo.
 */
import { LitElement, html, css } from 'lit';
import { normalizeGuilds } from '../../tools/poker/domain/tasks.js';

export class GuildPicker extends LitElement {
  static properties = {
    catalog: { type: Array },
    value: { type: Array },
    label: { type: String },
    readonly: { type: Boolean },
  };

  static styles = css`
    :host { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
    .chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.15rem 0.55rem; border-radius: 999px; border: 1px solid var(--rm-border, #dde7ec); font-size: 0.78rem; font-weight: 600; color: var(--rm-muted, #5b6b7d); background: var(--rm-surface, #fff); cursor: pointer; user-select: none; }
    .chip.on { border-color: var(--rm-accent, #2a9d8f); color: var(--rm-accent, #2a9d8f); background: color-mix(in srgb, var(--rm-accent, #2a9d8f) 10%, transparent); }
    .chip input { margin: 0; accent-color: var(--rm-accent, #2a9d8f); }
    :host([readonly]) .chip { cursor: default; }
    .general { font-size: 0.75rem; color: var(--rm-warn, #b45309); }
    .empty { font-size: 0.75rem; color: var(--rm-muted, #5b6b7d); }
  `;

  constructor() {
    super();
    this.catalog = [];
    this.value = [];
    this.label = 'Gremios';
    this.readonly = false;
  }

  _toggle(guild, checked) {
    const next = checked ? [...this.value, guild] : this.value.filter((g) => g !== guild);
    const guilds = normalizeGuilds(next, this.catalog);
    this.value = guilds;
    this.dispatchEvent(new CustomEvent('change', { detail: { guilds }, bubbles: true, composed: true }));
  }

  render() {
    const cat = this.catalog ?? [];
    const value = this.value ?? [];
    if (this.readonly) {
      return value.length
        ? value.map((g) => html`<span class="chip on">${g}</span>`)
        : html`<span class="general">Tarea general: votan todos los gremios</span>`;
    }
    if (cat.length === 0) return html`<span class="empty">Sin gremios en el catálogo</span>`;
    return html`<span role="group" aria-label=${this.label} style="display:contents">
      ${cat.map((g) => html`<label class="chip ${value.includes(g) ? 'on' : ''}">
        <input type="checkbox" .checked=${value.includes(g)} @change=${(e) => this._toggle(g, e.target.checked)} />${g}</label>`)}
      ${value.length === 0 ? html`<span class="general">Sin gremio: tarea general, votan todos</span>` : null}
    </span>`;
  }
}

if (!customElements.get('guild-picker')) customElements.define('guild-picker', GuildPicker);
