/**
 * <city-references> — «Aportado por la tripulación» (RMR-TSK-0255): dentro del
 * panel de una casa, lista EN VIVO las referencias de aprendizaje que los
 * ingenieros han aportado a esa casa (lo que les ayudó a certificarse), cada una
 * con un mini badge del nombre de quien la añadió. Cualquier ingeniero logado
 * puede aportar (enlace + título + nota); borra las suyas (un manager/superadmin
 * puede borrar cualquiera, por reglas). Se estiliza con los tokens --rm-* para
 * heredar el pergamino del panel que lo contiene.
 */
import { LitElement, html, css } from 'lit';
import { watchCityReferences, addCityReference, deleteCityReference } from '../../lib/cityReferences.js';
import { isValidReference, sanitizeReference } from '../../tools/career/domain/references.js';

export class CityReferences extends LitElement {
  static properties = {
    islandId: { attribute: false },
    cityId: { attribute: false },
    user: { attribute: false },
    _refs: { state: true },
    _open: { state: true },
    _url: { state: true },
    _title: { state: true },
    _note: { state: true },
    _saving: { state: true },
    _error: { state: true },
  };

  static styles = css`
    :host { display: block; }
    .sec {
      background: var(--rm-surface, #fff);
      border: 1px solid var(--rm-border, #e5e7eb);
      border-radius: 12px;
      padding: 0.75rem 0.85rem;
    }
    h4 { margin: 0 0 0.5rem; font-size: 0.95rem; color: var(--rm-text, #1e3a5f); font-family: var(--parch-title, inherit); }
    .empty { margin: 0; font-size: 0.82rem; color: var(--rm-muted, #6b7280); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
    li { display: flex; gap: 0.5rem; align-items: flex-start; }
    .ref { flex: 1 1 auto; min-width: 0; }
    .ref a { color: var(--rm-accent, #2a9d8f); font-weight: 600; font-size: 0.88rem; text-decoration: none; word-break: break-word; }
    .ref a:hover { text-decoration: underline; }
    .ref .note { margin: 0.15rem 0 0.25rem; font-size: 0.8rem; color: var(--rm-muted, #6b7280); }
    .badge {
      display: inline-flex; align-items: center; gap: 0.25rem;
      font-size: 0.68rem; color: var(--rm-muted, #6b7280);
      background: var(--rm-track, #eef2f7); border-radius: 999px; padding: 0.05rem 0.5rem;
    }
    .del {
      flex: none; border: 1px solid var(--rm-border, #e5e7eb); background: transparent;
      color: var(--rm-danger, #dc2626); border-radius: 999px; width: 24px; height: 24px;
      font-size: 0.85rem; line-height: 1; cursor: pointer;
    }
    .del:hover { background: var(--rm-danger, #dc2626); color: #fff; }
    .add { margin-top: 0.7rem; }
    .add-open {
      border: 1px dashed var(--rm-border, #e5e7eb); background: transparent; color: var(--rm-accent, #2a9d8f);
      border-radius: 999px; padding: 0.35rem 0.8rem; font: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer;
    }
    form { display: grid; gap: 0.5rem; margin-top: 0.6rem; }
    input, textarea {
      width: 100%; box-sizing: border-box; font: inherit; font-size: 0.85rem;
      padding: 0.4rem 0.55rem; border: 1px solid var(--rm-border, #e5e7eb); border-radius: 8px;
      background: var(--rm-surface, #fff); color: var(--rm-text, #111827);
    }
    textarea { resize: vertical; min-height: 2.2rem; }
    input:focus-visible, textarea:focus-visible { outline: 2px solid var(--rm-accent, #2a9d8f); outline-offset: 1px; }
    .actions { display: flex; gap: 0.5rem; align-items: center; }
    .save { border: 0; background: var(--rm-accent, #2a9d8f); color: var(--rm-on-accent, #fff); border-radius: 999px; padding: 0.4rem 0.9rem; font: inherit; font-weight: 700; cursor: pointer; }
    .save:disabled { opacity: 0.6; cursor: not-allowed; }
    .cancel { border: 1px solid var(--rm-border, #e5e7eb); background: transparent; color: var(--rm-muted, #6b7280); border-radius: 999px; padding: 0.4rem 0.8rem; font: inherit; font-weight: 600; cursor: pointer; }
    .error { color: var(--rm-danger, #dc2626); font-size: 0.8rem; margin: 0; }
  `;

