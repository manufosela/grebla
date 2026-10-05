/**
 * <brand-colors-editor> — Admin › Identidad › Colores (RMR-TSK-0599).
 *
 * Un color por marca (marca, acento, afectivo). Mientras se eligen se ve el
 * contraste de cada uno; si alguno no llega a WCAG AA en claro o en oscuro, no
 * se guarda y se dice qué par falla y con qué ratio. La versión del tema oscuro
 * no se elige: sale sola del mismo color. Lo guardado se pinta al momento.
 */
import { LitElement, html, css } from 'lit';

/** Nada que pintar, como plantilla (Sonar S3800: mismo tipo en todas las ramas). */
const EMPTY = html``;
import '../common/busy-overlay.js';
import { BRAND_SLOTS, validateBrandColors, brandStyleSheet } from '../../tools/admin/domain/brandColors.js';
import { applyBrandStyle } from '../../lib/brandStyle.js';

/** Los de GREBLA, para empezar cuando la instancia no tiene propios. */
const GREBLA_COLORS = Object.freeze({ brand: '#1e3a5f', accent: '#2a9d8f', affective: '#c0392b' });

export class BrandColorsEditor extends LitElement {
  static properties = {
    /** Lo guardado: undefined mientras se lee, null si la instancia usa los de GREBLA. */
    colors: { attribute: false },
    /** Quien persiste (inyectado): lanza si no se puede guardar. */
    save: { attribute: false },
    readOnly: { attribute: 'read-only', type: Boolean },
    _draft: { state: true },
    _busy: { state: true },
    _error: { state: true },
    _saved: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #111827); max-width: 42rem; }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; margin: 0 0 1.2rem; line-height: 1.55; }
    .slot { display: flex; align-items: center; gap: 0.8rem; margin: 0 0 0.9rem; }
    .slot label { min-width: 8rem; font-weight: 600; font-size: 0.9rem; }
    input[type='color'] { width: 3rem; height: 2.2rem; border: 1px solid var(--rm-border, #dde7ec); border-radius: 8px; background: none; }
    code { font-size: 0.85rem; }
    .problems { margin: 0.8rem 0 0; padding-left: 1.2rem; color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
    .bar { display: flex; align-items: center; gap: 1rem; margin: 1.2rem 0 0; flex-wrap: wrap; }
    .primary { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); border: 0; border-radius: 9px;
      padding: 0.6rem 1.2rem; font: inherit; font-weight: 700; cursor: pointer; }
    .primary:disabled { opacity: 0.6; cursor: default; }
    .ok { color: var(--rm-accent-700, #1f766c); font-size: 0.85rem; font-weight: 600; }
  `;

  constructor() {
    super();
    this.colors = undefined;
    this.save = null;
    this.readOnly = false;
    this._draft = null;
    this._busy = false;
    this._error = '';
    this._saved = false;
  }

  willUpdate(changed) {
    // Se siembra una vez y solo cuando ya se sabe qué hay guardado: antes, el
    // borrador serían los de GREBLA y se podrían guardar encima de los propios.
    if (changed.has('colors') && this._draft === null && this.colors !== undefined) {
      this._draft = { ...(this.colors ?? GREBLA_COLORS) };
    }
  }

  async _save() {
    this._error = '';
    this._saved = false;
    const errors = validateBrandColors(this._draft);
    if (errors.length) { this._error = errors.join(' · '); return; }
    this._busy = true;
    try {
      await this.save({ ...this._draft });
      applyBrandStyle(brandStyleSheet(this._draft));
      this._saved = true;
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
    } finally {
      this._busy = false;
    }
  }

  _pick(key, value) {
    this._draft = { ...this._draft, [key]: value };
    this._saved = false;
  }

  render() {
    if (this._draft === null) return EMPTY;
    const problems = validateBrandColors(this._draft);
    const bar = this.readOnly ? EMPTY : this._renderBar(problems.length > 0);
    return html`
      ${this._renderBusy()}
      <p class="lead">Un color por marca. Tiene que leerse bien en el tema claro y en el oscuro; la versión oscura sale sola del mismo color.</p>
      ${BRAND_SLOTS.map((slot) => this._renderSlot(slot))}
      ${this._renderProblems(problems)}
      ${bar}`;
  }

  _renderBusy() {
    return this._busy ? html`<busy-overlay message="Guardando los colores…"></busy-overlay>` : EMPTY;
  }

  _renderProblems(problems) {
    if (!problems.length) return EMPTY;
    return html`<ul class="problems">${problems.map((p) => this._problemItem(p))}</ul>`;
  }

  _problemItem(text) {
    return html`<li>${text}</li>`;
  }

  _renderSlot({ key, label }) {
    const id = `brand-${key}`;
    return html`<div class="slot">
      <label for=${id}>${label}</label>
      <input id=${id} type="color" .value=${this._draft[key]} ?disabled=${this.readOnly}
        @input=${(e) => this._pick(key, e.target.value)} />
      <code>${this._draft[key]}</code>
    </div>`;
  }

  _renderBar(blocked) {
    return html`<div class="bar">
      <button class="primary" ?disabled=${blocked || this._busy} @click=${() => this._save()}>Guardar colores</button>
      ${this._renderSaved()}
      ${this._renderError()}
    </div>`;
  }

  _renderSaved() {
    return this._saved ? html`<span class="ok">Guardado.</span>` : EMPTY;
  }

  _renderError() {
    return this._error ? html`<span class="problems">${this._error}</span>` : EMPTY;
  }
}

customElements.define('brand-colors-editor', BrandColorsEditor);
