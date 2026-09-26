/**
 * <org-identity> — los textos con los que esta instancia se reconoce
 * (RMR-TSK-0596).
 *
 * GREBLA se despliega una vez por organización, así que sus rótulos por defecto
 * son los generales del producto. Aquí una casa pone los suyos: cómo se llama,
 * cómo llama a mirar más allá de un equipo, quién está en la corona del
 * organigrama y con qué dominio de correo entra su gente.
 *
 * Dos de estos campos ya se leían desde hace tiempo y no tenían pantalla: se
 * editaban a mano en la consola de Firestore. Un ajuste que solo se toca entrando
 * en la base de datos es un ajuste que nadie toca.
 *
 * Dejar un campo en blanco NO deja el rótulo vacío: significa «usa el del
 * producto», y el defecto se dice en el propio campo para que eso se vea antes de
 * guardar, no después.
 */
import { LitElement, html, css } from 'lit';
import { IDENTITY_FIELDS, IDENTITY_MAX_LEN, normalizeIdentity } from '../../tools/admin/domain/orgIdentity.js';

export class OrgIdentity extends LitElement {
  static properties = {
    /** Lo guardado. `null` mientras carga: los campos no se tocan hasta saber qué hay. */
    identity: { attribute: false },
    /** Quien persiste (inyectado): esta pantalla decide los textos, no sabe de Firestore. */
    save: { attribute: false },
    readOnly: { attribute: 'read-only', type: Boolean },
    _draft: { state: true },
    _saving: { state: true },
    _saved: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; color: var(--rm-text, #111827); }
    .lead { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; margin: 0 0 1.4rem; max-width: 62ch; line-height: 1.55; }
    .fields { display: grid; gap: 1.1rem; max-width: 42rem; }
    label { display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.3rem; }
    input {
      width: 100%; box-sizing: border-box; font: inherit; font-size: 0.92rem;
      border: 1px solid var(--rm-border, #dde7ec); border-radius: 9px; padding: 0.5rem 0.7rem;
      background: var(--rm-field, var(--rm-surface, #fff)); color: var(--rm-text, #111827);
    }
    input:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 1px; }
    input:disabled { opacity: 0.6; }
    .hint { margin: 0.3rem 0 0; font-size: 0.8rem; color: var(--rm-muted, #5b6b7d); line-height: 1.45; }
    .bar { display: flex; align-items: center; gap: 1rem; margin: 1.6rem 0 0; }
    .primary { background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); border: 0; border-radius: 9px;
      padding: 0.6rem 1.2rem; font: inherit; font-weight: 700; cursor: pointer; }
    .primary:disabled { opacity: 0.6; cursor: default; }
    .ok { color: var(--rm-accent-700, #1f766c); font-size: 0.85rem; font-weight: 600; }
    .error { color: var(--rm-danger, #b91c1c); font-size: 0.85rem; }
    .loading { color: var(--rm-muted, #5b6b7d); font-size: 0.9rem; }
  `;

  constructor() {
    super();
    /** @type {Record<string, string>|null} */
    this.identity = null;
    /** @type {((patch: Record<string, string>) => Promise<unknown>)|null} */
    this.save = null;
    this.readOnly = false;
    /** @type {Record<string, string>|null} */
    this._draft = null;
    this._saving = false;
    this._saved = false;
    this._error = '';
  }

  updated(changed) {
    // El borrador se siembra UNA vez, cuando llega lo guardado. Volver a
    // sembrarlo en cada render pisaría lo que la persona está escribiendo.
    if (changed.has('identity') && this.identity && this._draft === null) {
      this._draft = { ...this.identity };
    }
  }

  render() {
    // Editable antes de saber qué hay guardado significa guardar encima de lo que
    // no has visto. Se espera.
    if (this._draft === null) return html`<p class="loading">Cargando la identidad de la instancia…</p>`;
    return html`
      <p class="lead">
        Cómo se llama esta casa dentro de GREBLA. Lo que dejes en blanco usa el texto
        por defecto del producto, que se indica en cada campo: nunca queda un rótulo vacío.
      </p>
      <div class="fields">${IDENTITY_FIELDS.map((f) => this._renderField(f))}</div>
      ${this._renderBar()}`;
  }

  _renderField(field) {
    return html`
      <div>
        <label for="id-${field.key}">${field.label}</label>
        <input
          id="id-${field.key}"
          type="text"
          maxlength=${IDENTITY_MAX_LEN}
          placeholder=${field.placeholder}
          ?disabled=${this.readOnly || this._saving}
          .value=${this._draft[field.key] ?? ''}
          @input=${(e) => this._edit(field.key, e.target.value)}
        />
        <p class="hint">${field.hint}</p>
      </div>`;
  }

  _renderBar() {
    if (this.readOnly) return html`<p class="hint">Modo solo lectura: no puedes cambiar la identidad.</p>`;
    return html`
      <div class="bar">
        <button class="primary" ?disabled=${this._saving} @click=${() => this._save()}>
          ${this._saving ? 'Guardando…' : 'Guardar'}
        </button>
        ${this._saved ? html`<span class="ok">Guardado.</span>` : null}
        ${this._error ? html`<span class="error">${this._error}</span>` : null}
      </div>`;
  }

  _edit(key, value) {
    this._draft = { ...this._draft, [key]: value };
    this._saved = false;
    this._error = '';
  }

  async _save() {
    if (!this.save) {
      this._error = 'Esta pantalla no tiene con qué guardar.';
      return;
    }
    this._saving = true;
    this._error = '';
    try {
      // Se guarda lo SANEADO y el borrador se queda con eso: si el dominio se
      // escribió con arroba, la caja tiene que enseñar lo que de verdad quedó.
      const limpio = normalizeIdentity(this._draft);
      await this.save(limpio);
      this._draft = { ...limpio };
      this._saved = true;
    } catch (err) {
      console.error('[identidad] no se pudo guardar:', err);
      this._error = 'No se pudo guardar (¿sigues siendo superadmin?).';
    } finally {
      this._saving = false;
    }
  }
}

customElements.define('org-identity', OrgIdentity);