  constructor() {
    super();
    this.islandId = '';
    this.cityId = '';
    this.user = null;
    this._refs = [];
    this._open = false;
    this._url = '';
    this._title = '';
    this._note = '';
    this._saving = false;
    this._error = '';
    this._unsub = null;
    this._watchKey = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this._resubscribe();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    this._unsub = null;
  }

  updated(changed) {
    if (changed.has('islandId') || changed.has('cityId')) this._resubscribe();
  }

  /** (Re)suscribe cuando cambia la casa; ignora si es la misma (evita parpadeo). */
  _resubscribe() {
    const key = `${this.islandId}::${this.cityId}`;
    if (!this.cityId || key === this._watchKey) return;
    this._watchKey = key;
    this._unsub?.();
    this._refs = [];
    this._unsub = watchCityReferences(
      this.islandId,
      this.cityId,
      (refs) => { this._refs = refs; },
      () => { this._error = 'No se pudieron cargar las referencias.'; },
    );
  }

  _canDelete(ref) {
    return this.user?.uid && ref.authorUid === this.user.uid;
  }

  async _add(event) {
    event.preventDefault();
    if (!this.user?.uid) return;
    const clean = sanitizeReference({ url: this._url, title: this._title, note: this._note });
    if (!isValidReference(clean)) {
      this._error = 'Pon un enlace (http/https) y un título.';
      return;
    }
    this._saving = true;
    this._error = '';
    try {
      await addCityReference({ islandId: this.islandId, cityId: this.cityId, ...clean }, this.user);
      this._url = ''; this._title = ''; this._note = ''; this._open = false;
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'No se pudo guardar la referencia.';
    } finally {
      this._saving = false;
    }
  }

  async _delete(ref) {
    try {
      await deleteCityReference(ref.id);
    } catch {
      this._error = 'No se pudo borrar la referencia.';
    }
  }

  _renderItem(ref) {
    return html`
      <li>
        <div class="ref">
          <a href=${ref.url} target="_blank" rel="noopener noreferrer">${ref.title || ref.url}</a>
          ${ref.note ? html`<p class="note">${ref.note}</p>` : null}
          <span class="badge">👤 ${ref.authorName || 'Anónimo'}</span>
        </div>
        ${this._canDelete(ref) ? html`<button class="del" title="Borrar mi referencia" @click=${() => this._delete(ref)}>✕</button>` : null}
      </li>`;
  }

  _renderForm() {
    return html`
      <form @submit=${this._add}>
        <input type="url" placeholder="https://… (enlace)" .value=${this._url}
          @input=${(e) => { this._url = e.target.value; }} />
        <input type="text" placeholder="Título (p. ej. Curso CKA)" .value=${this._title}
          @input=${(e) => { this._title = e.target.value; }} />
        <textarea placeholder="¿Por qué te ayudó? (opcional)" .value=${this._note}
          @input=${(e) => { this._note = e.target.value; }}></textarea>
        ${this._error ? html`<p class="error">${this._error}</p>` : null}
        <div class="actions">
          <button class="save" type="submit" ?disabled=${this._saving}>${this._saving ? 'Guardando…' : 'Compartir referencia'}</button>
          <button class="cancel" type="button" @click=${() => { this._open = false; this._error = ''; }}>Cancelar</button>
        </div>
      </form>`;
  }

  render() {
    return html`
      <div class="sec">
        <h4>🧭 Aportado por la tripulación ${this._refs.length ? html`(${this._refs.length})` : ''}</h4>
        ${this._refs.length
          ? html`<ul>${this._refs.map((r) => this._renderItem(r))}</ul>`
          : html`<p class="empty">Aún no hay aportes. ¿Encontraste algo que te ayudó a certificarte? Compártelo con la tripulación.</p>`}
        ${this.user?.uid
          ? html`<div class="add">
              ${this._open ? this._renderForm() : html`<button class="add-open" type="button" @click=${() => { this._open = true; }}>➕ Añadir referencia</button>`}
            </div>`
          : null}
      </div>`;
  }
}

if (!customElements.get('city-references')) {
  customElements.define('city-references', CityReferences);
}
